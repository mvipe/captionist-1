'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export function AudioEnhance() {
  return (
    <section className="py-16">
      <div className="container-page surface grid items-center gap-10 p-10 md:grid-cols-2">
        <div>
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
            State of The Art <br />
            <span className="gradient-text">Audio Enhancement!</span>
          </h2>
          <p className="mt-6 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--text)' }}>YesEditor</strong> offers{' '}
            <strong style={{ color: 'var(--text)' }}>Studio Grade Audio Enhancement</strong> using complex{' '}
            <strong style={{ color: 'var(--text)' }}>Algorithms &amp; AI.</strong> Tested for multiple scenarios
            including harsh traffic, white noise, crowds, hiss or any other form of noise pattern.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {['Works in Seconds', 'Realtime Playback', 'Studio Quality'].map((t) => (
              <span
                key={t}
                className="rounded-full border px-4 py-2 text-sm"
                style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="surface relative aspect-[4/3] overflow-hidden" style={{ background: 'var(--bg-soft)' }}>
          <div className="absolute left-4 top-4 rounded-full bg-black/60 px-4 py-1.5 text-sm text-white">
            ● Raw Audio
          </div>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
            <div className="flex h-8 w-16 items-center rounded-full bg-black/70 px-1">
              <div className="h-6 w-6 rounded-full bg-white" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ExportNLE() {
  return (
    <section className="relative overflow-hidden py-24 text-center">
      <div
        className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
        style={{ backgroundSize: '36px 36px' }}
      />
      <div className="container-page relative">
        <h2 className="text-4xl font-extrabold tracking-tight md:text-6xl">
          Export in <span className="gradient-text">SRT or Alpha Channel</span>
        </h2>
        <p className="mx-auto mt-5 max-w-2xl" style={{ color: 'var(--text-muted)' }}>
          For all the Pro-Editors, <strong style={{ color: 'var(--text)' }}>cross NLE support available</strong> to
          bring captions back locally in your own software of choice, either as an Alpha channel or as an SRT file.
        </p>
        <div className="mt-10 flex justify-center">
          <Link href="/sign-in" className="btn-primary shadow-glow">
            Join now <ArrowUpRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Accuracy() {
  return (
    <section className="py-24 text-center">
      <div className="container-page">
        <h2 className="text-5xl font-extrabold leading-tight tracking-tight md:text-7xl">
          &ldquo;Up to <span className="gradient-text">97% Accuracy</span>
          <br />
          in major Desi languages&rdquo;
        </h2>
      </div>
    </section>
  );
}
