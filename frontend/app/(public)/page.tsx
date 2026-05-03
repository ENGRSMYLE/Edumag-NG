import type { CSSProperties } from 'react';
import {
  Users,
  Wallet,
  ClipboardCheck,
  BarChart3,
  MessageCircle,
  ShieldCheck,
  School,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { formatNaira } from '@/lib/formatters';

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <header className="fixed top-0 inset-x-0 z-nav">
      <div className="max-w-6xl mx-auto px-6 pt-5">
        <nav className="flex items-center justify-between bg-white/80 backdrop-blur-sm border border-[var(--color-border)] rounded-2xl px-5 py-3 shadow-[0_4px_20px_-4px_rgba(10,22,40,0.08)]">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-navy)] flex items-center justify-center">
              <School className="w-4 h-4 text-[var(--color-gold)]" strokeWidth={1.5} />
            </div>
            <span className="text-sm font-bold text-[var(--color-navy)] font-display tracking-tight">
              EduMag NG
            </span>
          </Link>

          {/* Links — hidden on mobile */}
          <div className="hidden md:flex items-center gap-6">
            {[
              { label: 'Features', href: '#features' },
              { label: 'How it works', href: '#how-it-works' },
              { label: 'Pricing', href: '#pricing' },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-navy)] transition-colors duration-150"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden sm:block text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-navy)] px-3 py-1.5 rounded-lg hover:bg-[var(--color-surface)] transition-all duration-150"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy-mid)] active:scale-[0.98] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
            >
              Get Started
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function DashboardMockup() {
  return (
    <div className="relative">
      {/* Glow */}
      <div className="absolute -inset-8 bg-[var(--color-gold)]/10 rounded-full blur-3xl" />

      {/* Browser shell */}
      <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-[0_32px_80px_-16px_rgba(0,0,0,0.5)]">
        {/* Browser chrome */}
        <div className="bg-[var(--color-navy-mid)] px-4 py-2.5 flex items-center gap-3 border-b border-white/5">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/60" />
          </div>
          <div className="flex-1 h-4 bg-white/5 rounded-md mx-4" />
        </div>

        {/* Dashboard content */}
        <div className="bg-[var(--color-surface)] flex" style={{ height: '340px' }}>
          {/* Sidebar */}
          <div className="w-36 bg-[var(--color-navy)] flex flex-col gap-1 p-3 flex-shrink-0">
            <div className="h-6 bg-white/20 rounded-lg mb-3" />
            {[0.9, 0.6, 0.7, 0.5, 0.65].map((w, i) => (
              <div
                key={i}
                className="h-6 rounded-lg flex items-center px-2 gap-2"
                style={{ background: i === 0 ? 'rgba(245,166,35,0.2)' : 'transparent' }}
              >
                <div
                  className="w-3 h-3 rounded flex-shrink-0"
                  style={{
                    background: i === 0 ? 'rgba(245,166,35,0.8)' : 'rgba(255,255,255,0.2)',
                  }}
                />
                <div
                  className="h-2.5 bg-white/20 rounded"
                  style={{ width: `${w * 100}%` }}
                />
              </div>
            ))}
          </div>

          {/* Main area */}
          <div className="flex-1 p-4 flex flex-col gap-3 overflow-hidden">
            {/* Stat row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Students', val: '1,247', accent: 'navy' },
                { label: 'Revenue', val: '₦4.2M', accent: 'gold' },
                { label: 'Attendance', val: '94.3%', accent: 'emerald' },
              ].map((s) => (
                <div
                  key={s.label}
                  className="bg-white rounded-lg p-2.5 border-l-2"
                  style={{
                    borderColor:
                      s.accent === 'navy'
                        ? 'var(--color-navy)'
                        : s.accent === 'gold'
                        ? 'var(--color-gold)'
                        : '#16a34a',
                  }}
                >
                  <div className="h-2 bg-[var(--color-surface)] rounded w-12 mb-1.5" />
                  <div
                    className="h-4 rounded font-mono text-xs font-bold flex items-center"
                    style={{
                      color:
                        s.accent === 'navy'
                          ? 'var(--color-navy)'
                          : s.accent === 'gold'
                          ? 'var(--color-gold)'
                          : '#16a34a',
                    }}
                  >
                    {s.val}
                  </div>
                </div>
              ))}
            </div>

            {/* Chart placeholder */}
            <div className="bg-white rounded-lg p-3 flex-1 flex flex-col gap-2 border border-[var(--color-border)]">
              <div className="flex items-end gap-1 flex-1 pt-2">
                {[0.4, 0.65, 0.5, 0.85, 0.6, 0.75, 0.9, 0.55, 0.7, 0.8].map(
                  (h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t"
                      style={{
                        height: `${h * 80}%`,
                        background:
                          i === 9
                            ? 'var(--color-gold)'
                            : 'var(--color-navy)',
                        opacity: i === 9 ? 1 : 0.15 + i * 0.08,
                      }}
                    />
                  ),
                )}
              </div>
              <div className="h-2 bg-[var(--color-surface)] rounded w-20" />
            </div>

            {/* Table rows */}
            <div className="bg-white rounded-lg border border-[var(--color-border)] overflow-hidden">
              <div className="bg-[var(--color-navy)] px-3 py-1.5 flex gap-3">
                {[40, 25, 35].map((w, i) => (
                  <div
                    key={i}
                    className="h-2 bg-white/20 rounded"
                    style={{ width: `${w}%` }}
                  />
                ))}
              </div>
              {[1, 2, 3].map((r) => (
                <div
                  key={r}
                  className="px-3 py-1.5 flex gap-3 border-t border-[var(--color-border)]"
                  style={{
                    background: r % 2 === 0 ? 'white' : 'var(--color-cream)',
                  }}
                >
                  {[40, 25, 35].map((w, i) => (
                    <div
                      key={i}
                      className="h-2 bg-[var(--color-surface)] rounded"
                      style={{ width: `${w}%` }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroSection() {
  return (
    <section className="min-h-[100dvh] bg-[var(--color-navy)] flex items-center relative overflow-hidden">
      {/* Background geometry */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] rounded-full bg-[var(--color-gold)]/[0.03] blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full bg-[var(--color-navy-light)]/40 blur-3xl" />
        {/* Grid lines */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(var(--color-gold) 1px, transparent 1px), linear-gradient(90deg, var(--color-gold) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }}
        />
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-32 pb-24 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Text */}
          <div className="animate-fade-in-up" style={{ '--delay': '0ms' } as unknown as CSSProperties}>
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/10 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-gold)] animate-pulse-soft" />
              <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-[var(--color-gold)]">
                Built for Nigeria
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl xl:text-[3.5rem] font-bold font-display text-white tracking-tight leading-[1.1] mb-6">
              The Modern School{' '}
              <span className="text-[var(--color-gold)]">Management</span>{' '}
              System for Nigerian Schools
            </h1>

            <p className="text-base text-white/60 leading-relaxed mb-8 max-w-[480px]">
              Manage students, track finances in Naira, record attendance, and
              generate result cards — all in one place, built for the Nigerian
              curriculum.
            </p>

            <div className="flex items-center gap-3 flex-wrap">
              <Link
                href="/signup"
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-[var(--color-gold)] text-[var(--color-navy)] hover:bg-[var(--color-gold-light)] active:scale-[0.98] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-[0_0_0_0_rgba(245,166,35,0)]  hover:shadow-[0_0_0_4px_rgba(245,166,35,0.2)]"
              >
                Start Free Trial
                <div className="w-6 h-6 rounded-full bg-[var(--color-navy)]/10 flex items-center justify-center">
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                </div>
              </Link>

              <a
                href="#how-it-works"
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white border border-white/20 hover:bg-white/5 active:scale-[0.98] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
              >
                See How It Works
              </a>
            </div>

            {/* Social proof */}
            <div className="mt-10 flex items-center gap-4 pt-8 border-t border-white/10">
              <div className="flex -space-x-2">
                {['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500'].map(
                  (c, i) => (
                    <div
                      key={i}
                      className={`w-7 h-7 rounded-full ${c} border-2 border-[var(--color-navy)] flex items-center justify-center text-[10px] font-bold text-white`}
                    >
                      {['O', 'A', 'I', 'C'][i]}
                    </div>
                  ),
                )}
              </div>
              <p className="text-xs text-white/50">
                Trusted by{' '}
                <span className="text-white/80 font-medium">500+ schools</span>{' '}
                across Nigeria
              </p>
            </div>
          </div>

          {/* Dashboard mockup */}
          <div
            className="animate-fade-in-up hidden lg:block"
            style={{ '--delay': '150ms' } as unknown as CSSProperties}
          >
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Users,
    title: 'Student Management',
    description:
      'Enrol, transfer and promote students. Bulk upload via spreadsheet. Parent contact always at hand.',
    span: 'lg:col-span-7',
    accent: 'navy',
  },
  {
    icon: Wallet,
    title: 'Finance Tracking',
    description:
      'Record school fees in Naira (kobo precision), track debtors, generate financial reports per term.',
    span: 'lg:col-span-5',
    accent: 'gold',
  },
  {
    icon: ClipboardCheck,
    title: 'Attendance',
    description:
      'Daily roll call by class, monthly summaries, and instant parent notifications.',
    span: 'lg:col-span-5',
    accent: 'success',
  },
  {
    icon: BarChart3,
    title: 'Results & Report Cards',
    description:
      'Enter scores, compute CA + exam totals, approve results and generate printable report cards.',
    span: 'lg:col-span-7',
    accent: 'navy',
  },
  {
    icon: MessageCircle,
    title: 'Communication',
    description:
      'Broadcast announcements to staff and parents. Direct messages between admin and teachers.',
    span: 'lg:col-span-6',
    accent: 'info',
  },
  {
    icon: ShieldCheck,
    title: 'Multi-Role Access',
    description:
      'Super Admin, Admin, and Teacher roles with granular permission control per action.',
    span: 'lg:col-span-6',
    accent: 'navy',
  },
] as const;

const accentMap = {
  navy: {
    iconBg: 'bg-[var(--color-navy)]/10',
    iconColor: 'text-[var(--color-navy)]',
    border: 'border-t-[var(--color-navy)]',
  },
  gold: {
    iconBg: 'bg-[var(--color-gold)]/10',
    iconColor: 'text-[var(--color-gold)]',
    border: 'border-t-[var(--color-gold)]',
  },
  success: {
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    border: 'border-t-emerald-500',
  },
  info: {
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    border: 'border-t-blue-500',
  },
};

function FeaturesSection() {
  return (
    <section id="features" className="bg-white py-24 scroll-mt-20">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] mb-4">
            <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-[var(--color-text-muted)]">
              Everything you need
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold font-display text-[var(--color-navy)] tracking-tight max-w-md">
            Built specifically for Nigerian schools
          </h2>
        </div>

        {/* Asymmetric grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {FEATURES.map((feature, i) => {
            const accent = accentMap[feature.accent as keyof typeof accentMap];
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className={`${feature.span} animate-fade-in-up-stagger`}
                style={{ '--delay': `${i * 60}ms` } as unknown as CSSProperties}
              >
                <div className="h-full bg-black/[0.02] ring-1 ring-black/5 p-1.5 rounded-[1.25rem]">
                  <div
                    className={`h-full bg-[var(--color-cream)] rounded-[calc(1.25rem-0.375rem)] p-5 border-t-4 ${accent.border} shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl ${accent.iconBg} flex items-center justify-center mb-3`}
                    >
                      <Icon
                        className={`w-[18px] h-[18px] ${accent.iconColor}`}
                        strokeWidth={1.5}
                      />
                    </div>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] font-display mb-1.5">
                      {feature.title}
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    num: '01',
    title: 'Sign Up Your School',
    description:
      "Register your school in under 2 minutes. Set your school name, type, and state. You're the Super Admin.",
  },
  {
    num: '02',
    title: 'Set Up Your Team',
    description:
      'Invite admins and teachers by email. They receive a setup link and create their own secure passwords.',
  },
  {
    num: '03',
    title: 'Start Managing',
    description:
      'Enrol students, record fees, take attendance, enter results. Everything lives in one organised platform.',
  },
];

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-[var(--color-cream)] py-24 scroll-mt-20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: header */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[var(--color-border)] mb-4">
              <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-[var(--color-text-muted)]">
                Get started in minutes
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold font-display text-[var(--color-navy)] tracking-tight mb-4">
              Up and running in three steps
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed max-w-sm">
              No complicated setup. No training required. Your team can start
              using EduMag NG the same day you sign up.
            </p>
          </div>

          {/* Right: steps */}
          <div className="relative flex flex-col gap-0">
            {/* Connecting line */}
            <div className="absolute left-[19px] top-8 bottom-8 w-px bg-[var(--color-border)]" />

            {STEPS.map((step, i) => (
              <div
                key={step.num}
                className="relative flex gap-5 pb-8 last:pb-0 animate-fade-in-up-stagger"
                style={{ '--delay': `${i * 100}ms` } as unknown as CSSProperties}
              >
                {/* Number bubble */}
                <div className="relative z-10 w-10 h-10 rounded-xl bg-[var(--color-navy)] flex items-center justify-center flex-shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                  <span className="text-xs font-bold text-[var(--color-gold)] font-display">
                    {step.num}
                  </span>
                </div>

                <div className="pt-2">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)] font-display mb-1">
                    {step.title}
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

const PLANS = [
  {
    name: 'Free',
    price: null,
    priceLabel: '₦0',
    period: 'forever',
    description: 'Perfect for small schools getting started.',
    highlight: false,
    features: [
      'Up to 50 students',
      'Student management',
      'Basic attendance',
      '1 admin account',
    ],
    cta: 'Start Free',
    href: '/signup',
  },
  {
    name: 'Basic',
    price: 1_500_000,
    priceLabel: formatNaira(1_500_000),
    period: 'per term',
    description: 'For growing schools that need the full suite.',
    highlight: true,
    features: [
      'Up to 500 students',
      'Finance & fee tracking',
      'Results & report cards',
      'Staff invite (5 users)',
      'Parent communication',
    ],
    cta: 'Start Free Trial',
    href: '/signup',
  },
  {
    name: 'Premium',
    price: 3_500_000,
    priceLabel: formatNaira(3_500_000),
    period: 'per term',
    description: 'Unlimited scale for large secondary schools.',
    highlight: false,
    features: [
      'Unlimited students',
      'All Basic features',
      'Bulk upload',
      'Unlimited staff',
      'Priority support',
      'Data export & backup',
    ],
    cta: 'Get Premium',
    href: '/signup',
  },
];

function PricingSection() {
  return (
    <section id="pricing" className="bg-white py-24 scroll-mt-20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] mb-4">
            <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-[var(--color-text-muted)]">
              Transparent pricing
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold font-display text-[var(--color-navy)] tracking-tight">
            Pay per term, not per year
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {PLANS.map((plan) => (
            <div key={plan.name} className="relative">
              {plan.highlight && (
                <div className="absolute -top-3 inset-x-0 flex justify-center">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.15em] bg-[var(--color-gold)] text-[var(--color-navy)]">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Card */}
              <div
                className={
                  plan.highlight
                    ? 'bg-[var(--color-navy)] ring-2 ring-[var(--color-gold)]/40 p-1.5 rounded-[1.25rem]'
                    : 'bg-black/[0.02] ring-1 ring-black/5 p-1.5 rounded-[1.25rem]'
                }
              >
                <div
                  className={`rounded-[calc(1.25rem-0.375rem)] p-6 ${
                    plan.highlight
                      ? 'bg-[var(--color-navy-mid)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                      : 'bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]'
                  }`}
                >
                  <p
                    className={`text-xs font-semibold uppercase tracking-wider mb-2 ${
                      plan.highlight
                        ? 'text-[var(--color-gold)]'
                        : 'text-[var(--color-text-muted)]'
                    }`}
                  >
                    {plan.name}
                  </p>

                  <div className="flex items-end gap-1 mb-1">
                    <span
                      className={`text-3xl font-bold font-display tracking-tight ${
                        plan.highlight ? 'text-white' : 'text-[var(--color-text-primary)]'
                      }`}
                    >
                      {plan.priceLabel}
                    </span>
                  </div>
                  <p
                    className={`text-xs mb-4 ${
                      plan.highlight
                        ? 'text-white/50'
                        : 'text-[var(--color-text-muted)]'
                    }`}
                  >
                    {plan.period}
                  </p>

                  <p
                    className={`text-xs leading-relaxed mb-5 ${
                      plan.highlight
                        ? 'text-white/70'
                        : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {plan.description}
                  </p>

                  <ul className="flex flex-col gap-2 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckCircle2
                          className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                            plan.highlight
                              ? 'text-[var(--color-gold)]'
                              : 'text-emerald-500'
                          }`}
                          strokeWidth={1.5}
                        />
                        <span
                          className={`text-xs ${
                            plan.highlight
                              ? 'text-white/80'
                              : 'text-[var(--color-text-secondary)]'
                          }`}
                        >
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={plan.href}
                    className={`block w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] ${
                      plan.highlight
                        ? 'bg-[var(--color-gold)] text-[var(--color-navy)] hover:bg-[var(--color-gold-light)]'
                        : 'bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy-mid)]'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA Banner ───────────────────────────────────────────────────────────────

function CTASection() {
  return (
    <section className="bg-[var(--color-navy)] py-20 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-[var(--color-gold)]/[0.04] blur-3xl" />
      </div>

      <div className="max-w-3xl mx-auto px-6 text-center relative">
        <h2 className="text-3xl md:text-4xl font-bold font-display text-white tracking-tight mb-4">
          Ready to modernize your school?
        </h2>
        <p className="text-sm text-white/60 leading-relaxed mb-8">
          Join hundreds of Nigerian schools already running smarter with EduMag
          NG.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm bg-[var(--color-gold)] text-[var(--color-navy)] hover:bg-[var(--color-gold-light)] active:scale-[0.98] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
        >
          Create Your School Account
          <ChevronRight className="w-4 h-4" strokeWidth={2} />
        </Link>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-[var(--color-navy)] border-t border-white/5 py-10">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[var(--color-gold)]/10 border border-[var(--color-gold)]/20 flex items-center justify-center">
              <School className="w-3.5 h-3.5 text-[var(--color-gold)]" strokeWidth={1.5} />
            </div>
            <span className="text-sm font-bold text-white font-display">
              EduMag NG
            </span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-5">
            {[
              { label: 'Features', href: '#features' },
              { label: 'Pricing', href: '#pricing' },
              { label: 'Sign In', href: '/login' },
            ].map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                {l.label}
              </a>
            ))}
          </div>

          <p className="text-xs text-white/30">
            &copy; 2025 EduMag NG. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <>
      <Nav />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <PricingSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
