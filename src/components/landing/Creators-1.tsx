'use client';

import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, CheckCircle2 } from 'lucide-react';
import type { Creator } from '@/types';
import { DEMO_LANGUAGES, type DemoLanguage } from '@/lib/landingDefaults';

/* ── Favourite creators — semicircle carousel ──────────────────────────────
   Badges ride a shallow semicircular arc: they enter low on the left, rise up
   and over the top, and descend on the right, fading in/out at the ends so the
   loop is invisible. Positions are computed per animation frame from the arc's
   parametric equation, so it stays smooth and responsive at any width. */
const ARC_HEIGHT = 92; // px — how tall the dome is (bigger = more pronounced semicircle)
const CONTAINER_H = 250; // px — vertical room for the arc + badge
const EDGE_MARGIN = 90; // px — keep badges off the container edges
const SPEED = 0.05; // loops per second (per badge)

function CreatorBadge({ c }: { c: Creator }) {
  return (
    <div className="flex w-28 flex-col items-center gap-3">
      <div
        className="h-20 w-20 overflow-hidden rounded-full border"
        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
      >
        {c.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.avatarUrl} alt={c.name} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-xl font-bold gradient-text">
            {c.name.charAt(0)}
          </div>
        )}
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">{c.name}</p>
        {c.subtitle && (
          <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
            {c.subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

export function Creators({ creators }: { creators: Creator[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();

  // Repeat the list so the arc stays populated even with only a few creators.
  const base = creators ?? [];
  const reps = base.length ? Math.max(1, Math.ceil(9 / base.length)) : 0;
  const items = Array.from({ length: reps }, () => base).flat();

  useEffect(() => {
    const track = trackRef.current;
    if (!track || !items.length) return;
    const els = Array.from(track.children) as HTMLElement[];
    const n = els.length;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const place = (progressBase: number) => {
      const W = track.clientWidth || 1;
      const cx = W / 2;
      const Rx = Math.max(120, W / 2 - EDGE_MARGIN);
      els.forEach((el, i) => {
        const p = (progressBase + i / n) % 1; // 0 = left end … 1 = right end
        const theta = Math.PI * (1 - p); // π (left) → 0 (right), over the top
        const sin = Math.sin(theta);
        const x = cx + Rx * Math.cos(theta);
        const itemH = el.offsetHeight || 126;
        const top = CONTAINER_H - itemH - ARC_HEIGHT * sin;
        const scale = 0.82 + 0.18 * sin;
        el.style.left = `${x}px`;
        el.style.top = `${top}px`;
        el.style.transform = `translate(-50%, 0) scale(${scale})`;
        el.style.opacity = String(Math.max(0, Math.min(1, sin * 1.7)));
      });
    };

    if (reduce) {
      place(0);
      return;
    }

    let progress = 0;
    let last = performance.now();
    const frame = (now: number) => {
      progress = (progress + ((now - last) / 1000) * SPEED) % 1;
      last = now;
      place(progress);
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  if (!base.length) return null;

  return (
    <section className="py-20">
      <div className="container-page text-center">
        <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
          Powering teams of your <span className="gradient-text">Favourite Creators</span>
        </h2>
      </div>

      {/* max-w-4xl keeps the arc off the screen edges (padding both sides) */}
      <div
        ref={trackRef}
        className="marquee-mask relative mx-auto mt-8 w-full max-w-4xl overflow-hidden px-4"
        style={{ height: CONTAINER_H }}
      >
        {items.map((c, i) => (
          <div key={`${c.id}-${i}`} className="absolute left-0 top-0 opacity-0 will-change-transform">
            <CreatorBadge c={c} />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── "Select your Language" demo player ───────────────────────────────────
   Only languages that actually have a video are shown, and the exact clip for
   the chosen language + Native/Roman variant is served directly. The video
   starts with sound ON (falling back to muted only if the browser blocks
   audible autoplay), and BOTH the volume button and the native controls toggle
   sound. */
export function LanguageSelect({ languages }: { languages?: DemoLanguage[] }) {
  const langs = languages && languages.length ? languages : DEMO_LANGUAGES;
  const [selectedName, setSelectedName] = useState(langs[0]?.name ?? '');
  const [variant, setVariant] = useState<'native' | 'roman'>('native');
  const [errored, setErrored] = useState(false);
  const [muted, setMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const selected = langs.find((l) => l.name === selectedName) ?? langs[0];
  const hasVariants = !!selected && !selected.single && !!(selected.native && selected.roman);
  const videoSrc = !selected
    ? ''
    : selected.single
      ? selected.single
      : variant === 'roman'
        ? selected.roman || selected.native || ''
        : selected.native || selected.roman || '';

  // Try to autoplay with sound; if the browser refuses, mute and play anyway.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !videoSrc || errored) return;
    v.muted = muted;
    v.play().catch(() => {
      if (!v.muted) {
        v.muted = true;
        setMuted(true);
        v.play().catch(() => {});
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoSrc]);

  const choose = (name: string) => {
    setSelectedName(name);
    setVariant('native');
    setErrored(false);
  };
  const chooseVariant = (mode: 'native' | 'roman') => {
    setVariant(mode);
    setErrored(false);
  };
  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !v.muted;
    v.muted = next;
    setMuted(next);
    if (!next) v.play().catch(() => {});
  };

  return (
    <section className="py-20">
      <div className="container-page grid items-center gap-8 md:grid-cols-2">
        <div className="surface p-8">
          <h3 className="mb-8 text-2xl font-bold">Select your Language</h3>
          <div className="flex flex-wrap gap-3">
            {langs.map((lang) => {
              const active = selected?.name === lang.name;
              return (
                <button
                  key={lang.name}
                  onClick={() => choose(lang.name)}
                  className="flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition"
                  style={{
                    borderColor: active ? 'var(--accent)' : 'var(--border)',
                    color: active ? 'var(--accent)' : 'var(--text)',
                    background: active ? 'rgba(79,140,255,0.12)' : 'transparent',
                  }}
                >
                  {active && <CheckCircle2 size={16} />}
                  {lang.name}
                </button>
              );
            })}
          </div>

          {hasVariants && (
            <div className="mt-5 flex flex-wrap gap-2">
              {(['native', 'roman'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => chooseVariant(mode)}
                  className="rounded-full border px-4 py-2 text-sm font-medium capitalize transition"
                  style={{
                    borderColor: variant === mode ? 'var(--accent)' : 'var(--border)',
                    color: variant === mode ? 'var(--accent)' : 'var(--text)',
                    background: variant === mode ? 'rgba(79,140,255,0.12)' : 'transparent',
                  }}
                >
                  {mode === 'native' ? 'Native' : 'Roman'}
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          className="surface relative aspect-video overflow-hidden rounded-2xl border"
          style={{ borderColor: 'var(--border)' }}
        >
          {!errored && videoSrc && (
            <button
              onClick={toggleMute}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full text-white backdrop-blur transition hover:opacity-90"
              style={{ background: 'rgba(0,0,0,0.55)' }}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} className="text-accent" />}
            </button>
          )}
          {errored || !videoSrc ? (
            <div
              className="grid h-full w-full place-items-center bg-[var(--bg-soft)] px-6 text-center text-sm"
              style={{ color: 'var(--text-muted)' }}
            >
              Video preview is not available for this language yet.
            </div>
          ) : (
            <video
              ref={videoRef}
              key={videoSrc}
              src={videoSrc}
              controls
              autoPlay
              loop
              playsInline
              muted={muted}
              className="h-full w-full object-cover"
              onError={() => setErrored(true)}
            />
          )}
        </div>
      </div>
    </section>
  );
}
