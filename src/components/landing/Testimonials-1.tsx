'use client';

import type { Testimonial } from '@/types';

export default function Testimonials({ testimonials }: { testimonials: Testimonial[] }) {
  return (
    <section id="testimonials" className="py-20">
      <div className="container-page">
        <h2 className="mb-14 text-center text-4xl font-bold tracking-tight md:text-5xl">
          Loved by Creators Across <span className="gradient-text">South Asia</span>
        </h2>
        <div className="columns-1 gap-6 md:columns-2 lg:columns-3 [&>*]:mb-6">
          {testimonials.map((t) => (
            <div key={t.id} className="surface break-inside-avoid p-6">
              <p className="leading-relaxed" style={{ color: 'var(--text)' }}>
                {t.text}
              </p>
              <div className="mt-5 flex items-center gap-3">
                <div
                  className="grid h-10 w-10 place-items-center rounded-full font-bold gradient-text"
                  style={{ background: 'var(--bg-soft)' }}
                >
                  {t.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.avatarUrl} alt={t.name} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    t.name.charAt(0)
                  )}
                </div>
                <div>
                  <p className="font-semibold">{t.name}</p>
                  {t.handle && (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {t.handle}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
