'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebaseClient';
import { useAuth } from '@/context/AuthContext';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import { Phone, Mail, ArrowRight, Loader2 } from 'lucide-react';

type Method = 'phone' | 'email';
type Mode = 'login' | 'signup';

export default function SignInPage() {
  const router = useRouter();
  const { signInWithToken } = useAuth();

  const [method, setMethod] = useState<Method>('phone');
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);

  // shared fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const go = () => router.push('/dashboard');

  const sendOtp = async () => {
    if (!phone) return toast.error('Enter your phone number');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.wrongMode) setMode(mode === 'login' ? 'signup' : 'login');
        throw new Error(data.error);
      }
      setOtpSent(true);
      toast.success('OTP sent');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp) return toast.error('Enter the OTP');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp, mode, name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await signInWithToken(data.customToken);
      toast.success('Welcome to YesEditor');
      go();
    } catch (e: any) {
      toast.error(e?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const emailAuth = async () => {
    if (!email || !password) return toast.error('Enter email and password');
    setLoading(true);
    try {
      if (mode === 'signup') {
        // create account through phone-less signup is not allowed; use OTP for new accounts.
        // For email signup we create via Firebase client by registering then ensure-user.
        const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name) await updateProfile(cred.user, { displayName: name });
        const token = await cred.user.getIdToken();
        await fetch('/api/auth/ensure-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name, email }),
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      toast.success('Signed in');
      go();
    } catch (e: any) {
      toast.error(e?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Left brand panel */}
      <div className="relative hidden items-center justify-center overflow-hidden lg:flex" style={{ background: 'var(--bg-soft)' }}>
        <div
          className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
          style={{ backgroundSize: '40px 40px' }}
        />
        <div className="relative max-w-md px-10">
          <Logo className="!text-3xl" />
          <h2 className="mt-8 text-4xl font-extrabold leading-tight">
            Captioning made by <span className="gradient-text">Desi Creators</span>, for Desi Creators
          </h2>
          <p className="mt-4" style={{ color: 'var(--text-muted)' }}>
            Up to 97% accuracy across all major desi languages. Sign in to start captioning.
          </p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <Logo />
            <ThemeToggle />
          </div>
          <div className="mb-8 hidden justify-end lg:flex">
            <ThemeToggle />
          </div>

          <h1 className="text-2xl font-bold">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {mode === 'login' ? 'Log in to continue' : 'Sign up to get started'}
          </p>

          {/* Method switch */}
          <div className="mt-6 flex gap-2 rounded-xl border p-1" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => { setMethod('phone'); setOtpSent(false); }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${method === 'phone' ? 'btn-primary !rounded-lg !py-2' : ''}`}
              style={method !== 'phone' ? { color: 'var(--text-muted)' } : {}}
            >
              <Phone size={15} /> Phone
            </button>
            <button
              onClick={() => setMethod('email')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${method === 'email' ? 'btn-primary !rounded-lg !py-2' : ''}`}
              style={method !== 'email' ? { color: 'var(--text-muted)' } : {}}
            >
              <Mail size={15} /> Email
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {mode === 'signup' && (
              <input className="input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
            )}

            {method === 'phone' ? (
              <>
                <div className="flex gap-2">
                  <span className="grid place-items-center rounded-xl border px-3 text-sm" style={{ borderColor: 'var(--border)' }}>🇮🇳 +91</span>
                  <input
                    className="input"
                    placeholder="Phone number"
                    value={phone}
                    disabled={otpSent}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                {mode === 'signup' && (
                  <input className="input" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
                )}
                {otpSent && (
                  <input className="input tracking-[0.5em]" placeholder="Enter OTP" value={otp} onChange={(e) => setOtp(e.target.value)} />
                )}
                <button onClick={otpSent ? verifyOtp : sendOtp} disabled={loading} className="btn-primary w-full">
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <>{otpSent ? 'Verify & continue' : 'Send OTP'} <ArrowRight size={16} /></>}
                </button>
                {otpSent && (
                  <button onClick={sendOtp} className="w-full text-sm" style={{ color: 'var(--text-muted)' }}>
                    Resend OTP
                  </button>
                )}
              </>
            ) : (
              <>
                <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button onClick={emailAuth} disabled={loading} className="btn-primary w-full">
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <>{mode === 'login' ? 'Log in' : 'Sign up'} <ArrowRight size={16} /></>}
                </button>
              </>
            )}
          </div>

          <div className="my-5 flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            <div className="h-px flex-1" style={{ background: 'var(--border)' }} /> OR <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
          </div>


          <p className="mt-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setOtpSent(false); }}
              className="font-semibold"
              style={{ color: 'var(--accent)' }}
            >
              {mode === 'login' ? 'Sign up' : 'Log in'}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
