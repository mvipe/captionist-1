'use client';

import { DEFAULT_TEMPLATE_VIDEOS, type TemplateVideo } from '@/lib/landingDefaults';

/* ── "All your Favourite Templates" — fanned gallery of caption previews ────
   Cards are admin-managed (Content → Landing Videos, section = "templates");
   falls back to the bundled language demos so the section is never empty. */

function Card({ t, className, style }: { t: TemplateVideo; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`relative aspect-[9/16] overflow-hidden rounded-2xl border shadow-2xl ${className ?? ''}`}
      style={{ borderColor: 'var(--border)', background: 'var(--bg-soft)', ...style }}
    >
      <video
        src={t.videoUrl}
        poster={t.posterUrl}
        muted
        loop
        autoPlay
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
      />
      {t.title && (
        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
          {t.title}
        </span>
      )}
    </div>
  );
}

export default function Templates({ videos }: { videos?: TemplateVideo[] }) {
  const items = (videos && videos.length ? videos : DEFAULT_TEMPLATE_VIDEOS).slice(0, 9);
  if (!items.length) return null;

  const mid = (items.length - 1) / 2;
  const many = items.length > 5;
  const ANGLE = many ? 3.5 : 7; // deg of tilt per step out from centre
  const LIFT = many ? 11 : 18; // px each side card drops
  const OVERLAP = many ? -34 : -18; // px cards overlap (tighter when there are many)

  return (
    // overflowX:clip stops the tilted cards causing a horizontal scrollbar while
    // still letting them show fully (the old overflow-hidden clipped their tops).
    <section className="py-24" style={{ overflowX: 'clip' }}>
      <div className="container-page text-center">
        <h2 className="text-4xl font-bold tracking-tight md:text-6xl">
          All your Favourite <span className="gradient-text">Templates</span>
        </h2>
        <p className="mx-auto mt-5 max-w-2xl" style={{ color: 'var(--text-muted)' }}>
          Dozens of fully <strong style={{ color: 'var(--text)' }}>customizable templates</strong> in every desi language.
        </p>
      </div>

      {/* Fanned layout on md+ — centred with side padding, middle card upright */}
      <div className="mx-auto mt-16 hidden max-w-5xl items-center justify-center px-6 md:flex">
        {items.map((t, i) => {
          const offset = i - mid;
          const a = Math.abs(offset);
          return (
            <Card
              key={i}
              t={t}
              className="w-40 shrink-0 origin-bottom"
              style={{
                transform: `rotate(${offset * ANGLE}deg) translateY(${a * LIFT}px) scale(${1.04 - a * 0.02})`,
                zIndex: 100 - a,
                marginLeft: OVERLAP,
                marginRight: OVERLAP,
              }}
            />
          );
        })}
      </div>

      {/* Horizontal scroll on mobile */}
      <div className="mt-12 flex gap-4 overflow-x-auto px-5 pb-4 md:hidden">
        {items.map((t, i) => (
          <Card key={i} t={t} className="w-40 shrink-0" />
        ))}
      </div>
    </section>
  );
}
