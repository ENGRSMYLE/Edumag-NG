import type { CSSProperties } from 'react';
import { School } from 'lucide-react';
import Link from 'next/link';
import { SetPasswordForm } from '@/components/modules/auth/SetPasswordForm';

interface SetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function SetPasswordPage({
  searchParams,
}: SetPasswordPageProps) {
  const { token } = await searchParams;

  return (
    <div className="min-h-[100dvh] bg-[var(--color-cream)] flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-fade-in-up" style={{ '--delay': '0ms' } as unknown as CSSProperties}>
        {/* Double-bezel card */}
        <div className="bg-black/[0.03] ring-1 ring-black/5 p-1.5 rounded-[1.5rem]">
          <div className="bg-white rounded-[calc(1.5rem-0.375rem)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] px-8 py-8">
            {/* Logo */}
            <div className="flex items-center gap-2.5 mb-8">
              <div className="w-9 h-9 rounded-xl bg-[var(--color-navy)] flex items-center justify-center">
                <School
                  className="w-[18px] h-[18px] text-[var(--color-gold)]"
                  strokeWidth={1.5}
                />
              </div>
              <span className="text-sm font-bold text-[var(--color-navy)] font-display tracking-tight">
                EduMag NG
              </span>
            </div>

            {/* Heading */}
            <div className="mb-7">
              <h1 className="text-2xl font-bold font-display text-[var(--color-navy)] tracking-tight mb-1.5">
                Set Your Password
              </h1>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Create a secure password to activate your account.
              </p>
            </div>

            {/* Form */}
            <SetPasswordForm token={token ?? ''} />

            {/* Footer link */}
            <p className="mt-6 text-center text-xs text-[var(--color-text-muted)]">
              Already have an account?{' '}
              <Link
                href="/login"
                className="font-medium text-[var(--color-navy)] hover:text-[var(--color-gold)] transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
