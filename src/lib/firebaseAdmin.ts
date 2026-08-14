import {
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getStorage, type Storage } from 'firebase-admin/storage';
import fs from 'fs';
import { ConfigError } from './apiError';

/**
 * Hardened service-account loader.
 * Accepts (in priority order):
 *   1. FIREBASE_SERVICE_ACCOUNT_B64 -> base64 of the service-account JSON  (most robust)
 *   2. FIREBASE_SERVICE_ACCOUNT     -> JSON string (single-line, or pretty-printed)
 *   3. FIREBASE_SERVICE_ACCOUNT_PATH-> path to a JSON key file
 *   4. Three split vars: FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
 *
 * Why base64 exists: the service-account private key contains newlines. Pasting
 * raw JSON into a shell profile, a systemd unit, a PM2 ecosystem file, a Docker
 * `-e` flag or a cPanel env box mangles those newlines, and `JSON.parse` then
 * fails with "Bad control character in string literal" — which used to surface
 * as an opaque HTTP 500 on /api/auth/send-otp. Base64 has no special characters
 * and survives every one of those transports intact.
 *
 * This loader still tries hard to repair mangled raw JSON before giving up, and
 * every failure mode now throws a ConfigError with a specific code and a fix
 * instruction instead of a generic Error.
 *
 * Initialization is LAZY: the admin app is only created the first time one of
 * the exported services is actually used at runtime. This keeps `next build`
 * (which imports route modules to collect metadata) from throwing when env
 * vars aren't present in the build environment.
 */

function normalizePrivateKey(key: string): string {
  let k = key.trim();
  // Strip wrapping quotes if the value was pasted with them
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1);
  }
  // Convert escaped newlines into real newlines (and normalise CRLF from
  // Windows-edited .env files, which breaks PEM parsing).
  k = k.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
  return k;
}

/**
 * Escape raw control characters that appear INSIDE JSON string literals.
 * Fixes the classic "pretty-printed service account pasted into an env var"
 * breakage without corrupting the structural whitespace between tokens.
 */
function escapeControlCharsInStrings(s: string): string {
  let out = '';
  let inString = false;
  let escaped = false;

  for (const ch of s) {
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }
    if (inString) {
      if (ch === '\n') { out += '\\n'; continue; }
      if (ch === '\r') { continue; }
      if (ch === '\t') { out += '\\t'; continue; }
    }
    out += ch;
  }
  return out;
}

function stripWrappingQuotes(s: string): string {
  const t = s.trim();
  if (t.length > 1 && ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"')))) {
    return t.slice(1, -1);
  }
  return t;
}

/**
 * Undo one level of quote-escaping: `{\"type\":\"service_account\"}`.
 * Happens when the JSON is pasted into a field that stores it as a quoted
 * string (some panels, JSON-encoded config files, double-stringified values).
 * Left alone, `JSON.parse` fails at position 1 — right after the `{`.
 */
function unescapeQuotes(s: string): string {
  return s.replace(/\\"/g, '"');
}

/**
 * Convert a Python/JS-style single-quoted object literal into JSON.
 * A service-account key contains no apostrophes in any value, so a blanket
 * swap is safe here — and this only ever runs as a last-resort repair.
 */
function singleQuotedToJson(s: string): string {
  return s.replace(/'/g, '"');
}

/**
 * Describe *how* the value is malformed, without ever echoing it back.
 * Only structural facts — no substring of the secret is included.
 */
function diagnoseMalformedJson(s: string): string {
  const body = stripWrappingQuotes(s);
  if (body.includes('\\"')) {
    return (
      'The quotes in the value are backslash-escaped (it looks like {\\"type\\":...}), ' +
      'so it is a JSON *string* rather than a JSON object. The value was probably ' +
      'copied out of a field that had already encoded it once.'
    );
  }
  if (/^\{\s*'/.test(body)) {
    return 'The value uses single quotes instead of double quotes, which is not valid JSON.';
  }
  if (/^\{\s*[A-Za-z_]/.test(body)) {
    return 'The property names in the value are unquoted, which is not valid JSON.';
  }
  if (/"[^"]*\n[^"]*"/.test(body)) {
    return 'The value contains real line breaks inside a string — the private key newlines were mangled in transit.';
  }
  if (!body.startsWith('{')) {
    return 'The value does not start with "{", so it is not a service-account JSON object at all.';
  }
  return 'The value is not valid JSON.';
}

function parseServiceAccountJson(raw: string, source: string): Record<string, string> {
  const stripped = stripWrappingQuotes(raw);

  // Repair attempts, cheapest and least invasive first. Each is only reached
  // if every earlier one failed to parse.
  const attempts = [
    raw,
    stripped,
    escapeControlCharsInStrings(stripped),
    unescapeQuotes(stripped),
    escapeControlCharsInStrings(unescapeQuotes(stripped)),
    escapeControlCharsInStrings(singleQuotedToJson(stripped)),
  ];

  // Report the FIRST failure — it describes the value as supplied, which is
  // what the operator actually needs to know. Later messages describe repaired
  // variants and are misleading.
  let firstMessage = '';
  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch (e) {
      if (!firstMessage) firstMessage = (e as Error).message;
    }
  }

  throw new ConfigError(
    'FIREBASE_SERVICE_ACCOUNT_INVALID_JSON',
    `${source} is set but could not be parsed as JSON (${firstMessage || 'unknown parse error'}). ` +
      `${diagnoseMalformedJson(raw)} ` +
      'Fix: set FIREBASE_SERVICE_ACCOUNT_B64 instead — it has no quotes or newlines to corrupt. ' +
      'Generate it with:  base64 -w0 serviceAccount.json  (PowerShell: ' +
      '[Convert]::ToBase64String([IO.File]::ReadAllBytes("serviceAccount.json")))'
  );
}

function toServiceAccount(parsed: Record<string, string>, source: string): ServiceAccount {
  const projectId = parsed.project_id || parsed.projectId;
  const clientEmail = parsed.client_email || parsed.clientEmail;
  const privateKeyRaw = parsed.private_key || parsed.privateKey;

  const missing = [
    !projectId && 'project_id',
    !clientEmail && 'client_email',
    !privateKeyRaw && 'private_key',
  ].filter(Boolean);

  if (missing.length) {
    throw new ConfigError(
      'FIREBASE_SERVICE_ACCOUNT_INCOMPLETE',
      `${source} parsed as JSON but is missing: ${missing.join(', ')}. ` +
        'Make sure you used the full service-account key file downloaded from ' +
        'Firebase Console → Project settings → Service accounts → Generate new private key.'
    );
  }

  const privateKey = normalizePrivateKey(privateKeyRaw);
  if (!privateKey.includes('BEGIN') || !privateKey.includes('PRIVATE KEY')) {
    throw new ConfigError(
      'FIREBASE_PRIVATE_KEY_MALFORMED',
      `${source} contains a private_key that is not a PEM block. ` +
        'The value must start with "-----BEGIN PRIVATE KEY-----". ' +
        'Fix: use FIREBASE_SERVICE_ACCOUNT_B64 to avoid newline mangling.'
    );
  }

  return { projectId, clientEmail, privateKey };
}

function loadServiceAccount(): ServiceAccount {
  // 1. base64 — the transport-safe option, preferred on self-hosted servers.
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (b64 && b64.trim()) {
    let decoded: string;
    try {
      decoded = Buffer.from(stripWrappingQuotes(b64).replace(/\s/g, ''), 'base64').toString('utf8');
    } catch (e) {
      throw new ConfigError(
        'FIREBASE_SERVICE_ACCOUNT_B64_INVALID',
        `FIREBASE_SERVICE_ACCOUNT_B64 is not valid base64 (${(e as Error).message}).`
      );
    }
    if (!decoded.trim().startsWith('{')) {
      throw new ConfigError(
        'FIREBASE_SERVICE_ACCOUNT_B64_INVALID',
        'FIREBASE_SERVICE_ACCOUNT_B64 decoded to something that is not JSON. ' +
          'Regenerate it with: base64 -w0 serviceAccount.json'
      );
    }
    return toServiceAccount(
      parseServiceAccountJson(decoded, 'FIREBASE_SERVICE_ACCOUNT_B64'),
      'FIREBASE_SERVICE_ACCOUNT_B64'
    );
  }

  // 2. raw JSON string
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw && raw.trim()) {
    return toServiceAccount(
      parseServiceAccountJson(raw, 'FIREBASE_SERVICE_ACCOUNT'),
      'FIREBASE_SERVICE_ACCOUNT'
    );
  }

  // 3. path to a key file on disk
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (path && path.trim()) {
    if (!fs.existsSync(path)) {
      throw new ConfigError(
        'FIREBASE_SERVICE_ACCOUNT_PATH_NOT_FOUND',
        `FIREBASE_SERVICE_ACCOUNT_PATH points to "${path}" but no file exists there ` +
          `(resolved relative to the process working directory: ${process.cwd()}). ` +
          'Use an absolute path, or switch to FIREBASE_SERVICE_ACCOUNT_B64.'
      );
    }
    return toServiceAccount(
      parseServiceAccountJson(fs.readFileSync(path, 'utf8'), `FIREBASE_SERVICE_ACCOUNT_PATH (${path})`),
      `FIREBASE_SERVICE_ACCOUNT_PATH (${path})`
    );
  }

  // 4. three split vars
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId || clientEmail || privateKey) {
    const missing = [
      !projectId && 'FIREBASE_PROJECT_ID',
      !clientEmail && 'FIREBASE_CLIENT_EMAIL',
      !privateKey && 'FIREBASE_PRIVATE_KEY',
    ].filter(Boolean);

    if (missing.length) {
      throw new ConfigError(
        'FIREBASE_SPLIT_VARS_INCOMPLETE',
        `Partial Firebase admin config: ${missing.join(', ')} not set. ` +
          'All three split vars are required when FIREBASE_SERVICE_ACCOUNT(_B64) is absent.'
      );
    }

    return toServiceAccount(
      {
        project_id: projectId!,
        client_email: clientEmail!,
        private_key: privateKey!,
      },
      'FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY'
    );
  }

  throw new ConfigError(
    'FIREBASE_CREDENTIALS_MISSING',
    'Firebase admin credentials are not available to this server process. ' +
      'The environment file was probably never deployed (.env.local is gitignored) ' +
      'or the process was started without it. Set FIREBASE_SERVICE_ACCOUNT_B64 ' +
      '(recommended), FIREBASE_SERVICE_ACCOUNT, FIREBASE_SERVICE_ACCOUNT_PATH, or the ' +
      'three split vars FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY, ' +
      'then restart the server. See DEPLOYMENT.md.'
  );
}

let _app: App | null = null;
function getAdminApp(): App {
  if (_app) return _app;
  if (getApps().length) {
    _app = getApps()[0];
    return _app;
  }
  const sa = loadServiceAccount();
  try {
    _app = initializeApp({
      credential: cert(sa),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  } catch (e) {
    // cert() rejects malformed keys with a low-level message — re-tag it so the
    // API layer treats it as a config problem, not a mystery 500.
    throw new ConfigError(
      'FIREBASE_CREDENTIALS_REJECTED',
      `Firebase rejected the service-account credentials: ${(e as Error).message}. ` +
        'Check that the key belongs to the right project and has not been revoked.'
    );
  }
  return _app;
}

/**
 * Lazy proxy: behaves exactly like the underlying service object, but the
 * admin app (and credential loading) is only initialized on first property
 * access. Call sites keep using `adminDb.collection(...)` unchanged.
 */
function lazy<T extends object>(resolve: () => T): T {
  return new Proxy({} as T, {
    get(_t, prop, receiver) {
      const target = resolve();
      const value = Reflect.get(target as object, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

// Memoize Firestore and enable `ignoreUndefinedProperties` so writes can omit
// `undefined` fields instead of throwing "Cannot use 'undefined' as a value".
//
// `settings()` may only be called once, before any other Firestore method. In
// dev, Next.js hot-reloads recompile this module (resetting `_db`) while the
// underlying firebase-admin app persists across reloads — so a later compile
// can receive a Firestore singleton that was already used, making `settings()`
// throw "already initialized". The first successful call (in whichever compile
// ran first) has already applied the option to that persistent singleton, so
// we simply swallow the throw on subsequent attempts.
let _db: Firestore | null = null;
function getDb(): Firestore {
  if (_db) return _db;
  const db = getFirestore(getAdminApp());
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // settings already applied to this (persistent) instance — safe to ignore
  }
  _db = db;
  return _db;
}

/**
 * Non-throwing credential probe used by /api/health/env.
 * Never returns secrets — only which source was used and the (public)
 * project id / service-account email.
 */
export function inspectAdminCredentials():
  | { ok: true; source: string; projectId?: string; clientEmail?: string }
  | { ok: false; code: string; message: string } {
  const source = process.env.FIREBASE_SERVICE_ACCOUNT_B64
    ? 'FIREBASE_SERVICE_ACCOUNT_B64'
    : process.env.FIREBASE_SERVICE_ACCOUNT
    ? 'FIREBASE_SERVICE_ACCOUNT'
    : process.env.FIREBASE_SERVICE_ACCOUNT_PATH
    ? 'FIREBASE_SERVICE_ACCOUNT_PATH'
    : process.env.FIREBASE_PROJECT_ID
    ? 'split vars'
    : 'none';

  try {
    const sa = loadServiceAccount();
    return {
      ok: true,
      source,
      projectId: sa.projectId,
      clientEmail: sa.clientEmail,
    };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return {
      ok: false,
      code: err.code || 'FIREBASE_CREDENTIALS_ERROR',
      message: err.message || 'Failed to load Firebase admin credentials',
    };
  }
}

export const adminDb: Firestore = lazy(() => getDb());
export const adminAuth: Auth = lazy(() => getAuth(getAdminApp()));
export const adminStorage: Storage = lazy(() => getStorage(getAdminApp()));
export default getAdminApp;
