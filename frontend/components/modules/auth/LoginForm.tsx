'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { UserRole, TokenResponse } from '@/types/auth';

const ROLE_HOME: Record<UserRole, string> = {
  super_admin: '/dashboard/super-admin',
  admin: '/dashboard/admin',
  teacher: '/dashboard/staff',
};

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

const inputCx = (hasError: boolean) =>
  clsx(
    'w-full pl-10 pr-4 py-3 text-sm rounded-xl',
    'bg-white border',
    'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
    'focus:outline-none focus:ring-2',
    'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
    hasError
      ? 'border-red-300 focus:ring-red-100'
      : 'border-[var(--color-border)] focus:ring-[var(--color-gold)]/25 focus:border-[var(--color-gold)]',
  );

export function LoginForm() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const setSchoolOptions = useAuthStore((s) => s.setSchoolOptions);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await authApi.login(data);
      const response = res.data;

      // Multi-school: redirect to school picker
      if ('requires_school_selection' in response && response.requires_school_selection) {
        setSchoolOptions(response.schools, response.temp_token);
        router.push('/select-school');
        return;
      }

      // Single school: log in directly
      login(response as TokenResponse);

      if (response.user.is_first_login) {
        router.push('/set-password');
        return;
      }

      const dest = ROLE_HOME[response.user.role] ?? '/login';
      router.push(dest);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })
        ?.response?.data?.detail;
      toast.error(
        typeof detail === 'string'
          ? detail
          : 'Invalid credentials. Please try again.',
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {/* Email */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-[var(--color-text-primary)]">
          Email Address
        </label>
        <div className="relative">
          <Mail
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]"
            strokeWidth={1.5}
          />
          <input
            {...register('email')}
            type="email"
            placeholder="principal@school.edu.ng"
            autoComplete="email"
            className={inputCx(!!errors.email)}
          />
        </div>
        {errors.email && (
          <p className="text-xs text-red-500">{errors.email.message}</p>
        )}
      </div>

      {/* Password */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-[var(--color-text-primary)]">
            Password
          </label>
          <a
            href="#"
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-navy)] transition-colors"
          >
            Forgot password?
          </a>
        </div>
        <div className="relative">
          <Lock
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]"
            strokeWidth={1.5}
          />
          <input
            {...register('password')}
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="current-password"
            className={clsx(inputCx(!!errors.password), 'pr-11')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-0.5"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" strokeWidth={1.5} />
            ) : (
              <Eye className="w-4 h-4" strokeWidth={1.5} />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-red-500">{errors.password.message}</p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className={clsx(
          'w-full py-3 rounded-xl text-sm font-semibold',
          'bg-[var(--color-gold)] text-[var(--color-navy)]',
          'hover:bg-[var(--color-gold-light)] active:scale-[0.98]',
          'flex items-center justify-center gap-2',
          'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
          'disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100',
          'mt-1',
        )}
      >
        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
        Sign In
      </button>
    </form>
  );
}
