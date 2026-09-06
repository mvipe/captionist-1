'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Gem, Rocket, Crown, CircleDot, Check } from 'lucide-react';
import { PLANS, type PlanId } from '@/types';

const ICONS: Record<PlanId, React.ReactNode> = {
  free: <CircleDot size={22} />,
  editor: <Gem size={22} />,
  creator: <Rocket size={22} />,
  studio: <Crown size={22} />,
};

export default function Pricing() {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="pricing" className="py-20">
      <div className="container-page">
        <h2 className="text-center text-4xl font-bold tracking-tight md:text-5xl">
          <span className="gradient-text">Unbeatable Pricing</span> Across the Industry
        </h2>

        <div className="mt-10 flex items-center justify-center gap-3">
          <div
            className="flex items-center gap-1 rounded-full border p-1"
            style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
          >
            <button
              onClick={() => setYearly(false)}
              className={`rounded-full px-6 py-2 text-sm font-semibold transition ${!yearly ? 'bg-white text-black' : ''}`}
              style={yearly ? { color: 'var(--text-muted)' } : {}}
            >
              Monthly
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`flex items-center gap-2 rounded-full px-6 py-2 text-sm font-semibold transition ${yearly ? 'bg-white text-black' : ''}`}
              style={!yearly ? { color: 'var(--text-muted)' } : {}}
            >
              Yearly <span className="text-xs font-bold text-emerald-400">SAVE</span>
            </button>
          </div>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => {
            const price = yearly ? plan.priceYearly : plan.priceMonthly;
            return (
              <div
                key={plan.id}
                className="surface relative flex flex-col p-7"
                style={
                  plan.popular
                    ? { borderColor: 'var(--accent)', boxShadow: '0 0 40px -10px var(--accent)' }
                    : {}
                }
              >
                {plan.popular && (
                  <span
                    className="absolute -top-3 right-6 rounded-full border px-3 py-1 text-xs font-semibold"
                    style={{ borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--bg)' }}
                  >
                    Most Popular
                  </span>
                )}
                <div
                  className="mb-5 grid h-12 w-12 place-items-center rounded-full"
                  style={{
                    background: plan.popular ? 'var(--accent)' : 'var(--bg-soft)',
                    color: plan.popular ? '#fff' : 'var(--text)',
                  }}
                >
                  {ICONS[plan.id]}
                </div>
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <div className="mt-3 flex items-end gap-1">
                  <span className="text-4xl font-bold">₹{price}</span>
                  {price > 0 && <span className="mb-1 text-xs gradient-text">+ GST</span>}
                </div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  / per month
                </p>
                {plan.durationLimitText && (
                  <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                    {plan.durationLimitText}
                  </p>
                )}
                <Link
                  href={`/checkout?plan=${plan.id}&billing=${yearly ? 'yearly' : 'monthly'}`}
                  className={`mt-6 text-center ${plan.popular ? 'btn-primary' : 'btn-ghost'} !py-2.5`}
                >
                  Get Started
                </Link>
                <div className="my-6 h-px" style={{ background: 'var(--border)' }} />
                <p className="mb-3 text-sm font-semibold">{plan.tagline}</p>
                <ul className="space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                      <Check size={16} className="mt-0.5 shrink-0 text-accent" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
