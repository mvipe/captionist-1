import { NextRequest, NextResponse } from 'next/server';
import { sendOtp, normalizeMobile } from '@/lib/msg91';
import { adminDb } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/lib/collections';
import { errorResponse, ConfigError } from '@/lib/apiError';

// firebase-admin needs the Node runtime, and this route must never be
// statically evaluated at build time.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    let body: { phone?: string; mode?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    const { phone, mode } = body;
    if (!phone) {
      return NextResponse.json({ error: 'phone required', code: 'PHONE_REQUIRED' }, { status: 400 });
    }

    const digits = normalizeMobile(phone);
    if (digits.length < 10) {
      return NextResponse.json(
        { error: 'Enter a valid mobile number', code: 'PHONE_INVALID' },
        { status: 400 }
      );
    }
    const normalized = '+' + digits;

    // Registration lookup. A failure here is almost always a Firebase config
    // problem on this host (see firebaseAdmin.ts) — surface it as such rather
    // than letting it fall through as a nameless 500.
    let registered: boolean;
    try {
      const snap = await adminDb
        .collection(COLLECTIONS.users)
        .where('phone', '==', normalized)
        .limit(1)
        .get();
      registered = !snap.empty;
    } catch (e) {
      const err = e as { isConfigError?: boolean; code?: string; message?: string };
      if (err?.isConfigError) throw e;
      // Real Firestore/runtime failure (permissions, network, disabled API…)
      throw new ConfigError(
        'FIRESTORE_UNAVAILABLE',
        `Could not reach Firestore from this server: ${err?.message || 'unknown error'}` +
          (err?.code ? ` [${err.code}]` : '')
      );
    }

    // Redirect wrong-mode users before sending an SMS
    if (mode === 'login' && !registered) {
      return NextResponse.json(
        { error: 'No account found with this number. Please sign up.', wrongMode: true },
        { status: 409 }
      );
    }
    if (mode === 'signup' && registered) {
      return NextResponse.json(
        { error: 'This number is already registered. Please log in.', wrongMode: true },
        { status: 409 }
      );
    }

    const result = await sendOtp(phone);
    if (!result.success) {
      console.error(`[send-otp] MSG91 failure [${result.code}]: ${result.message}`);
      // Missing MSG91 env vars are a server misconfiguration (503), not a
      // bad-gateway response from MSG91 (502).
      const isConfig = result.code === 'MSG91_AUTH_KEY_MISSING' || result.code === 'MSG91_TEMPLATE_MISSING';
      return NextResponse.json(
        { error: result.message, code: result.code, configError: isConfig },
        { status: isConfig ? 503 : 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e, '[send-otp]', 'Failed to send OTP');
  }
}
