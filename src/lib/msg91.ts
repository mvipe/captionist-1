/**
 * MSG91 OTP integration.
 *
 * Uses the MSG91 OTP API. Flow mirrors the standardized Baba-family pattern:
 *   - validate registration status BEFORE sending an SMS (see auth routes)
 *   - send OTP
 *   - verify OTP
 *
 * Required env:
 *   MSG91_AUTH_KEY
 *   MSG91_OTP_TEMPLATE_ID
 *   MSG91_SENDER_ID (optional, depending on template)
 *
 * Every function returns { success, message } and NEVER throws for a config or
 * network problem — the auth routes turn those into a specific HTTP status
 * instead of an opaque 500.
 */

const BASE = 'https://control.msg91.com/api/v5';
const TIMEOUT_MS = Number(process.env.MSG91_TIMEOUT_MS || 15000);

type Result = { success: boolean; message: string; code?: string };

function missingConfig(): Result | null {
  if (!process.env.MSG91_AUTH_KEY) {
    return {
      success: false,
      code: 'MSG91_AUTH_KEY_MISSING',
      message: 'MSG91_AUTH_KEY is not set on the server',
    };
  }
  if (!process.env.MSG91_OTP_TEMPLATE_ID) {
    return {
      success: false,
      code: 'MSG91_TEMPLATE_MISSING',
      message: 'MSG91_OTP_TEMPLATE_ID is not set on the server',
    };
  }
  return null;
}

/** Normalize an Indian mobile number to MSG91 format (countrycode + number, no +). */
export function normalizeMobile(raw: string, defaultCountry = '91'): string {
  let n = raw.replace(/[^\d]/g, '');
  if (n.length === 10) n = defaultCountry + n;
  return n;
}

/**
 * fetch with an explicit timeout. On a self-hosted box with a restrictive
 * egress firewall, an un-timed fetch to control.msg91.com hangs until the
 * platform gateway kills the request — which looks like a random 500/504.
 */
async function msg91Fetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

function networkFailure(e: unknown): Result {
  const err = e as { name?: string; message?: string; cause?: { code?: string } };
  if (err?.name === 'AbortError') {
    return {
      success: false,
      code: 'MSG91_TIMEOUT',
      message:
        `MSG91 did not respond within ${TIMEOUT_MS}ms. If this only happens on your own ` +
        'server, check that outbound HTTPS to control.msg91.com is allowed by the firewall.',
    };
  }
  const cause = err?.cause?.code ? ` (${err.cause.code})` : '';
  return {
    success: false,
    code: 'MSG91_NETWORK',
    message:
      `Could not reach MSG91: ${err?.message || 'network error'}${cause}. ` +
      'Check the server\'s outbound network access and DNS.',
  };
}

export async function sendOtp(mobile: string): Promise<Result> {
  const bad = missingConfig();
  if (bad) return bad;

  const number = normalizeMobile(mobile);

  const url = new URL(`${BASE}/otp`);
  url.searchParams.set('template_id', process.env.MSG91_OTP_TEMPLATE_ID!);
  url.searchParams.set('mobile', number);
  if (process.env.MSG91_SENDER_ID) {
    url.searchParams.set('sender', process.env.MSG91_SENDER_ID);
  }
  url.searchParams.set('otp_length', '6');

  let data: { type?: string; message?: string } = {};
  try {
    const res = await msg91Fetch(url.toString(), {
      method: 'POST',
      headers: {
        authkey: process.env.MSG91_AUTH_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    data = await res.json().catch(() => ({}));
  } catch (e) {
    return networkFailure(e);
  }

  if (data.type === 'success') {
    return { success: true, message: 'OTP sent' };
  }
  // MSG91 puts the real reason in `message` (e.g. template not approved, invalid authkey)
  return {
    success: false,
    code: 'MSG91_REJECTED',
    message: typeof data.message === 'string' ? data.message : 'Failed to send OTP',
  };
}

export async function verifyOtp(mobile: string, otp: string): Promise<Result> {
  const bad = missingConfig();
  if (bad) return bad;

  const number = normalizeMobile(mobile);
  const url = new URL(`${BASE}/otp/verify`);
  url.searchParams.set('mobile', number);
  url.searchParams.set('otp', otp);

  let data: { type?: string; message?: string } = {};
  try {
    const res = await msg91Fetch(url.toString(), {
      method: 'GET',
      headers: { authkey: process.env.MSG91_AUTH_KEY! },
    });
    data = await res.json().catch(() => ({}));
  } catch (e) {
    return networkFailure(e);
  }

  if (data.type === 'success') {
    return { success: true, message: 'OTP verified' };
  }
  return {
    success: false,
    code: 'MSG91_INVALID_OTP',
    message: typeof data.message === 'string' ? data.message : 'Invalid OTP',
  };
}

export async function resendOtp(mobile: string, type: 'text' | 'voice' = 'text'): Promise<Result> {
  const bad = missingConfig();
  if (bad) return bad;

  const number = normalizeMobile(mobile);
  const url = new URL(`${BASE}/otp/retry`);
  url.searchParams.set('mobile', number);
  url.searchParams.set('retrytype', type);

  let data: { type?: string; message?: string } = {};
  try {
    const res = await msg91Fetch(url.toString(), {
      method: 'GET',
      headers: { authkey: process.env.MSG91_AUTH_KEY! },
    });
    data = await res.json().catch(() => ({}));
  } catch (e) {
    return networkFailure(e);
  }

  return {
    success: data.type === 'success',
    message: data.message || (data.type === 'success' ? 'OTP resent' : 'Failed to resend'),
  };
}

/** Non-throwing config probe for /api/health/env. Never returns the key itself. */
export function inspectMsg91() {
  const bad = missingConfig();
  return {
    ok: !bad,
    authKey: !!process.env.MSG91_AUTH_KEY,
    templateId: !!process.env.MSG91_OTP_TEMPLATE_ID,
    senderId: !!process.env.MSG91_SENDER_ID,
    ...(bad ? { code: bad.code, message: bad.message } : {}),
  };
}
