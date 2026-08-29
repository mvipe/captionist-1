'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { PLANS } from '@/types';
import { Check, Zap, CreditCard, Receipt, LayoutGrid } from 'lucide-react';

const TABS = ['Overview', 'Plans & Upgrades', 'Payment Methods', 'Billing History'] as const;
type Tab = (typeof TABS)[number];

export default function SubscriptionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('Overview');
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');

  const plan = PLANS.find((p) => p.id === (user?.plan || 'free'))!;
  const storageUsedGB = (user?.usage.storageBytes || 0) / 1e9;
  const transcriptionUsedMin = (user?.usage.transcriptionSecondsUsed || 0) / 60;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold">Manage Subscription</h1>
        <div className="surface flex items-center gap-2 px-4 py-2" style={{ background: 'var(--bg-soft)' }}>
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-sm font-semibold">{plan.name} · Active</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="surface flex flex-wrap gap-1 p-1" style={{ background: 'var(--bg-soft)' }}>
        {TABS.map((t) => {
          const Icon = { Overview: LayoutGrid, 'Plans & Upgrades': Zap, 'Payment Methods': CreditCard, 'Billing History': Receipt }[t];
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition"
              style={tab === t ? { background: 'var(--accent)', color: '#fff' } : { color: 'var(--text-muted)' }}
            >
              <Icon size={16} /> {t}
            </button>
          );
        })}
      </div>

      {tab === 'Overview' && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="surface p-6 lg:col-span-2">
            <h3 className="mb-4 text-lg font-bold">Usage this cycle</h3>
            <UsageBar label="Storage" used={`${storageUsedGB.toFixed(1)} GB`} total={`${plan.limits.storageGB} GB`} pct={(storageUsedGB / plan.limits.storageGB) * 100} />
            <UsageBar label="Transcription" used={`${transcriptionUsedMin.toFixed(1)} min`} total={`${plan.limits.transcriptionMinutes} min`} pct={(transcriptionUsedMin / plan.limits.transcriptionMinutes) * 100} />
            <UsageBar label="Audio Cleans" used={`${user?.usage.audioCleansUsed || 0}`} total={`${plan.limits.audioCleans}`} pct={((user?.usage.audioCleansUsed || 0) / plan.limits.audioCleans) * 100} />
          </div>
          <div className="surface flex flex-col p-6">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Current Plan</span>
            <span className="mt-1 text-2xl font-extrabold gradient-text">{plan.name}</span>
            <span className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              {plan.id === 'free' ? 'Free forever' : `₹${plan.priceMonthly}/mo`}
            </span>
            {plan.durationLimitText && (
              <span className="mt-2 text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                {plan.durationLimitText}
              </span>
            )}
            <ul className="mt-4 space-y-2 text-sm">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check size={15} style={{ color: 'var(--accent)' }} /> {f}
                </li>
              ))}
            </ul>
            <button onClick={() => setTab('Plans & Upgrades')} className="btn-primary mt-auto w-full !py-2.5 text-sm">
              Upgrade plan
            </button>
          </div>
        </div>
      )}

      {tab === 'Plans & Upgrades' && (
        <div className="space-y-6">
          <div className="flex justify-center">
            <div className="surface inline-flex p-1" style={{ background: 'var(--bg-soft)' }}>
              {(['monthly', 'yearly'] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setBilling(b)}
                  className="rounded-full px-5 py-2 text-sm font-semibold capitalize transition"
                  style={billing === b ? { background: 'var(--accent)', color: '#fff' } : { color: 'var(--text-muted)' }}
                >
                  {b} {b === 'yearly' && <span className="opacity-80">(save ~17%)</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {PLANS.map((p) => {
              const price = billing === 'monthly' ? p.priceMonthly : p.priceYearly;
              const current = p.id === plan.id;
              return (
                <div
                  key={p.id}
                  className="surface relative flex flex-col p-6"
                  style={p.popular ? { borderColor: 'var(--accent)' } : undefined}
                >
                  {p.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: 'var(--accent)' }}>
                      POPULAR
                    </span>
                  )}
                  <h3 className="text-lg font-bold">{p.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold">₹{price}</span>
                    {p.id !== 'free' && <span className="text-sm" style={{ color: 'var(--text-muted)' }}>/mo</span>}
                  </div>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{p.tagline}</p>
                  {p.durationLimitText && (
                    <p className="mt-2 text-xs font-semibold" style={{ color: 'var(--accent)' }}>{p.durationLimitText}</p>
                  )}
                  <ul className="mt-4 flex-1 space-y-2 text-sm">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} /> {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    disabled={current || p.id === 'free'}
                    onClick={() => router.push(`/checkout?plan=${p.id}&billing=${billing}`)}
                    className={current ? 'btn-ghost mt-5 w-full !py-2.5 text-sm' : 'btn-primary mt-5 w-full !py-2.5 text-sm'}
                  >
                    {current ? 'Current Plan' : p.id === 'free' ? 'Free' : 'Choose Plan'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'Payment Methods' && (
        <div className="surface grid place-items-center p-12 text-center">
          <CreditCard size={40} style={{ color: 'var(--text-muted)' }} />
          <p className="mt-4 font-semibold">No saved payment methods</p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Payments are processed securely through Razorpay at checkout.
          </p>
        </div>
      )}

      {tab === 'Billing History' && (
        <div className="surface grid place-items-center p-12 text-center">
          <Receipt size={40} style={{ color: 'var(--text-muted)' }} />
          <p className="mt-4 font-semibold">No invoices yet</p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Your payment receipts will show up here after your first purchase.
          </p>
        </div>
      )}
    </div>
  );
}

function UsageBar({ label, used, total, pct }: { label: string; used: string; total: string; pct: number }) {
  return (
    <div className="mb-5">
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span style={{ color: 'var(--text-muted)' }}>
          {used} <span className="opacity-60">/ {total}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(2, pct))}%`, background: 'var(--accent)' }} />
      </div>
    </div>
  );
}
