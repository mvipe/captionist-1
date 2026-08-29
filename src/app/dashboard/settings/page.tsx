'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { authFetch } from '@/lib/authFetch';
import { User, Lock, Mail, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone?.replace(/^\+91/, '') || '');
  const [lang, setLang] = useState(user?.preferredLanguage || 'auto');
  const [savingProfile, setSavingProfile] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [savingSecurity, setSavingSecurity] = useState(false);

  const saveProfile = async () => {
    setSavingProfile(true);
    const res = await authFetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone: phone ? `+91${phone}` : '', preferredLanguage: lang }),
    });
    setSavingProfile(false);
    if (res.ok) {
      await refresh();
      toast.success('Profile updated');
    } else toast.error('Could not update profile');
  };

  const saveSecurity = async () => {
    if (!password || password.length < 6) return toast.error('Password must be at least 6 characters');
    setSavingSecurity(true);
    const res = await authFetch('/api/auth/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, email: newEmail || undefined }),
    });
    setSavingSecurity(false);
    if (res.ok) {
      setPassword('');
      setNewEmail('');
      toast.success('Security settings updated');
    } else {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || 'Update failed');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-extrabold">Account</h1>

      {/* Account card */}
      <div className="surface p-6">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full text-2xl font-bold text-white" style={{ background: 'var(--accent)' }}>
            {(user?.name || 'U').charAt(0)}
          </div>
          <div>
            <p className="text-lg font-bold">{user?.name}</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Personal details */}
      <div className="surface p-6">
        <div className="mb-5 flex items-center gap-2">
          <User size={18} style={{ color: 'var(--accent)' }} />
          <h2 className="text-lg font-bold">Personal details</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Phone">
            <div className="flex items-center gap-2">
              <span className="surface px-3 py-3 text-sm" style={{ background: 'var(--bg-soft)' }}>+91</span>
              <input className="input" value={phone} maxLength={10} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />
            </div>
          </Field>
          <Field label="Preferred language">
            <select className="input" value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="auto">Auto‑detect</option>
            </select>
          </Field>
        </div>
        <button onClick={saveProfile} disabled={savingProfile} className="btn-primary mt-5 !py-2.5 text-sm disabled:opacity-50">
          {savingProfile && <Loader2 size={15} className="animate-spin" />} Save changes
        </button>
      </div>

      {/* Security */}
      <div className="surface p-6">
        <div className="mb-5 flex items-center gap-2">
          <Lock size={18} style={{ color: 'var(--accent)' }} />
          <h2 className="text-lg font-bold">Login &amp; security</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Change email (optional)">
            <div className="flex items-center gap-2">
              <Mail size={16} style={{ color: 'var(--text-muted)' }} />
              <input className="input" type="email" placeholder={user?.email} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
          </Field>
          <Field label="Set / change password">
            <input className="input" type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        </div>
        <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          Setting a password lets you sign in with email + password in addition to OTP.
        </p>
        <button onClick={saveSecurity} disabled={savingSecurity} className="btn-primary mt-4 !py-2.5 text-sm disabled:opacity-50">
          {savingSecurity && <Loader2 size={15} className="animate-spin" />} Update security
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}
