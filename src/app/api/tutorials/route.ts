import { NextResponse } from 'next/server';

const DEFAULT_TUTORIALS = [
  { id: 'd1', title: "Roman vs Native, what's the difference?", duration: '3:17', videoUrl: '', order: 1, createdAt: 0 },
  { id: 'd2', title: 'State of the Art Audio Cleaning inside YesEditor!', duration: '3:16', videoUrl: '', order: 2, createdAt: 0 },
  { id: 'd3', title: 'How to add captions manually inside YesEditor?', duration: '1:39', videoUrl: '', order: 3, createdAt: 0 },
  { id: 'd4', title: 'How to save Presets of Templates & Settings!', duration: '2:56', videoUrl: '', order: 4, createdAt: 0 },
  { id: 'd5', title: 'A Guide to Transitions Panel', duration: '3:28', videoUrl: '', order: 5, createdAt: 0 },
  { id: 'd6', title: 'Add any Custom Font in YesEditor - Breakdown', duration: '2:12', videoUrl: '', order: 6, createdAt: 0 },
  { id: 'd7', title: 'Understanding Vertical vs Horizontal Video', duration: '2:14', videoUrl: '', order: 7, createdAt: 0 },
  { id: 'd8', title: 'Difference Between Alpha Channel & SRT', duration: '4:14', videoUrl: '', order: 8, createdAt: 0 },
];

export async function GET() {
  try {
    const { adminDb } = await import('@/lib/firebaseAdmin');
    const { COLLECTIONS } = await import('@/lib/collections');
    const snap = await adminDb.collection(COLLECTIONS.tutorials).orderBy('order').get();
    if (snap.empty) return NextResponse.json({ tutorials: DEFAULT_TUTORIALS });
    return NextResponse.json({ tutorials: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch {
    return NextResponse.json({ tutorials: DEFAULT_TUTORIALS });
  }
}
