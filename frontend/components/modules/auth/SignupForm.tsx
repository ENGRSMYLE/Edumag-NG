'use client';

import { useState, useRef } from 'react';
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
  Mail,
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

// ─── Password strength helper ─────────────────────────────────────────────────
const passwordRules = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'Uppercase letter (A–Z)', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter (a–z)', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Number (0–9)', test: (p: string) => /[0-9]/.test(p) },
  { label: 'Special character (!@#$…)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const getPasswordStrength = (password: string) =>
  passwordRules.filter((r) => r.test(password)).length;

const STRENGTH_LABEL = ['', 'Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
const STRENGTH_COLOR = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400', 'bg-green-600'];

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
    phone: z
      .string()
      .min(1, 'Phone number is required')
      .regex(/^[0-9]{7,11}$/, 'Enter a valid Nigerian phone number (7–11 digits)'),
    // Step 2
    admin_name: z.string().min(2, 'Your full name is required'),
    email: z.string().email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
    confirm_password: z.string().min(1, 'Please confirm your password'),
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
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [verificationToken, setVerificationToken] = useState('');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { school_type: undefined },
    mode: 'onTouched',
  });

  const schoolType = watch('school_type');
  const passwordValue = watch('password') ?? '';

  // ── Step 1 → Step 2 ────────────────────────────────────────────────────────
  const goToStep2 = async () => {
    const valid = await trigger([
      'school_name', 'school_type', 'state', 'lga', 'address', 'phone',
    ]);
    if (valid) setStep(2);
  };

  // ── Step 2 → Step 3: validate account fields then send OTP ─────────────────
  const goToStep3 = async () => {
    const valid = await trigger(['admin_name', 'email', 'password', 'confirm_password', 'terms']);
    if (!valid) return;

    setIsSendingOtp(true);
    try {
      await authApi.sendOTP({
        email: getValues('email'),
        school_name: getValues('school_name'),
      });
      toast.success('Verification code sent to your email');
      setOtpDigits(['', '', '', '', '', '']);
      setStep(3);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })
        ?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to send verification code.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // ── OTP digit input handler ─────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otpDigits];
    next[index] = value.slice(-1);
    setOtpDigits(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setOtpDigits(text.split(''));
      otpRefs.current[5]?.focus();
    }
  };

  // ── Resend OTP ──────────────────────────────────────────────────────────────
  const resendOtp = async () => {
    setIsSendingOtp(true);
    try {
      await authApi.sendOTP({
        email: getValues('email'),
        school_name: getValues('school_name'),
      });
      toast.success('New code sent');
      setOtpDigits(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } catch {
      toast.error('Failed to resend code');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // ── Step 3: verify OTP then register ───────────────────────────────────────
  const onVerifyAndRegister = async () => {
    const otp = otpDigits.join('');
    if (otp.length !== 6) {
      toast.error('Enter the 6-digit code');
      return;
    }

    setIsVerifying(true);
    try {
      // 1. Verify OTP → get verification_token
      let token = verificationToken;
      if (!token) {
        const verifyRes = await authApi.verifyOTP({
          email: getValues('email'),
          otp,
        });
        token = verifyRes.data.verification_token;
        setVerificationToken(token);
      }

      // 2. Register school
      const data = getValues();
      const phone = '+234' + data.phone.replace(/\D/g, '').replace(/^0/, '');
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
        verification_token: token,
      });

      loginStore(res.data);
      toast.success('Welcome to EduMag NG! Your school has been created.');
      router.push('/dashboard/super-admin');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })
        ?.response?.data?.detail;
      let message = 'Verification failed. Please try again.';
      if (typeof detail === 'string') {
        message = detail;
      } else if (detail && typeof detail === 'object' && 'detail' in detail) {
        message = (detail as { detail: string }).detail;
      }
      toast.error(message);
      // Reset token so next attempt re-verifies OTP
      setVerificationToken('');
    } finally {
      setIsVerifying(false);
    }
  };

  const stepLabel = step === 1 ? 'School Information' : step === 2 ? 'Your Account' : 'Verify Email';

  return (
    <div className="flex flex-col gap-0">
      {/* Progress bar */}
      <div className="flex flex-col gap-2 mb-7">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--color-text-muted)]">
            Step {step} of 3
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">{stepLabel}</span>
        </div>
        <div className="h-1.5 bg-[var(--color-surface)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-gold)] rounded-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ width: step === 1 ? '33%' : step === 2 ? '66%' : '100%' }}
          />
        </div>
      </div>

      {/* ── STEP 1: School Info ── */}
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
                    onClick={() => setValue('school_type', value, { shouldValidate: true })}
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
                <option key={s} value={s}>{s}</option>
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
                className={clsx(inputCx(!!errors.phone), 'rounded-l-none border-l-0')}
              />
            </div>
            {errors.phone && (
              <p className="text-xs text-red-500">{errors.phone.message}</p>
            )}
          </div>

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

      {/* ── STEP 2: Admin Account ── */}
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
                {showPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
              </button>
            </div>
            {/* Strength meter */}
            {passwordValue.length > 0 && (() => {
              const strength = getPasswordStrength(passwordValue);
              return (
                <div className="flex flex-col gap-1.5 mt-0.5">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={clsx(
                          'h-1 flex-1 rounded-full transition-all duration-300',
                          i <= strength ? STRENGTH_COLOR[strength] : 'bg-[var(--color-border)]',
                        )}
                      />
                    ))}
                  </div>
                  <p className={clsx(
                    'text-xs font-medium',
                    strength <= 2 ? 'text-red-500' : strength === 3 ? 'text-yellow-600' : 'text-green-600',
                  )}>
                    {STRENGTH_LABEL[strength]}
                  </p>
                  <ul className="flex flex-col gap-0.5">
                    {passwordRules.map((rule) => {
                      const passed = rule.test(passwordValue);
                      return (
                        <li key={rule.label} className={clsx('text-[11px] flex items-center gap-1.5', passed ? 'text-green-600' : 'text-[var(--color-text-muted)]')}>
                          <span className={clsx('inline-block w-3.5 h-3.5 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold', passed ? 'bg-green-100 text-green-600' : 'bg-[var(--color-surface)] text-[var(--color-text-muted)]')}>
                            {passed ? '✓' : '·'}
                          </span>
                          {rule.label}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })()}
            {errors.password && !passwordValue && (
              <p className="text-xs text-red-500">{errors.password.message}</p>
            )}
          </div>

          {/* Confirm Password */}
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
                {showConfirm ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
              </button>
            </div>
            {errors.confirm_password && (
              <p className="text-xs text-red-500">{errors.confirm_password.message}</p>
            )}
          </div>

          {/* Terms */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5 flex-shrink-0">
              <input {...register('terms')} type="checkbox" className="sr-only peer" />
              <div
                className={clsx(
                  'w-4 h-4 rounded border',
                  'peer-checked:bg-[var(--color-navy)] peer-checked:border-[var(--color-navy)]',
                  'border-[var(--color-border)] bg-white transition-all duration-150',
                  errors.terms ? 'border-red-300' : '',
                )}
              />
              <svg
                className="absolute inset-0 w-4 h-4 p-[3px] text-white hidden peer-checked:block pointer-events-none"
                viewBox="0 0 10 8"
                fill="none"
                aria-hidden="true"
              >
                <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              I agree to the{' '}
              <a href="#" className="underline underline-offset-2 hover:text-[var(--color-navy)]">Terms of Service</a>
              {' '}and{' '}
              <a href="#" className="underline underline-offset-2 hover:text-[var(--color-navy)]">Privacy Policy</a>
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
              type="button"
              onClick={goToStep3}
              disabled={isSendingOtp || getPasswordStrength(passwordValue) < 5}
              title={getPasswordStrength(passwordValue) < 5 ? 'Password does not meet all requirements' : undefined}
              className={clsx(
                'flex-1 py-3 rounded-xl text-sm font-semibold',
                'bg-[var(--color-gold)] text-[var(--color-navy)]',
                'hover:bg-[var(--color-gold-light)] active:scale-[0.98]',
                'flex items-center justify-center gap-2',
                'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
                'disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100',
              )}
            >
              {isSendingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              {isSendingOtp ? 'Sending Code...' : 'Verify Email'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: OTP Verification ── */}
      {step === 3 && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1 text-center">
            <p className="text-sm text-[var(--color-text-secondary)]">
              We sent a 6-digit code to
            </p>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {getValues('email')}
            </p>
          </div>

          {/* OTP Boxes */}
          <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
            {otpDigits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { otpRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                className={clsx(
                  'w-11 h-12 text-center text-lg font-bold rounded-xl border',
                  'bg-white text-[var(--color-text-primary)]',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/25 focus:border-[var(--color-gold)]',
                  'transition-all duration-200',
                  digit ? 'border-[var(--color-navy)]' : 'border-[var(--color-border)]',
                )}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={onVerifyAndRegister}
            disabled={isVerifying || otpDigits.join('').length !== 6}
            className={clsx(
              'w-full py-3 rounded-xl text-sm font-semibold',
              'bg-[var(--color-gold)] text-[var(--color-navy)]',
              'hover:bg-[var(--color-gold-light)] active:scale-[0.98]',
              'flex items-center justify-center gap-2',
              'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
              'disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100',
            )}
          >
            {isVerifying && <Loader2 className="w-4 h-4 animate-spin" />}
            {isVerifying ? 'Creating Account...' : 'Create School Account'}
          </button>

          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex items-center gap-1 hover:text-[var(--color-text-primary)] transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} />
              Change email
            </button>
            <button
              type="button"
              onClick={resendOtp}
              disabled={isSendingOtp}
              className="hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50"
            >
              {isSendingOtp ? 'Sending...' : 'Resend code'}
            </button>
          </div>
        </div>
      )}

      {/* Hidden form fields needed for handleSubmit — not used directly */}
      <form onSubmit={handleSubmit(() => {})} className="hidden" aria-hidden="true" />
    </div>
  );
}
