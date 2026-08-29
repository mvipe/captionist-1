'use client';

import { useEffect, useMemo, useState } from 'react';
import { Volume2, CheckCircle2 } from 'lucide-react';
import type { Creator } from '@/types';
import { LANGUAGES } from '@/lib/landingDefaults';

export function Creators({ creators }: { creators: Creator[] }) {
  return (
    <section className="py-20">
      <div className="container-page text-center">
        <h2 className="text-4xl font-extrabold tracking-tight md:text-5xl">
          Powering teams of your <span className="gradient-text">Favorite Creators</span>
        </h2>
        <div className="mt-14 flex flex-wrap items-center justify-center gap-x-10 gap-y-8">
          {creators.map((c) => (
            <div key={c.id} className="flex flex-col items-center gap-3">
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
                <p className="font-medium">{c.name}</p>
                {c.subtitle && (
                  <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                    {c.subtitle}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LanguageSelect() {
  const [selected, setSelected] = useState('English');
  const [variant, setVariant] = useState<'native' | 'roman'>('native');
  const [videoSrc, setVideoSrc] = useState('/videos/english-landing.mp4');
  const [videoError, setVideoError] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);

  const videoCandidates = useMemo(() => {
    if (selected === 'English') {
      return ['/videos/english-landing.mp4'];
    }

    const langKey = selected.toLowerCase().replace(/\s+/g, '-');
    const base = `/videos/${langKey}-landing`;
    return [
      `${base}.mp4`,
      `${base}-${variant}.mp4`,
      `${base}-roman.mp4`,
      `${base}-native.mp4`,
      '/videos/english-landing.mp4',
    ];
  }, [selected, variant]);

  useEffect(() => {
    setCandidateIndex(0);
    setVideoSrc(videoCandidates[0]);
    setVideoError(false);
  }, [selected, variant, videoCandidates]);

  const handleVideoError = () => {
    const nextIndex = candidateIndex + 1;
    const nextSrc = videoCandidates[nextIndex];

    if (nextSrc) {
      setCandidateIndex(nextIndex);
      setVideoSrc(nextSrc);
      setVideoError(false);
      return;
    }

    setVideoError(true);
  };

  const isNonEnglish = selected !== 'English';

  return (
    <section className="py-20">
      <div className="container-page grid items-center gap-8 md:grid-cols-2">
        <div className="surface p-8">
          <h3 className="mb-8 text-2xl font-bold">Select your Language</h3>
          <div className="flex flex-wrap gap-3">
            {LANGUAGES.map((lang) => {
              const active = selected === lang;
              return (
                <button
                  key={lang}
                  onClick={() => setSelected(lang)}
                  className="flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition"
                  style={{
                    borderColor: active ? 'var(--accent)' : 'var(--border)',
                    color: active ? 'var(--accent)' : 'var(--text)',
                    background: active ? 'rgba(79,140,255,0.12)' : 'transparent',
                  }}
                >
                  {active && <CheckCircle2 size={16} />}
                  {lang}
                </button>
              );
            })}
          </div>

          {isNonEnglish && (
            <div className="mt-5 flex flex-wrap gap-2">
              {(['native', 'roman'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setVariant(mode)}
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
        <div className="surface relative aspect-video overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border)' }}>
          <div className="absolute right-4 top-4 z-10">
            <Volume2 className="text-accent" />
          </div>
          {videoError ? (
            <div className="grid h-full w-full place-items-center bg-[var(--bg-soft)] px-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              Video preview is not available for this language yet.
            </div>
          ) : (
            <video
              key={`${selected}-${videoSrc}`}
              src={videoSrc}
              controls
              autoPlay
              muted
              loop
              playsInline
              className="h-full w-full object-cover"
              onError={handleVideoError}
            />
          )}
        </div>
      </div>
    </section>
  );
}
