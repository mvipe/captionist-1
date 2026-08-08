import { NextRequest, NextResponse } from 'next/server';
import { verifyOtp, normalizeMobile } from '@/lib/msg91';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/lib/collections';
import { newUserDoc, isAdminIdentity } from '@/lib/userDoc';
import type { UserRecord } from 'firebase-admin/auth';

export async function POST(req: NextRequest) {
  try {
    const { phone, otp, mode, name, email, password } = await req.json();
    if (!phone || !otp) {
      return NextResponse.json({ error: 'phone and otp required' }, { status: 400 });
    }

    const verification = await verifyOtp(phone, otp);
    if (!verification.success) {
      return NextResponse.json({ error: verification.message }, { status: 401 });
    }

    const normalized = '+' + normalizeMobile(phone);

    // Is there already a Captionist profile for this phone?
    const snap = await adminDb
      .collection(COLLECTIONS.users)
      .where('phone', '==', normalized)
      .limit(1)
      .get();

    let uid: string;

    if (!snap.empty) {
      // LOGIN path — Captionist profile already exists.
      uid = snap.docs[0].id;
    } else {
      // SIGNUP path (no Captionist profile yet).
      //
      // Firebase Authentication is shared across the ENTIRE project, so this
      // phone may already belong to an auth user created by the other website.
      // Reuse that identity instead of creating a duplicate (which would throw
      // auth/phone-number-already-exists). This gives the user one shared login
      // across both products, with separate Firestore profiles per product.
      let authUser: UserRecord | null = null;
      try {
        authUser = await adminAuth.getUserByPhoneNumber(normalized);
      } catch {
        authUser = null; // not found — we'll create it below
      }

      if (!authUser) {
        // Brand-new identity for the whole project.
        const createParams: {
          phoneNumber: string;
          displayName?: string;
          email?: string;
          password?: string;
        } = { phoneNumber: normalized };
        if (name) createParams.displayName = name;
        if (email) createParams.email = email;
        if (password) createParams.password = password;

        try {
          authUser = await adminAuth.createUser(createParams);
        } catch (err: any) {
          if (err?.code === 'auth/phone-number-already-exists') {
            // Race: someone created it between our lookup and create.
            authUser = await adminAuth.getUserByPhoneNumber(normalized);
          } else if (err?.code === 'auth/email-already-exists') {
            // Email belongs to a different identity — create phone-only and let
            // the user attach an email later from Settings.
            authUser = await adminAuth.createUser({
              phoneNumber: normalized,
              ...(name ? { displayName: name } : {}),
            });
          } else {
            throw err;
          }
        }
      } else if (password || (email && !authUser.email)) {
        // Existing shared identity: optionally attach a password/email so the
        // user can also use email login in Captionist. We DON'T overwrite an
        // email the other site already set (that auth user is shared).
        const update: { password?: string; email?: string } = {};
        if (password) update.password = password;
        if (email && !authUser.email) update.email = email;
        try {
          authUser = await adminAuth.updateUser(authUser.uid, update);
        } catch {
          /* non-fatal: keep going with the existing identity */
        }
      }

      uid = authUser!.uid;

      // Create the Captionist profile — but never clobber an existing one
      // (e.g. if this auth account previously signed into Captionist via Google).
      const docRef = adminDb.collection(COLLECTIONS.users).doc(uid);
      const existing = await docRef.get();
      if (existing.exists) {
        await docRef.update({ phone: normalized, updatedAt: Date.now() });
      } else {
        await docRef.set(
          newUserDoc({
            uid,
            name: name || authUser!.displayName || 'Creator',
            email: email || authUser!.email || '',
            phone: normalized,
          })
        );
      }
    }

    // Re-evaluate admin status on every login so existing accounts get promoted
    // when ADMIN_EMAILS / ADMIN_PHONES change — no need to recreate the user.
    const profileRef = adminDb.collection(COLLECTIONS.users).doc(uid);
    const profileSnap = await profileRef.get();
    const profile = (profileSnap.data() || {}) as { email?: string; role?: string };
    if (
      isAdminIdentity({ email: profile.email || email, phone: normalized }) &&
      profile.role !== 'admin'
    ) {
      await profileRef.update({ role: 'admin', updatedAt: Date.now() });
    }

    const customToken = await adminAuth.createCustomToken(uid);
    return NextResponse.json({ success: true, customToken, uid });
  } catch (e: any) {
    console.error('[verify-otp] error:', e);
    return NextResponse.json({ error: e?.message || 'Verification failed' }, { status: 500 });
  }
}