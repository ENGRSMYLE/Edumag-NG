'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import {
  Building2,
  BookOpen,
  GraduationCap,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

// ─── Nigerian States ───────────────────────────────────────────────────────────
const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'FCT (Abuja)', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina',
  'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo',
  'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
];

// ─── Zod Schema ───────────────────────────────────────────────────────────────
const schema = z
  .object({
    // Step 1
    school_name: z.string().min(2, 'School name is required'),
    school_type: z.enum(['primary', 'secondary', 'both'] as const, {
      required_error: 'Select a school type',
    }),
    state: z.string().min(1, 'Select a state'),
    lga: z.string().min(2, 'LGA is required'),
    address: z.string().min(5, 'Enter a valid address'),
    phone: z.string().min(8, 'Enter a valid phone number'),
    // Step 2
    admin_name: z.string().min(2, 'Your name is required'),
    email: z.string().email('Enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string(),
    terms: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the terms to continue' }),
    }),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

type FormData = z.infer<typeof schema>;

// ─── School Type Cards ────────────────────────────────────────────────────────
const SCHOOL_TYPES = [
  { value: 'primary', label: 'Primary School', Icon: BookOpen },
  { value: 'secondary', label: 'Secondary School', Icon: GraduationCap },
  { value: 'both', label: 'Both', Icon: Building2 },
] as const;

// ─── Input style ──────────────────────────────────────────────────────────────
const inputCx = (hasError: boolean) =>
  clsx(
    'w-full px-3.5 py-3 text-sm rounded-xl',
    'bg-white border',
    'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
    'focus:outline-none focus:ring-2',
    'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
    hasError
      ? 'border-red-300 focus:ring-red-100'
      : 'border-[var(--color-border)] focus:ring-[var(--color-gold)]/25 focus:border-[var(--color-gold)]',
  );

// ─── Component ────────────────────────────────────────────────────────────────
export function SignupForm() {
  const router = useRouter();
  const loginStore = useAuthStore((s) => s.login);
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { school_type: undefined },
    mode: 'onTouched',
  });

  const schoolType = watch('school_type');

  const goToStep2 = async () => {
    const valid = await trigger([
      'school_name',
      'school_type',
      'state',
      'lga',
      'address',
      'phone',
    ]);
    if (valid) setStep(2);
  };

  const onSubmit = async (data: FormData) => {
    // Prepend +234 and strip spaces/dashes entered by user
    const phone = '+234' + data.phone.replace(/\D/g, '').replace(/^0/, '');

    try {
      const res = await authApi.registerSchool({
        school_name: data.school_name,
        school_type: data.school_type,
        address: data.address,
        lga: data.lga,
        state: data.state,
        phone,
        admin_name: data.admin_name,
        email: data.email,
        password: data.password,
      });

      loginStore(res.data);
      toast.success('Welcome to EduMag NG! Your school has been created.');
      router.push('/dashboard/super-admin');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })
        ?.response?.data?.detail;
      let message = 'Registration failed. Please try again.';
      if (typeof detail === 'string') {
        message = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        const first = detail[0] as { msg?: string };
        if (typeof first?.msg === 'string') {
          // Strip "Value error, " prefix Pydantic adds
          message = first.msg.replace(/^Value error,\s*/i, '');
        }
      }
      toast.error(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-0">
      {/* Progress bar */}
      <div className="flex flex-col gap-2 mb-7">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--color-text-muted)]">
            Step {step} of 2
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {step === 1 ? 'School Information' : 'Your Account'}
          </span>
        </div>
        <div className="h-1.5 bg-[var(--color-surface)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-gold)] rounded-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ width: step === 1 ? '50%' : '100%' }}
          />
        </div>
      </div>

      {/* ── STEP 1 ── */}
      {step === 1 && (
        <div className="flex flex-col gap-5">
          {/* School Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--color-text-primary)]">
              School Name
            </label>
            <input
              {...register('school_name')}
              placeholder="Bright Future Academy"
              className={inputCx(!!errors.school_name)}
            />
            {errors.school_name && (
              <p className="text-xs text-red-500">{errors.school_name.message}</p>
            )}
          </div>

          {/* School Type */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-[var(--color-text-primary)]">
              School Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SCHOOL_TYPES.map(({ value, label, Icon }) => {
                const selected = schoolType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setValue('school_type', value, {
                        shouldValidate: true,
                      })
                    }
                    className={clsx(
                      'flex flex-col items-center gap-2 py-3 px-2 rounded-xl border text-center',
                      'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
                      selected
                        ? 'border-[var(--color-navy)] bg-[var(--color-navy)]/5 ring-2 ring-[var(--color-navy)]/10'
                        : 'border-[var(--color-border)] bg-white hover:border-[var(--color-navy)]/30',
                    )}
                  >
                    <div
                      className={clsx(
                        'w-7 h-7 rounded-lg flex items-center justify-center',
                        selected
                          ? 'bg-[var(--color-navy)] text-white'
                          : 'bg-[var(--color-surface)] text-[var(--color-text-muted)]',
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </div>
                    <span
                      className={clsx(
                        'text-[10px] font-medium leading-tight',
                        selected
                          ? 'text-[var(--color-navy)]'
                          : 'text-[var(--color-text-secondary)]',
                      )}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
            {errors.school_type && (
              <p className="text-xs text-red-500">{errors.school_type.message}</p>
            )}
          </div>

          {/* State */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--color-text-primary)]">
              State
            </label>
            <select
              {...register('state')}
              className={clsx(inputCx(!!errors.state), 'cursor-pointer')}
            >
              <option value="">Select a state</option>
              {NIGERIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {errors.state && (
              <p className="text-xs text-red-500">{errors.state.message}</p>
            )}
          </div>

          {/* LGA */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--color-text-primary)]">
              LGA
            </label>
            <input
              {...register('lga')}
              placeholder="Ikeja"
              className={inputCx(!!errors.lga)}
            />
            {errors.lga && (
              <p className="text-xs text-red-500">{errors.lga.message}</p>
            )}
          </div>

          {/* Address */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--color-text-primary)]">
              School Address
            </label>
            <textarea
              {...register('address')}
              rows={2}
              placeholder="14 Bode Thomas Street, Surulere"
              className={clsx(inputCx(!!errors.address), 'resize-none')}
            />
            {errors.address && (
              <p className="text-xs text-red-500">{errors.address.message}</p>
            )}
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--color-text-primary)]">
              School Phone Number
            </label>
            <div className="flex items-stretch gap-0">
              <span className="flex items-center px-3.5 text-xs font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface)] border border-[var(--color-border)] border-r-0 rounded-l-xl">
                +234
              </span>
              <input
                {...register('phone')}
                type="tel"
                placeholder="801 234 5678"
                className={clsx(
                  inputCx(!!errors.phone),
                  'rounded-l-none border-l-0',
                )}
              />
            </div>
            {errors.phone && (
              <p className="text-xs text-red-500">{errors.phone.message}</p>
            )}
          </div>

          {/* Next */}
          <button
            type="button"
            onClick={goToStep2}
            className={clsx(
              'w-full py-3 mt-1 rounded-xl text-sm font-semibold',
              'bg-[var(--color-navy)] text-white',
              'hover:bg-[var(--color-navy-mid)] active:scale-[0.98]',
              'flex items-center justify-center gap-2',
              'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
            )}
          >
            Continue
            <ChevronRight className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      )}

      {/* ── STEP 2 ── */}
      {step === 2 && (
        <div className="flex flex-col gap-5">
          {/* Admin Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--color-text-primary)]">
              Your Full Name
            </label>
            <input
              {...register('admin_name')}
              placeholder="Ngozi Adeyemi"
              className={inputCx(!!errors.admin_name)}
            />
            {errors.admin_name && (
              <p className="text-xs text-red-500">{errors.admin_name.message}</p>
            )}
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--color-text-primary)]">
              Email Address
            </label>
            <input
              {...register('email')}
              type="email"
              placeholder="ngozi@brightfuture.edu.ng"
              autoComplete="email"
              className={inputCx(!!errors.email)}
            />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--color-text-primary)]">
              Password
            </label>
            <div className="relative">
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
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

          {/* Confirm password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--color-text-primary)]">
              Confirm Password
            </label>
            <div className="relative">
              <input
                {...register('confirm_password')}
                type={showConfirm ? 'text' : 'password'}
                placeholder="Repeat your password"
                autoComplete="new-password"
                className={clsx(inputCx(!!errors.confirm_password), 'pr-11')}
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

          {/* Terms */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5 flex-shrink-0">
              <input
                {...register('terms')}
                type="checkbox"
                className="sr-only peer"
              />
              <div
                className={clsx(
                  'w-4 h-4 rounded border',
                  'peer-checked:bg-[var(--color-navy)] peer-checked:border-[var(--color-navy)]',
                  'border-[var(--color-border)] bg-white',
                  'transition-all duration-150',
                  errors.terms ? 'border-red-300' : '',
                )}
              />
              <svg
                className="absolute inset-0 w-4 h-4 p-[3px] text-white hidden peer-checked:block pointer-events-none"
                viewBox="0 0 10 8"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M1 4l2.5 2.5L9 1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              I agree to the{' '}
              <a href="#" className="underline underline-offset-2 hover:text-[var(--color-navy)]">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="#" className="underline underline-offset-2 hover:text-[var(--color-navy)]">
                Privacy Policy
              </a>
            </span>
          </label>
          {errors.terms && (
            <p className="-mt-3 text-xs text-red-500">{errors.terms.message}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-1">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-3 rounded-xl text-sm font-medium',
                'text-[var(--color-text-primary)] bg-white border border-[var(--color-border)]',
                'hover:bg-[var(--color-surface)] active:scale-[0.98]',
                'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
              )}
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={2} />
              Back
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className={clsx(
                'flex-1 py-3 rounded-xl text-sm font-semibold',
                'bg-[var(--color-gold)] text-[var(--color-navy)]',
                'hover:bg-[var(--color-gold-light)] active:scale-[0.98]',
                'flex items-center justify-center gap-2',
                'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
                'disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100',
              )}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Create School Account
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
