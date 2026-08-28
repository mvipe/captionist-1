import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { adminDb } from '@/lib/firebaseAdmin';
import { sanitizeAnimationCss } from '@/lib/capAnim';

export const runtime = 'nodejs';

const COL = 'useranimationscaptionist';
const MAX_PER_USER = 40;

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const snap = await adminDb.collection(COL).where('uid', '==', user.uid).orderBy('createdAt', 'desc').limit(MAX_PER_USER).get();
  return NextResponse.json({ animations: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
}

/**
 * Stores a user-authored caption animation.
 * Body: { name, css, keyframe?, duration? } — `css` is the raw contents of the
 * uploaded .css file. It is sanitised server-side as well as client-side so a
 * crafted request can't put arbitrary CSS in front of other users.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { name, css, keyframe, duration } = await req.json();
    if (!name || typeof name !== 'string') return NextResponse.json({ error: 'name is required' }, { status: 400 });
    if (!css || typeof css !== 'string') return NextResponse.json({ error: 'css is required' }, { status: 400 });

    let clean;
    try { clean = sanitizeAnimationCss(css); }
    catch (e: any) { return NextResponse.json({ error: e?.message || 'Invalid animation CSS' }, { status: 400 }); }

    const chosen = typeof keyframe === 'string' && clean.names.includes(keyframe) ? keyframe : clean.names[0];
    const dur = Number(duration);

    const existing = await adminDb.collection(COL).where('uid', '==', user.uid).count().get().catch(() => null);
    if (existing && existing.data().count >= MAX_PER_USER) {
      return NextResponse.json({ error: `You can store up to ${MAX_PER_USER} animations. Delete one first.` }, { status: 400 });
    }

    const doc = {
      uid: user.uid,
      name: name.replace(/['"<>]/g, '').slice(0, 40) || 'My animation',
      css: clean.css,
      keyframe: chosen,
      keyframes: clean.names,
      duration: isFinite(dur) && dur > 0 ? Math.min(5, Math.max(0.1, dur)) : 0.5,
      createdAt: Date.now(),
    };
    const ref = await adminDb.collection(COL).add(doc);
    return NextResponse.json({ animation: { id: ref.id, ...doc } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Save failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const ref = adminDb.collection(COL).doc(id);
  const doc = await ref.get();
  if (!doc.exists || doc.data()?.uid !== user.uid) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await ref.delete();
  return NextResponse.json({ ok: true });
}
