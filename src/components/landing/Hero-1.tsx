'use client';

import Link from 'next/link';
import { ArrowUpRight, Star } from 'lucide-react';

export default function Hero() {
  return (
    <section id="about" className="relative overflow-hidden pt-24 pb-20">
      <div className="pointer-events-none absolute inset-0 hero-grid-overlay" />
      <div className="container-page relative text-center">
        <h1 className="mx-auto max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
          <span className="gradient-text">Captioning</span>{' '}
          <span style={{ color: 'var(--text)' }}>Software, Made by Desi Creators, For Desi Creators</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg" style={{ color: 'var(--text-muted)' }}>
          Auto-generate accurate captions in all major <strong style={{ color: 'var(--text)' }}>desi languages</strong> in seconds
        </p>
        <div className="mt-10 flex justify-center">
          <Link href="/sign-in" className="btn-primary text-base shadow-glow">
            Get started now <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="mt-12">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
            Trusted by over 100,000 Users
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} size={16} className="fill-amber-400 text-amber-400" />
            ))}
            <span className="ml-1 font-semibold">4.9</span>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>/5 on Google</span>
          </div>
        </div>
      </div>
    </section>
  );
}
