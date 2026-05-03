'use client';

import { useEffect, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { School, ChevronRight, Loader2, Building2 } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { useState } from 'react';
import Link from 'next/link';

import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { SchoolOption, UserRole } from '@/types/auth';

const ROLE_HOME: Record<UserRole, string> = {
  super_admin: '/dashboard/super-admin',
  admin: '/dashboard/admin',
  teacher: '/dashboard/staff',
};

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  teacher: 'Teacher',
};

export default function SelectSchoolPage() {
  const router = useRouter();
  const schools               = useAuthStore((s) => s.schools);
  const tempToken             = useAuthStore((s) => s.tempToken);
  const requiresSchoolSelection = useAuthStore((s) => s.requiresSchoolSelection);
  const login                 = useAuthStore((s) => s.login);
  const clearSchoolSelection  = useAuthStore((s) => s.clearSchoolSelection);

  const [selectingId, setSelectingId] = useState<string | null>(null);

  // Guard: if no school selection data, redirect to login
  useEffect(() => {
    if (!requiresSchoolSelection || !schools || !tempToken) {
      router.replace('/login');
    }
  }, [requiresSchoolSelection, schools, tempToken, router]);

  if (!requiresSchoolSelection || !schools || !tempToken) {
    return null;
  }

  const handleSelect = async (option: SchoolOption) => {
    if (selectingId) return;
    setSelectingId(option.membership_id);

    try {
      const res = await authApi.selectSchool({
        temp_token: tempToken,
        membership_id: option.membership_id,
      });
      const tokenResponse = res.data;

      clearSchoolSelection();
      login(tokenResponse);

      if (tokenResponse.user.is_first_login) {
        router.push('/set-password');
        return;
      }

      const dest = ROLE_HOME[tokenResponse.user.role] ?? '/login';
      router.push(dest);
    } catch {
      toast.error('Failed to select school. Please try again.');
      setSelectingId(null);
    }
  };

  return (
    <div className="min-h-[100dvh] flex">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-2/5 bg-[var(--color-navy)] flex-col relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 -right-16 w-72 h-72 rounded-full bg-[var(--color-gold)]/[0.06] blur-3xl" />
          <div className="absolute bottom-1/4 -left-16 w-64 h-64 rounded-full bg-[var(--color-navy-light)]/50 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(var(--color-gold) 1px, transparent 1px), linear-gradient(90deg, var(--color-gold) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>

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

        <div className="relative z-10 flex-1 flex items-center px-10">
          <div>
            <blockquote className="text-3xl font-bold font-display text-white leading-tight tracking-tight mb-6">
              You belong to{' '}
              <span className="text-[var(--color-gold)]">multiple schools.</span>
              <br />
              Which one today?
            </blockquote>
            <div className="flex items-center gap-3">
              <div className="w-8 h-px bg-[var(--color-gold)]/40" />
              <p className="text-xs text-white/40 font-medium uppercase tracking-widest">
                EduMag NG
              </p>
            </div>
          </div>
        </div>

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

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-[var(--color-cream)]">
        <div
          className="w-full max-w-md animate-fade-in-up"
          style={{ '--delay': '0ms' } as unknown as CSSProperties}
        >
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
              Select a school
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Your account is linked to {schools.length} school
              {schools.length !== 1 ? 's' : ''}. Choose where to continue.
            </p>
          </div>

          {/* School list */}
          <div className="flex flex-col gap-3">
            {schools.map((option) => {
              const isLoading = selectingId === option.membership_id;
              const isDisabled = !!selectingId && !isLoading;

              return (
                <button
                  key={option.membership_id}
                  onClick={() => handleSelect(option)}
                  disabled={!!selectingId}
                  className={clsx(
                    'w-full flex items-center gap-4 p-4 rounded-xl border',
                    'bg-white text-left',
                    'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
                    'cursor-pointer',
                    isDisabled
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:border-[var(--color-gold)] hover:shadow-sm hover:shadow-[var(--color-gold)]/10 active:scale-[0.99]',
                    isLoading
                      ? 'border-[var(--color-gold)] shadow-sm shadow-[var(--color-gold)]/10'
                      : 'border-[var(--color-border)]',
                  )}
                >
                  {/* School logo / icon */}
                  <div
                    className={clsx(
                      'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
                      'border',
                      isLoading
                        ? 'bg-[var(--color-gold)]/10 border-[var(--color-gold)]/20'
                        : 'bg-[var(--color-navy)]/5 border-[var(--color-navy)]/10',
                    )}
                  >
                    {option.school_logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={option.school_logo_url}
                        alt={option.school_name}
                        className="w-7 h-7 object-contain rounded"
                      />
                    ) : (
                      <Building2
                        className={clsx(
                          'w-5 h-5',
                          isLoading
                            ? 'text-[var(--color-gold)]'
                            : 'text-[var(--color-navy)]/50',
                        )}
                        strokeWidth={1.5}
                      />
                    )}
                  </div>

                  {/* School info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                      {option.school_name}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {ROLE_LABEL[option.role] ?? option.role}
                    </p>
                  </div>

                  {/* Chevron / spinner */}
                  <div className="flex-shrink-0">
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 text-[var(--color-gold)] animate-spin" />
                    ) : (
                      <ChevronRight
                        className="w-4 h-4 text-[var(--color-text-muted)]"
                        strokeWidth={1.5}
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <p className="mt-8 text-center text-xs text-[var(--color-text-muted)]">
            Not you?{' '}
            <Link
              href="/login"
              className="font-medium text-[var(--color-navy)] hover:text-[var(--color-gold)] transition-colors"
            >
              Sign in with a different account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
