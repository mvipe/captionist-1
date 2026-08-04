import { NextRequest, NextResponse } from 'next/server';
import { sendOtp, normalizeMobile } from '@/lib/msg91';
import { adminDb } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/lib/collections';

export async function POST(req: NextRequest) {
  try {
    // Read the raw body first so we can sanitize it before parsing
    let raw = await req.text();

    // Strip a leading BOM / zero-width chars that some browser extensions inject
    raw = raw.replace(/^\uFEFF/, '').replace(/^\u200B/, '').trim();

    if (!raw) {
      return NextResponse.json({ error: 'Empty request body' }, { status: 400 });
    }

    let body: { phone?: string; mode?: string };
    try {
      body = JSON.parse(raw);
    } catch {
      console.error('[send-otp] malformed body:', JSON.stringify(raw.slice(0, 300)));
      console.error('[send-otp] content-type:', req.headers.get('content-type'));
      return NextResponse.json({ error: 'Malformed request body' }, { status: 400 });
    }

    const { phone, mode } = body;
    if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 });

    const normalized = '+' + normalizeMobile(phone);

    const snap = await adminDb
      .collection(COLLECTIONS.users)
      .where('phone', '==', normalized)
      .limit(1)
      .get();

    const registered = !snap.empty;

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
      console.error('[send-otp] MSG91 failure:', result.message);
      return NextResponse.json({ error: result.message }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[send-otp] unexpected error:', e);
    return NextResponse.json(
      { error: e?.message || 'Failed to send OTP' },
      { status: 500 }
    );
  }
}
