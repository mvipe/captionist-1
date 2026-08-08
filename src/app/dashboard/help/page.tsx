'use client';

import { useState } from 'react';
import { Mail, MessageCircle, BookOpen, ChevronDown } from 'lucide-react';
import { FAQ_ITEMS } from '@/lib/landingDefaults';

export default function HelpPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Help &amp; Support</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          We&apos;re here to help you caption faster. Reach out or browse common questions below.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <a href="mailto:support@captionist.app" className="surface flex flex-col gap-2 p-6 transition hover:opacity-90">
          <Mail size={22} style={{ color: 'var(--accent)' }} />
          <h3 className="font-bold">Email Us</h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>support@captionist.app — we reply within 24 hours.</p>
        </a>
        <a href="https://wa.me/" target="_blank" rel="noreferrer" className="surface flex flex-col gap-2 p-6 transition hover:opacity-90">
          <MessageCircle size={22} style={{ color: 'var(--accent)' }} />
          <h3 className="font-bold">Live Chat</h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chat with our team on WhatsApp for quick questions.</p>
        </a>
        <a href="/dashboard/tutorials" className="surface flex flex-col gap-2 p-6 transition hover:opacity-90">
          <BookOpen size={22} style={{ color: 'var(--accent)' }} />
          <h3 className="font-bold">Tutorials</h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Watch step-by-step guides in YesEditor Academy.</p>
        </a>
      </div>

      <div>
        <h2 className="mb-4 text-xl font-bold">Frequently asked questions</h2>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="surface overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 p-5 text-left"
              >
                <span className="font-semibold">{item.q}</span>
                <ChevronDown
                  size={18}
                  className="shrink-0 transition"
                  style={{ transform: open === i ? 'rotate(180deg)' : 'none', color: 'var(--text-muted)' }}
                />
              </button>
              {open === i && (
                <p className="px-5 pb-5 text-sm" style={{ color: 'var(--text-muted)' }}>
                  {item.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
