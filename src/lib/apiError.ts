import { NextResponse } from 'next/server';

/**
 * A configuration problem (missing / malformed environment variable) as opposed
 * to a genuine runtime failure.
 *
 * These are surfaced to the client as HTTP 503 + a machine-readable `code`, so
 * "the server is misconfigured" never again looks like an anonymous 500 in the
 * browser console.
 *
 * NOTE: we tag with a plain boolean property instead of relying on
 * `instanceof`. Next.js can bundle the same module into several server chunks,
 * which makes cross-chunk `instanceof` checks unreliable.
 */
export class ConfigError extends Error {
  readonly isConfigError = true;
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ConfigError';
    this.code = code;
  }
}

export function isConfigError(e: unknown): e is ConfigError {
  return !!e && typeof e === 'object' && (e as { isConfigError?: boolean }).isConfigError === true;
}

/**
 * Uniform error response for API route catch blocks.
 *
 *   catch (e) { return errorResponse(e, '[send-otp]'); }
 */
export function errorResponse(e: unknown, tag = '[api]', fallback = 'Something went wrong') {
  const err = e as { message?: string; code?: string; stack?: string };

  if (isConfigError(e)) {
    // Log loudly — this one is on us, not the user.
    console.error(`${tag} CONFIG ERROR [${e.code}]: ${e.message}`);
    return NextResponse.json(
      { error: e.message, code: e.code, configError: true },
      { status: 503 }
    );
  }

  console.error(`${tag} unexpected error:`, err?.stack || err?.message || e);
  return NextResponse.json(
    { error: err?.message || fallback, code: err?.code || 'INTERNAL' },
    { status: 500 }
  );
}
