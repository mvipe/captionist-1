'use client';

import { useState } from 'react';
import { Plus, Minus, Mail } from 'lucide-react';
import { FAQ_ITEMS } from '@/lib/landingDefaults';
import Logo from '@/components/Logo';

export function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="py-20">
      <div className="container-page">
        <h2 className="mb-12 text-center text-4xl font-bold tracking-tight md:text-5xl">
          Frequently Asked <span className="gradient-text">Questions</span>
        </h2>
        <div className="surface divide-y" style={{ borderColor: 'var(--border)' }}>
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={i} style={{ borderColor: 'var(--border)' }} className="divide-y">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between px-6 py-5 text-left"
                >
                  <span className="font-semibold">{item.q}</span>
                  <span className="text-accent">{isOpen ? <Minus size={20} /> : <Plus size={20} />}</span>
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// Edit these in one place. Externals open in a new tab; internal legal pages
// stay in-app. TODO(admin): swap the socials + email for your real handles.
const FOOTER = {
  supportEmail: 'support@captionist.app',
  instagram: 'https://instagram.com/yeseditor',
  linkedin: 'https://linkedin.com/company/yeseditor',
  terms: '/terms',
  privacy: '/privacy',
};

export function Footer() {
  const external = (href: string, label: string) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: 'var(--text)' }}
      className="transition hover:opacity-70"
    >
      {label}
    </a>
  );
  const internal = (href: string, label: string) => (
    <a href={href} style={{ color: 'var(--text)' }} className="transition hover:opacity-70">
      {label}
    </a>
  );

  return (
    <footer className="py-20">
      <div className="container-page">
        <div className="surface p-10 text-center">
          <h3 className="text-2xl font-bold">
            Still have a query? Drop your Questions at our Support <span className="gradient-text">Email</span>
          </h3>
          <a href={`mailto:${FOOTER.supportEmail}`} className="btn-primary mx-auto mt-8 w-fit">
            <Mail size={18} /> Email Us
          </a>
          <div className="mx-auto mt-10 grid max-w-md grid-cols-2 gap-y-4 text-left">
            {internal(FOOTER.terms, 'Terms & Conditions')}
            {external(FOOTER.instagram, 'Instagram')}
            {internal(FOOTER.privacy, 'Privacy Policy')}
            {external(FOOTER.linkedin, 'LinkedIn')}
          </div>
        </div>
        <div className="mt-8 flex justify-center">
          <Logo className="!text-xl opacity-60" />
        </div>
      </div>
    </footer>
  );
}
