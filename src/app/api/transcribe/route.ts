import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSessionUser } from '@/lib/session';
import { transcribeBuffer } from '@/lib/openai';
import { adminDb } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/lib/collections';
import { PLANS } from '@/types';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const maxDuration = 300; // seconds. Hobby clamps to its plan cap; Pro honors up to 300.

const CACHE_COL = 'transcribecachecaptionist';
const MAX_BYTES = 25 * 1024 * 1024;
/** Bump whenever the transcription/post-processing pipeline changes, so old
 *  cached transcripts (produced by the previous filtering rules) are not
 *  served for a re-uploaded file. v4 = relaxed segment filtering + gap fill;
 *  v5 = partial-gap fill (caption every stretch of trusted speech, not just
 *  fully-uncaptioned segments). */
const TRANSCRIBE_VERSION = 'v5';

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // JSON body now — the video itself is NOT sent here (Vercel caps request
    // bodies at 4.5 MB). We only receive its Storage URL and fetch it server-side.
    const { videoUrl, language, title } = await req.json();
    if (!videoUrl || typeof videoUrl !== 'string') {
      return NextResponse.json({ error: 'videoUrl is required' }, { status: 400 });
    }

    // Only allow the user's own Firebase Storage objects (prevents abuse of
    // transcribing arbitrary third-party audio on your bill).
    const looksLikeFirebase = videoUrl.startsWith('https://firebasestorage.googleapis.com/');
    const ownsPath = videoUrl.includes(encodeURIComponent(`captionist/${user.uid}/`)) ||
      videoUrl.includes(`captionist%2F${user.uid}%2F`);
    if (!looksLikeFirebase || !ownsPath) {
      return NextResponse.json({ error: 'Invalid video URL' }, { status: 400 });
    }

    // Plan limit
    const plan = PLANS.find((p) => p.id === user.plan)!;
    const usedMin = user.usage.transcriptionSecondsUsed / 60;
    if (usedMin >= plan.limits.transcriptionMinutes) {
      return NextResponse.json(
        { error: 'Transcription limit reached for your plan. Please upgrade.' },
        { status: 402 }
      );
    }

    // Download the media from Storage (server-side, no 4.5 MB limit here).
    const mediaRes = await fetch(videoUrl);
    if (!mediaRes.ok) {
      return NextResponse.json({ error: `Could not fetch video (HTTP ${mediaRes.status})` }, { status: 502 });
    }
    const arrayBuf = await mediaRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json(
        { error: `Audio is ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB; Whisper's max is 25 MB. Use a shorter or lower-bitrate clip.` },
        { status: 413 }
      );
    }

    const lang = language === 'auto' ? undefined : language;

    // Cache: transcribing the same audio again (retries, re-uploads) is free.
    const hash = crypto.createHash('sha256').update(buffer).update(`|${lang || 'auto'}|${TRANSCRIBE_VERSION}`).digest('hex');
    const cacheRef = adminDb.collection(CACHE_COL).doc(hash);
    const cached = await cacheRef.get();

    let result: { language: string; duration: number; text: string; segments: any[] };
    if (cached.exists) {
      result = cached.data() as any;
    } else {
      result = await transcribeBuffer(buffer, 'audio.mp4', 'video/mp4', lang);
      await cacheRef.set({ ...result, createdAt: Date.now() }).catch(() => {});
    }

    // Persist project
    const ref = adminDb.collection(COLLECTIONS.projects).doc();
    const now = Date.now();
    const project = {
      uid: user.uid,
      title: title || 'Untitled',
      videoUrl,
      language: result.language,
      status: 'ready' as const,
      transcript: { text: result.text, segments: result.segments },
      durationSeconds: result.duration,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(project);

    // Count usage only when we actually spent an API call (not on cache hits).
    if (!cached.exists) {
      await adminDb.collection(COLLECTIONS.users).doc(user.uid).update({
        'usage.transcriptionSecondsUsed': FieldValue.increment(Math.round(result.duration)),
        updatedAt: now,
      });
    }

    return NextResponse.json({ project: { id: ref.id, ...project } });
  } catch (e: any) {
    console.error('[transcribe] error:', e?.message, e?.cause || '');
    return NextResponse.json({ error: e?.message || 'Transcription failed' }, { status: 500 });
  }
}