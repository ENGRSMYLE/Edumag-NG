'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, Loader2, AlertCircle, School } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import Link from 'next/link';

import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { UserRole } from '@/types/auth';

const ROLE_HOME: Record<UserRole, string> = {
  super_admin: '/dashboard/super-admin',
  admin: '/dashboard/admin',
  teacher: '/dashboard/staff',
};

const schema = z
  .object({
    new_password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Include at least one uppercase letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

type FormData = z.infer<typeof schema>;

// ─── Password strength ────────────────────────────────────────────────────────
function getStrength(pwd: string) {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  if (score <= 1) return { level: 1, label: 'Weak', color: 'bg-red-400' };
  if (score === 2) return { level: 2, label: 'Fair', color: 'bg-amber-400' };
  if (score === 3) return { level: 3, label: 'Good', color: 'bg-yellow-400' };
  return { level: 4, label: 'Strong', color: 'bg-emerald-500' };
}

// ─── Component ────────────────────────────────────────────────────────────────
interface SetPasswordFormProps {
  token: string;
}

export function SetPasswordForm({ token }: SetPasswordFormProps) {
  const router = useRouter();
  const loginStore = useAuthStore((s) => s.login);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [tokenError, setTokenError] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const passwordValue = watch('new_password') ?? '';
  const strength = passwordValue ? getStrength(passwordValue) : null;

  const onSubmit = async (data: FormData) => {
    if (!token) {
      setTokenError(true);
      return;
    }
    try {
      const res = await authApi.setPassword({
        invite_token: token,
        new_password: data.new_password,
      });

      loginStore(res.data);
      toast.success('Account activated. Welcome to EduMag NG!');

      const dest = ROLE_HOME[res.data.user.role] ?? '/login';
      router.push(dest);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })
        ?.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : '';

      if (
        msg.toLowerCase().includes('expired') ||
        msg.toLowerCase().includes('invalid') ||
        (err as { response?: { status?: number } })?.response?.status === 400
      ) {
        setTokenError(true);
      } else {
        toast.error(msg || 'Something went wrong. Please try again.');
      }
    }
  };

  // ── Invalid / expired token state ──────────────────────────────────────────
  if (!token || tokenError) {
    return (
      <div className="text-center">
        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6 text-red-500" strokeWidth={1.5} />
        </div>
        <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)] mb-2">
          Invite link expired
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-6 max-w-xs mx-auto">
          This invite link has expired or is no longer valid. Contact your
          school admin to get a new one.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-navy)] hover:text-[var(--color-gold)] transition-colors"
        >
          Back to login
        </Link>
      </div>
    );
  }

  const inputCx = (hasError: boolean) =>
    clsx(
      'w-full pl-10 pr-11 py-3 text-sm rounded-xl',
      'bg-white border',
      'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
      'focus:outline-none focus:ring-2',
      'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
      hasError
        ? 'border-red-300 focus:ring-red-100'
        : 'border-[var(--color-border)] focus:ring-[var(--color-gold)]/25 focus:border-[var(--color-gold)]',
    );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {/* New Password */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-[var(--color-text-primary)]">
          New Password
        </label>
        <div className="relative">
          <Lock
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]"
            strokeWidth={1.5}
          />
          <input
            {...register('new_password')}
            type={showNew ? 'text' : 'password'}
            placeholder="Min. 8 characters"
            autoComplete="new-password"
            className={inputCx(!!errors.new_password)}
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-0.5"
            aria-label={showNew ? 'Hide password' : 'Show password'}
          >
            {showNew ? (
              <EyeOff className="w-4 h-4" strokeWidth={1.5} />
            ) : (
              <Eye className="w-4 h-4" strokeWidth={1.5} />
            )}
          </button>
        </div>

        {/* Strength indicator */}
        {passwordValue && strength && (
          <div className="flex flex-col gap-1.5 mt-0.5">
            <div className="flex gap-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className={clsx(
                    'flex-1 h-1 rounded-full transition-all duration-300',
                    i < strength.level
                      ? strength.color
                      : 'bg-[var(--color-surface)]',
                  )}
                />
              ))}
            </div>
            <span
              className={clsx(
                'text-[11px] font-medium',
                strength.level === 1 && 'text-red-500',
                strength.level === 2 && 'text-amber-500',
                strength.level === 3 && 'text-yellow-600',
                strength.level === 4 && 'text-emerald-600',
              )}
            >
              {strength.label}
            </span>
          </div>
        )}

        {errors.new_password && (
          <p className="text-xs text-red-500">{errors.new_password.message}</p>
        )}
      </div>

      {/* Confirm Password */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-[var(--color-text-primary)]">
          Confirm Password
        </label>
        <div className="relative">
          <Lock
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]"
            strokeWidth={1.5}
          />
          <input
            {...register('confirm_password')}
            type={showConfirm ? 'text' : 'password'}
            placeholder="Repeat your password"
            autoComplete="new-password"
            className={inputCx(!!errors.confirm_password)}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-0.5"
            aria-label={showConfirm ? 'Hide password' : 'Show password'}
          >
            {showConfirm ? (
              <EyeOff className="w-4 h-4" strokeWidth={1.5} />
            ) : (
              <Eye className="w-4 h-4" strokeWidth={1.5} />
            )}
          </button>
        </div>
        {errors.confirm_password && (
          <p className="text-xs text-red-500">
            {errors.confirm_password.message}
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className={clsx(
          'w-full py-3 mt-1 rounded-xl text-sm font-semibold',
          'bg-[var(--color-gold)] text-[var(--color-navy)]',
          'hover:bg-[var(--color-gold-light)] active:scale-[0.98]',
          'flex items-center justify-center gap-2',
          'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
          'disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100',
        )}
      >
        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
        Activate Account
      </button>
    </form>
  );
}
