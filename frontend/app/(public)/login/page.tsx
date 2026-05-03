import type { CSSProperties } from 'react';
import { LoginForm } from '@/components/modules/auth/LoginForm';
import { School } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="min-h-[100dvh] flex">
      {/* ── Left panel — navy branded ── */}
      <div className="hidden lg:flex lg:w-2/5 bg-[var(--color-navy)] flex-col relative overflow-hidden">
        {/* Background geometry */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 -right-16 w-72 h-72 rounded-full bg-[var(--color-gold)]/[0.06] blur-3xl" />
          <div className="absolute bottom-1/4 -left-16 w-64 h-64 rounded-full bg-[var(--color-navy-light)]/50 blur-3xl" />
          {/* Subtle grid */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(var(--color-gold) 1px, transparent 1px), linear-gradient(90deg, var(--color-gold) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        {/* Logo */}
        <div className="relative z-10 p-10">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-gold)]/10 border border-[var(--color-gold)]/20 flex items-center justify-center">
              <School className="w-[18px] h-[18px] text-[var(--color-gold)]" strokeWidth={1.5} />
            </div>
            <span className="text-base font-bold text-white font-display tracking-tight">
              EduMag NG
            </span>
          </Link>
        </div>

        {/* Center quote */}
        <div className="relative z-10 flex-1 flex items-center px-10">
          <div>
            <blockquote className="text-3xl font-bold font-display text-white leading-tight tracking-tight mb-6">
              Empowering Nigerian Schools,{' '}
              <span className="text-[var(--color-gold)]">One Click</span> at a
              Time
            </blockquote>
            <div className="flex items-center gap-3">
              <div className="w-8 h-px bg-[var(--color-gold)]/40" />
              <p className="text-xs text-white/40 font-medium uppercase tracking-widest">
                EduMag NG
              </p>
            </div>
          </div>
        </div>

        {/* Decorative bottom pattern */}
        <div className="relative z-10 p-10">
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 18 }).map((_, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full"
                style={{
                  background:
                    i % 7 === 0
                      ? 'var(--color-gold)'
                      : i % 3 === 0
                      ? 'rgba(255,255,255,0.15)'
                      : 'rgba(255,255,255,0.05)',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-[var(--color-cream)]">
        <div className="w-full max-w-md animate-fade-in-up" style={{ '--delay': '0ms' } as unknown as CSSProperties}>
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-navy)] flex items-center justify-center">
              <School className="w-4 h-4 text-[var(--color-gold)]" strokeWidth={1.5} />
            </div>
            <span className="text-sm font-bold text-[var(--color-navy)] font-display">
              EduMag NG
            </span>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-bold font-display text-[var(--color-navy)] tracking-tight mb-2">
              Welcome back
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Sign in to your school dashboard
            </p>
          </div>

          <LoginForm />

          <p className="mt-8 text-center text-xs text-[var(--color-text-muted)]">
            New school?{' '}
            <Link
              href="/signup"
              className="font-medium text-[var(--color-navy)] hover:text-[var(--color-gold)] transition-colors"
            >
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
