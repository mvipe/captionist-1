'use client';

import Link from 'next/link';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import { ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function Navbar() {
  const { user } = useAuth();
  return (
    <header className="container-page sticky top-4 z-50 pt-4">
      <nav
        className="flex items-center justify-between rounded-full border px-6 py-3 shadow-sm backdrop-blur"
        style={{ borderColor: 'var(--border)', background: 'var(--navbar-bg)' }}
      >
        <Link href="/">
          <Logo />
        </Link>
        <div className="hidden items-center gap-8 text-sm md:flex" style={{ color: 'var(--text-muted)' }}>
          <a href="#about" className="nav-link">About</a>
          <a href="#testimonials" className="nav-link">Testimonials</a>
          <a href="#pricing" className="nav-link">Pricing</a>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href={user ? '/dashboard' : '/sign-in'} className="btn-primary !px-5 !py-2.5">
            {user ? 'Dashboard' : 'Sign In'} <ArrowUpRight size={16} />
          </Link>
        </div>
      </nav>
    </header>
  );
}
