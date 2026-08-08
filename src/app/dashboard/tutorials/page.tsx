'use client';

import { useEffect, useState } from 'react';
import { Search, Play, Maximize2, Volume2, Settings } from 'lucide-react';
import type { Tutorial } from '@/types';

export default function TutorialsPage() {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/tutorials');
      if (res.ok) setTutorials((await res.json()).tutorials);
    })();
  }, []);

  const filtered = tutorials.filter((t) => t.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <div>
          <h1 className="text-6xl font-extrabold leading-[0.95] tracking-tight">
            <span style={{ color: 'var(--text)' }}>YesEditor</span>
            <br />
            <span className="gradient-text">Academy</span>
          </h1>
          <p className="mt-6 text-lg" style={{ color: 'var(--text-muted)' }}>
            Learn to use YesEditor from the most Famous Editor of South Asia & Founder of Editing Skool
          </p>
        </div>
        <div className="surface relative aspect-video overflow-hidden" style={{ background: 'var(--bg-soft)' }}>
          <div className="absolute inset-0 grid place-items-center">
            <button className="grid h-16 w-16 place-items-center rounded-full bg-white/10 backdrop-blur">
              <Play size={26} className="ml-1 text-white" />
            </button>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 p-4">
            <Play size={16} className="text-white" />
            <div className="h-1 flex-1 rounded-full bg-white/20">
              <div className="h-full w-0 rounded-full" style={{ background: 'var(--accent)' }} />
            </div>
            <span className="text-xs text-white">05:50</span>
            <Volume2 size={16} className="text-white" />
            <Settings size={16} className="text-white" />
            <Maximize2 size={16} className="text-white" />
          </div>
        </div>
      </div>

      {/* Library */}
      <div>
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-3xl font-extrabold">Video Library</h2>
          <div className="surface flex items-center gap-2 px-4 py-2.5" style={{ background: 'var(--bg-soft)' }}>
            <Search size={16} style={{ color: 'var(--text-muted)' }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by lesson"
              className="bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((t) => (
            <div key={t.id} className="group cursor-pointer">
              <div
                className="surface relative aspect-video overflow-hidden"
                style={{ background: 'linear-gradient(135deg, rgba(79,140,255,0.15), var(--bg-soft))' }}
              >
                {t.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                )}
                <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
                  {t.duration}
                </span>
                <div className="absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-black/60 text-white">
                    <Play size={20} className="ml-0.5" />
                  </div>
                </div>
              </div>
              <p className="mt-2.5 font-semibold leading-snug">{t.title}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
