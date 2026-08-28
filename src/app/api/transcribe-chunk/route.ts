import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSessionUser } from '@/lib/session';
import { transcribeBuffer } from '@/lib/openai';
import { adminDb } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/lib/collections';
import { PLANS } from '@/types';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const maxDuration = 60; // one ~8-min audio chunk transcribes well within this

const CACHE_COL = 'transcribecachecaptionist';
const MAX_BYTES = 25 * 1024 * 1024;
/** Bump whenever the transcription/post-processing pipeline changes, so old
 *  cached transcripts (produced by the previous filtering rules) are not
 *  served for a re-uploaded file. v4 = relaxed segment filtering + gap fill. */
const TRANSCRIBE_VERSION = 'v4';

/**
 * Transcribes ONE audio chunk (uploaded to Storage by the client) and returns
 * its segments. The client calls this once per chunk for large videos, offsets
 * the timestamps, merges, then creates the project via POST /api/projects.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { audioUrl, language } = await req.json();
    if (!audioUrl || typeof audioUrl !== 'string') {
      return NextResponse.json({ error: 'audioUrl is required' }, { status: 400 });
    }
    const looksLikeFirebase = audioUrl.startsWith('https://firebasestorage.googleapis.com/');
    const ownsPath = audioUrl.includes(encodeURIComponent(`captionist/${user.uid}/`)) ||
      audioUrl.includes(`captionist%2F${user.uid}%2F`);
    if (!looksLikeFirebase || !ownsPath) {
      return NextResponse.json({ error: 'Invalid audio URL' }, { status: 400 });
    }

    const plan = PLANS.find((p) => p.id === user.plan)!;
    if (user.usage.transcriptionSecondsUsed / 60 >= plan.limits.transcriptionMinutes) {
      return NextResponse.json({ error: 'Transcription limit reached for your plan. Please upgrade.' }, { status: 402 });
    }

    const mediaRes = await fetch(audioUrl);
    if (!mediaRes.ok) return NextResponse.json({ error: `Could not fetch audio (HTTP ${mediaRes.status})` }, { status: 502 });
    const buffer = Buffer.from(await mediaRes.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: 'Audio chunk exceeds 25 MB' }, { status: 413 });
    }

    const lang = language === 'auto' ? undefined : language;
    const hash = crypto.createHash('sha256').update(buffer).update(`|${lang || 'auto'}|${TRANSCRIBE_VERSION}`).digest('hex');
    const cacheRef = adminDb.collection(CACHE_COL).doc(hash);
    const cached = await cacheRef.get();

    let result: { language: string; duration: number; text: string; segments: any[] };
    if (cached.exists) {
      result = cached.data() as any;
    } else {
      result = await transcribeBuffer(buffer, 'audio.mp3', 'audio/mpeg', lang);
      await cacheRef.set({ ...result, createdAt: Date.now() }).catch(() => {});
      await adminDb.collection(COLLECTIONS.users).doc(user.uid).update({
        'usage.transcriptionSecondsUsed': FieldValue.increment(Math.round(result.duration)),
        updatedAt: Date.now(),
      });
    }

    return NextResponse.json({ language: result.language, duration: result.duration, segments: result.segments });
  } catch (e: any) {
    console.error('[transcribe-chunk] error:', e?.message);
    return NextResponse.json({ error: e?.message || 'Transcription failed' }, { status: 500 });
  }
}