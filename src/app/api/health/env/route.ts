import { NextRequest, NextResponse } from 'next/server';
import { inspectAdminCredentials, adminDb } from '@/lib/firebaseAdmin';
import { inspectMsg91 } from '@/lib/msg91';
import { COLLECTIONS } from '@/lib/collections';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Deployment self-check.
 *
 *   GET /api/health/env                      -> booleans only (safe to hit publicly)
 *   GET /api/health/env?key=$DIAGNOSTICS_KEY -> adds error messages + project id
 *
 * Never returns a secret value — only whether each variable is present, and
 * whether the credentials it produces actually work against Firestore.
 *
 * This is the fastest way to answer "why does OTP work on Vercel but 500 on my
 * own server?": if `firebase.credentials` is false here, the server process
 * simply never received the env file.
 */
export async function GET(req: NextRequest) {
  const diagKey = process.env.DIAGNOSTICS_KEY;
  const supplied = req.nextUrl.searchParams.get('key');
  const verbose = process.env.NODE_ENV !== 'production' || (!!diagKey && supplied === diagKey);

  const present = (name: string) => !!(process.env[name] && process.env[name]!.trim());

  const env = {
    FIREBASE_SERVICE_ACCOUNT_B64: present('FIREBASE_SERVICE_ACCOUNT_B64'),
    FIREBASE_SERVICE_ACCOUNT: present('FIREBASE_SERVICE_ACCOUNT'),
    FIREBASE_SERVICE_ACCOUNT_PATH: present('FIREBASE_SERVICE_ACCOUNT_PATH'),
    FIREBASE_PROJECT_ID: present('FIREBASE_PROJECT_ID'),
    FIREBASE_CLIENT_EMAIL: present('FIREBASE_CLIENT_EMAIL'),
    FIREBASE_PRIVATE_KEY: present('FIREBASE_PRIVATE_KEY'),
    FIREBASE_STORAGE_BUCKET: present('FIREBASE_STORAGE_BUCKET'),
    MSG91_AUTH_KEY: present('MSG91_AUTH_KEY'),
    MSG91_OTP_TEMPLATE_ID: present('MSG91_OTP_TEMPLATE_ID'),
    MSG91_SENDER_ID: present('MSG91_SENDER_ID'),
    OPENAI_API_KEY: present('OPENAI_API_KEY'),
    RAZORPAY_KEY_ID: present('RAZORPAY_KEY_ID'),
    RAZORPAY_KEY_SECRET: present('RAZORPAY_KEY_SECRET'),
    NEXT_PUBLIC_FIREBASE_API_KEY: present('NEXT_PUBLIC_FIREBASE_API_KEY'),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: present('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
    NEXT_PUBLIC_RAZORPAY_KEY_ID: present('NEXT_PUBLIC_RAZORPAY_KEY_ID'),
  };

  // 1. Can we even build a credential object?
  const creds = inspectAdminCredentials();

  // 2. Do those credentials actually work? (catches revoked keys, wrong
  //    project, blocked egress to googleapis.com)
  let firestore: { ok: boolean; code?: string; message?: string } = {
    ok: false,
    code: 'NOT_ATTEMPTED',
  };
  if (creds.ok) {
    try {
      await adminDb.collection(COLLECTIONS.users).limit(1).get();
      firestore = { ok: true };
    } catch (e) {
      const err = e as { code?: string; message?: string };
      firestore = {
        ok: false,
        code: String(err?.code || 'FIRESTORE_ERROR'),
        message: err?.message || 'Firestore query failed',
      };
    }
  }

  const msg91 = inspectMsg91();

  const ok = creds.ok && firestore.ok && msg91.ok;

  const body: Record<string, unknown> = {
    ok,
    node: process.version,
    nodeEnv: process.env.NODE_ENV,
    env,
    firebase: {
      credentials: creds.ok,
      source: creds.ok ? creds.source : undefined,
      firestore: firestore.ok,
    },
    msg91: {
      ok: msg91.ok,
      authKey: msg91.authKey,
      templateId: msg91.templateId,
      senderId: msg91.senderId,
    },
  };

  if (verbose) {
    body.detail = {
      cwd: process.cwd(),
      firebase: creds.ok
        ? { projectId: creds.projectId, clientEmail: creds.clientEmail }
        : { code: creds.code, message: creds.message },
      firestore,
      msg91: 'code' in msg91 ? { code: msg91.code, message: msg91.message } : 'ok',
    };
  } else if (!ok) {
    body.hint =
      'Set DIAGNOSTICS_KEY in the server environment and call this endpoint with ?key=<value> for full error messages.';
  }

  return NextResponse.json(body, {
    status: ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
