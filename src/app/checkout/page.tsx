'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { authFetch } from '@/lib/authFetch';
import { PLANS, type PlanId } from '@/types';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import { Check, Tag, ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function CheckoutInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, loading } = useAuth();

  const planId = (params.get('plan') || 'creator') as PlanId;
  const billing = (params.get('billing') === 'yearly' ? 'yearly' : 'monthly') as 'monthly' | 'yearly';
  const plan = PLANS.find((p) => p.id === planId);

  const [code, setCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace(`/sign-in?next=/checkout?plan=${planId}%26billing=${billing}`);
  }, [loading, user, router, planId, billing]);

  const months = billing === 'yearly' ? 12 : 1;
  const unit = billing === 'yearly' ? plan?.priceYearly || 0 : plan?.priceMonthly || 0;
  const gross = unit * months;
  const total = useMemo(() => Math.max(1, gross - discount), [gross, discount]);

  if (!plan || plan.id === 'free') {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <p className="text-lg font-bold">This plan isn&apos;t purchasable.</p>
          <button onClick={() => router.push('/dashboard/subscription')} className="btn-primary mt-4">
            Back to plans
          </button>
        </div>
      </div>
    );
  }

  const applyCoupon = async () => {
    if (!code.trim()) return;
    setApplying(true);
    const res = await authFetch('/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim(), amount: gross, planId }),
    });
    setApplying(false);
    const data = await res.json();
    if (data.valid) {
      setDiscount(data.discount);
      setAppliedCode(data.code || code.trim().toUpperCase());
      toast.success(`Coupon applied — you save ₹${data.discount}`);
    } else {
      setDiscount(0);
      setAppliedCode(null);
      toast.error(data.reason || 'Invalid coupon');
    }
  };

  const pay = async () => {
    setPaying(true);
    try {
      const orderRes = await authFetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billing, couponCode: appliedCode || undefined }),
      });
      const order = await orderRes.json();
      if (!orderRes.ok) throw new Error(order.error || 'Could not start checkout');

      const ok = await loadRazorpay();
      if (!ok) throw new Error('Failed to load Razorpay');

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: Math.round(order.amount * 100),
        currency: order.currency,
        name: 'YesEditor',
        description: `${plan.name} · ${billing}`,
        order_id: order.orderId,
        prefill: { name: user?.name, email: user?.email, contact: user?.phone },
        theme: { color: '#2563eb' },
        handler: async (resp: any) => {
          const verifyRes = await authFetch('/api/checkout/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpayOrderId: resp.razorpay_order_id,
              razorpayPaymentId: resp.razorpay_payment_id,
              razorpaySignature: resp.razorpay_signature,
              transactionId: order.transactionId,
            }),
          });
          if (verifyRes.ok) {
            toast.success('Payment successful! Plan upgraded.');
            router.push('/dashboard/subscription');
          } else {
            toast.error('Payment verification failed');
          }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.open();
    } catch (e: any) {
      toast.error(e?.message || 'Checkout failed');
      setPaying(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between p-5">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={16} /> Back
        </button>
        <Logo />
        <ThemeToggle />
      </header>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-2">
        {/* Summary */}
        <div className="surface h-fit p-7">
          <h1 className="text-2xl font-extrabold">Order summary</h1>
          <div className="mt-6 flex items-center justify-between">
            <div>
              <p className="text-lg font-bold">{plan.name}</p>
              <p className="text-sm capitalize" style={{ color: 'var(--text-muted)' }}>
                Billed {billing}
              </p>
              {plan.durationLimitText && (
                <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                  {plan.durationLimitText}
                </p>
              )}
            </div>
            <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: 'var(--accent)' }}>
              {billing === 'yearly' ? '12 months' : '1 month'}
            </span>
          </div>

          <ul className="mt-5 space-y-2 text-sm">
            {plan.features.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Check size={15} style={{ color: 'var(--accent)' }} /> {f}
              </li>
            ))}
          </ul>

          <div className="mt-6 space-y-2 border-t pt-5 text-sm" style={{ borderColor: 'var(--border)' }}>
            <Row label="Subtotal" value={`₹${gross.toFixed(0)}`} />
            {discount > 0 && <Row label={`Discount (${appliedCode})`} value={`− ₹${discount.toFixed(0)}`} accent />}
            <div className="flex items-center justify-between pt-2 text-lg font-extrabold">
              <span>Total</span>
              <span>₹{total.toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="space-y-5">
          <div className="surface p-7">
            <div className="mb-3 flex items-center gap-2">
              <Tag size={18} style={{ color: 'var(--accent)' }} />
              <h2 className="font-bold">Have a coupon?</h2>
            </div>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="Enter code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                disabled={!!appliedCode}
              />
              {appliedCode ? (
                <button
                  onClick={() => {
                    setAppliedCode(null);
                    setDiscount(0);
                    setCode('');
                  }}
                  className="btn-ghost shrink-0 !px-5 !py-3 text-sm"
                >
                  Remove
                </button>
              ) : (
                <button onClick={applyCoupon} disabled={applying} className="btn-primary shrink-0 !px-5 !py-3 text-sm disabled:opacity-50">
                  {applying ? <Loader2 size={15} className="animate-spin" /> : 'Apply'}
                </button>
              )}
            </div>
          </div>

          <div className="surface p-7">
            <button onClick={pay} disabled={paying} className="btn-primary w-full !py-4 disabled:opacity-50">
              {paying ? <Loader2 size={18} className="animate-spin" /> : `Pay ₹${total.toFixed(0)}`}
            </button>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <ShieldCheck size={14} /> Secured by Razorpay · UPI, Cards, Netbanking
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={accent ? { color: 'var(--accent)', fontWeight: 600 } : undefined}>{value}</span>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center">
          <Loader2 className="animate-spin" style={{ color: 'var(--accent)' }} size={28} />
        </div>
      }
    >
      <CheckoutInner />
    </Suspense>
  );
}
