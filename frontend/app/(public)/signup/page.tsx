'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Building2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  Mail,
  Quote,
  School,
} from 'lucide-react';
import { clsx } from 'clsx';
import Link from 'next/link';
import toast from 'react-hot-toast';

import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

// ─── Constants ────────────────────────────────────────────────────────────────

const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'FCT (Abuja)', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina',
  'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo',
  'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
];

const SCHOOL_TYPES = [
  { value: 'primary' as const, label: 'Primary School', Icon: BookOpen },
  { value: 'secondary' as const, label: 'Secondary School', Icon: GraduationCap },
  { value: 'both' as const, label: 'Both', Icon: Building2 },
];

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z
  .object({
    school_name: z.string().min(2, 'School name is required'),
    school_type: z.enum(['primary', 'secondary', 'both'] as const, {
      required_error: 'Select a school type',
    }),
    state: z.string().min(1, 'Select a state'),
    lga: z.string().min(2, 'LGA is required'),
    address: z.string().min(5, 'Enter a valid address'),
    phone: z.string().min(8, 'Enter a valid phone number'),
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCx = (hasError: boolean) =>
  clsx(
    'w-full px-3.5 py-3 text-sm rounded-xl bg-white border',
    'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
    'focus:outline-none focus:ring-2 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
    hasError
      ? 'border-red-300 focus:ring-red-100'
      : 'border-[var(--color-border)] focus:ring-[var(--color-gold)]/25 focus:border-[var(--color-gold)]',
  );

// ─── OTP Input Component ──────────────────────────────────────────────────────

interface OTPInputProps {
  onComplete: (otp: string) => void;
  error: string;
  disabled: boolean;
  resetKey: number;
}

function OTPInput({ onComplete, error, disabled, resetKey }: OTPInputProps) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null));

  // Reset digits when resetKey changes
  useEffect(() => {
    setDigits(Array(6).fill(''));
    inputRefs.current[0]?.focus();
  }, [resetKey]);

  const handleChange = useCallback(
    (index: number, value: string) => {
      // Handle paste
      if (value.length > 1) {
        const pasted = value.replace(/\D/g, '').slice(0, 6);
        const next = Array(6).fill('');
        pasted.split('').forEach((ch, i) => { next[i] = ch; });
        setDigits(next);
        const focusIndex = Math.min(pasted.length, 5);
        inputRefs.current[focusIndex]?.focus();
        if (pasted.length === 6) {
          onComplete(pasted);
        }
        return;
      }

      const digit = value.replace(/\D/g, '');
      const next = [...digits];
      next[index] = digit;
      setDigits(next);

      if (digit && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }

      if (next.every((d) => d !== '')) {
        onComplete(next.join(''));
      }
    },
    [digits, onComplete],
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace') {
        if (digits[index]) {
          const next = [...digits];
          next[index] = '';
          setDigits(next);
        } else if (index > 0) {
          inputRefs.current[index - 1]?.focus();
          const next = [...digits];
          next[index - 1] = '';
          setDigits(next);
        }
      }
    },
    [digits],
  );

  return (
    <div className="flex gap-2 justify-center">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className={clsx(
            'w-[52px] h-[60px] text-center text-2xl font-mono font-bold rounded-[10px]',
            'border-2 bg-white outline-none transition-all duration-150',
            'text-[var(--color-navy)] disabled:opacity-50 disabled:cursor-not-allowed',
            error
              ? 'border-red-400'
              : digit
              ? 'border-[var(--color-navy)]'
              : 'border-[var(--color-border)] focus:border-[var(--color-gold)]',
          )}
        />
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SignupPage() {
  const router = useRouter();
  const loginStore = useAuthStore((s) => s.login);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [verificationToken, setVerificationToken] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpResetKey, setOtpResetKey] = useState(0);
  const [otpDisabled, setOtpDisabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'verifying' | 'creating' | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [emailAlreadyExists, setEmailAlreadyExists] = useState(false);

  const {
    register,
    trigger,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { school_type: undefined },
    mode: 'onTouched',
  });

  const schoolType = watch('school_type');
  const watchedEmail = watch('email');

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // ── Step navigation ──────────────────────────────────────────────────────

  const goToStep2 = async () => {
    const valid = await trigger(['school_name', 'school_type', 'state', 'lga', 'address', 'phone']);
    if (valid) setStep(2);
  };

  const goBackToStep1 = () => setStep(1);

  const goBackToStep2 = () => {
    setStep(2);
    setVerificationToken('');
    setOtpError('');
    setOtpDisabled(false);
    setOtpResetKey((k) => k + 1);
  };

  // ── Send OTP ─────────────────────────────────────────────────────────────

  const handleSendOTP = async () => {
    const valid = await trigger(['admin_name', 'email', 'password', 'confirm_password', 'terms']);
    if (!valid) return;

    setEmailAlreadyExists(false);
    setIsLoading(true);
    try {
      const { email, school_name } = getValues();
      await authApi.sendOTP({ email, school_name });
      setResendCooldown(60);
      setOtpResetKey((k) => k + 1);
      setOtpError('');
      setOtpDisabled(false);
      setStep(3);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })
        ?.response?.data?.detail;
      const code = typeof detail === 'object' && detail !== null
        ? (detail as { code?: string }).code
        : null;
      if (code === 'EMAIL_ALREADY_REGISTERED') {
        setEmailAlreadyExists(true);
      } else {
        const message = typeof detail === 'string'
          ? detail
          : typeof detail === 'object' && detail !== null
          ? (detail as { detail?: string }).detail ?? 'Failed to send code. Try again.'
          : 'Failed to send code. Try again.';
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Resend OTP ───────────────────────────────────────────────────────────

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    try {
      const { email, school_name } = getValues();
      await authApi.sendOTP({ email, school_name });
      setResendCooldown(60);
      setOtpResetKey((k) => k + 1);
      setOtpError('');
      setOtpDisabled(false);
      toast.success('New code sent');
    } catch {
      toast.error('Failed to resend code. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Verify OTP + register ────────────────────────────────────────────────

  const handleOTPComplete = async (otp: string) => {
    if (isSubmitting) return;
    setOtpError('');
    setIsSubmitting(true);
    setSubmitStatus('verifying');

    try {
      const { email } = getValues();
      const res = await authApi.verifyOTP({ email, otp });
      const token = res.data.verification_token;
      setVerificationToken(token);

      // Proceed to create account
      setSubmitStatus('creating');
      const data = getValues();
      const phone = '+234' + data.phone.replace(/\D/g, '').replace(/^0/, '');

      const registerRes = await authApi.registerSchool({
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

      loginStore(registerRes.data);
      toast.success('🎉 Welcome to EduMag NG!');
      router.push('/dashboard/super-admin');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })
        ?.response?.data?.detail;
      const code = typeof detail === 'object' && detail !== null
        ? (detail as { code?: string }).code
        : null;
      const message = typeof detail === 'object' && detail !== null
        ? (detail as { detail?: string }).detail ?? 'Something went wrong.'
        : typeof detail === 'string'
        ? detail
        : 'Something went wrong.';

      if (code === 'OTP_INVALID' || code === 'OTP_EXPIRED' || code === 'OTP_MAX_ATTEMPTS' || code === 'OTP_NOT_FOUND') {
        setOtpError(message);
        setOtpResetKey((k) => k + 1);
        if (code === 'OTP_MAX_ATTEMPTS') setOtpDisabled(true);
      } else {
        // Registration error — go back to step 2
        toast.error(message);
        setStep(2);
        setVerificationToken('');
      }
      setSubmitStatus(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Left panel (static) ─────────────────────────────────────────────────

  const LeftPanel = (
    <div className="hidden lg:flex lg:w-2/5 bg-[var(--color-navy)] flex-col relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-16 -right-16 w-80 h-80 rounded-full bg-[var(--color-gold)]/[0.05] blur-3xl" />
        <div className="absolute bottom-1/3 -left-10 w-60 h-60 rounded-full bg-[var(--color-navy-light)]/40 blur-3xl" />
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
          <Quote className="w-8 h-8 text-[var(--color-gold)]/40 mb-5" strokeWidth={1} />
          <blockquote className="text-3xl font-bold font-display text-white leading-tight tracking-tight mb-6">
            Join{' '}
            <span className="text-[var(--color-gold)]">500+</span> Nigerian
            Schools on EduMag NG
          </blockquote>
          <p className="text-sm text-white/50 leading-relaxed max-w-xs">
            From primary schools in Lagos to secondary schools in Kano —
            EduMag NG is built for every Nigerian classroom.
          </p>
        </div>
      </div>
      <div className="relative z-10 p-10 grid grid-cols-2 gap-3">
        {[
          { val: '500+', label: 'Active Schools' },
          { val: '120k+', label: 'Students Managed' },
          { val: '36', label: 'States Covered' },
          { val: '99.8%', label: 'Uptime' },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white/[0.04] rounded-xl p-3 border border-white/[0.06]"
          >
            <p className="text-lg font-bold font-display text-[var(--color-gold)] tracking-tight">
              {s.val}
            </p>
            <p className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── Progress bar ─────────────────────────────────────────────────────────

  const progressPct = step === 1 ? 33 : step === 2 ? 66 : 100;
  const stepLabel = step === 1 ? 'School Information' : step === 2 ? 'Your Account' : 'Verify Email';

  const ProgressBar = (
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
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );

  // ─── Step 3b loading overlay ──────────────────────────────────────────────

  if (isSubmitting && submitStatus) {
    return (
      <div className="min-h-[100dvh] flex">
        {LeftPanel}
        <div className="flex-1 flex items-center justify-center bg-[var(--color-cream)]">
          <div className="flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-navy)]/5 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-[var(--color-navy)] animate-spin" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold font-display text-[var(--color-navy)]">
                {submitStatus === 'verifying' ? 'Verifying...' : 'Creating your school...'}
              </p>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                {submitStatus === 'verifying'
                  ? 'Checking your verification code'
                  : 'Setting up your EduMag NG account'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex">
      {LeftPanel}

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-[var(--color-cream)] overflow-y-auto">
        <div className="w-full max-w-md py-8">
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
              {step === 3 ? 'Check your email' : 'Create your school'}
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {step === 3
                ? 'Enter the 6-digit code we sent you.'
                : 'Set up your EduMag NG account in under 2 minutes.'}
            </p>
          </div>

          {ProgressBar}

          {/* ── STEP 1 — School Information ── */}
          {step === 1 && (
            <div className="flex flex-col gap-5">
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

          {/* ── STEP 2 — Your Account ── */}
          {step === 2 && (
            <div className="flex flex-col gap-5">
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

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[var(--color-text-primary)]">
                  Email Address
                </label>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="ngozi@brightfuture.edu.ng"
                  autoComplete="email"
                  onChange={() => setEmailAlreadyExists(false)}
                  className={inputCx(!!errors.email || emailAlreadyExists)}
                />
                {errors.email && (
                  <p className="text-xs text-red-500">{errors.email.message}</p>
                )}
                {emailAlreadyExists && (
                  <p className="text-xs text-red-500">
                    An account with this email already exists.{' '}
                    <Link
                      href="/login"
                      className="underline underline-offset-2 font-medium hover:text-red-700"
                    >
                      Log in instead →
                    </Link>
                  </p>
                )}
              </div>

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
                  >
                    {showPassword
                      ? <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                      : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-500">{errors.password.message}</p>
                )}
              </div>

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
                  >
                    {showConfirm
                      ? <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                      : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                  </button>
                </div>
                {errors.confirm_password && (
                  <p className="text-xs text-red-500">{errors.confirm_password.message}</p>
                )}
              </div>

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

              <div className="flex gap-3 mt-1">
                <button
                  type="button"
                  onClick={goBackToStep1}
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
                  onClick={handleSendOTP}
                  disabled={isLoading}
                  className={clsx(
                    'flex-1 py-3 rounded-xl text-sm font-semibold',
                    'bg-[var(--color-gold)] text-[var(--color-navy)]',
                    'hover:bg-[var(--color-gold-light)] active:scale-[0.98]',
                    'flex items-center justify-center gap-2',
                    'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
                    'disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100',
                  )}
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Send Verification Code
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3 — OTP Verification ── */}
          {step === 3 && (
            <div className="flex flex-col items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-gold)]/10 flex items-center justify-center">
                <Mail className="w-8 h-8 text-[var(--color-gold)]" strokeWidth={1.5} />
              </div>

              <div className="text-center">
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                  We sent a 6-digit code to{' '}
                  <span className="font-semibold text-[var(--color-navy)]">
                    {watchedEmail}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={goBackToStep2}
                  className="mt-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-navy)] transition-colors underline underline-offset-2"
                >
                  Wrong email?
                </button>
              </div>

              <div className="w-full flex flex-col items-center gap-4">
                <OTPInput
                  onComplete={handleOTPComplete}
                  error={otpError}
                  disabled={otpDisabled}
                  resetKey={otpResetKey}
                />

                {otpError && (
                  <p className="text-sm text-red-500 text-center">{otpError}</p>
                )}

                <div className="flex flex-col items-center gap-1 mt-2">
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Didn&apos;t receive it?
                  </p>
                  {resendCooldown > 0 ? (
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Resend in 0:{String(resendCooldown).padStart(2, '0')}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={isLoading}
                      className="text-xs font-medium text-[var(--color-gold)] hover:underline underline-offset-2 disabled:opacity-50"
                    >
                      {isLoading ? 'Sending...' : 'Resend code'}
                    </button>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={goBackToStep2}
                className={clsx(
                  'flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium',
                  'text-[var(--color-text-primary)] bg-white border border-[var(--color-border)]',
                  'hover:bg-[var(--color-surface)] active:scale-[0.98]',
                  'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
                )}
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={2} />
                Back
              </button>
            </div>
          )}

          <p className="mt-8 text-center text-xs text-[var(--color-text-muted)]">
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
  );
}
