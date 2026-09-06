'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export function ExportNLE() {
  return (
    <section className="relative overflow-hidden py-24 text-center">
      <div
        className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
        style={{ backgroundSize: '36px 36px' }}
      />
      <div className="container-page relative">
        <h2 className="text-4xl font-bold tracking-tight md:text-6xl">
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
        <h2 className="text-5xl font-bold leading-tight tracking-tight md:text-7xl">
          &ldquo;Up to <span className="gradient-text">97% Accuracy</span>
          <br />
          in major Desi languages&rdquo;
        </h2>
      </div>
    </section>
  );
}
