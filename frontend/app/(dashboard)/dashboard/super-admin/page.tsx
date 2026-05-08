'use client';

import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  UserCheck,
  TrendingUp,
  CalendarCheck,
  UserPlus,
  Wallet,
  BookOpen,
  Megaphone,
} from 'lucide-react';
import { clsx } from 'clsx';

import { StatCard } from '@/components/shared/StatCard';
import { SkeletonCard } from '@/components/shared/LoadingSkeleton';
import { dashboardApi } from '@/lib/api';
import { formatNaira, formatRelativeTime } from '@/lib/formatters';
import type { ActivityType, RecentActivity } from '@/types/dashboard';

const EnrollmentChart = dynamic(
  () => import('./_components/EnrollmentChart'),
  { ssr: false, loading: () => <div className="skeleton h-[200px] rounded-lg" /> },
);
const RevenueChart = dynamic(
  () => import('./_components/RevenueChart'),
  { ssr: false, loading: () => <div className="skeleton h-[200px] rounded-lg" /> },
);

// ── Activity feed helpers ────────────────────────────────────────────────────

interface ActivityMeta {
  icon: React.ElementType;
  bg: string;
  color: string;
}

const ACTIVITY_META: Record<ActivityType, ActivityMeta> = {
  student_added:       { icon: UserPlus,  bg: 'bg-emerald-50',          color: 'text-emerald-600' },
  payment_received:    { icon: Wallet,    bg: 'bg-[var(--color-gold)]/10', color: 'text-[var(--color-gold)]' },
  staff_invited:       { icon: UserCheck, bg: 'bg-blue-50',              color: 'text-blue-600' },
  class_created:       { icon: BookOpen,  bg: 'bg-violet-50',            color: 'text-violet-600' },
  announcement_posted: { icon: Megaphone, bg: 'bg-orange-50',            color: 'text-orange-500' },
};

function ActivityRow({ item }: { item: RecentActivity }) {
  const meta = ACTIVITY_META[item.type] ?? ACTIVITY_META.student_added;
  const Icon = meta.icon;
  return (
    <div className="flex items-center gap-3.5 px-5 py-3.5">
      <div
        className={clsx(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
          meta.bg,
        )}
      >
        <Icon className={clsx('w-[15px] h-[15px]', meta.color)} strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--color-text-primary)] truncate">{item.description}</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{item.actor_name}</p>
      </div>
      <time className="text-xs text-[var(--color-text-muted)] flex-shrink-0 tabular-nums">
        {formatRelativeTime(item.timestamp)}
      </time>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SuperAdminOverviewPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => dashboardApi.overview().then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
  });

  const stats = data?.stats;
  const enrollmentData = data?.enrollment_data ?? [];
  const revenueData = data?.revenue_data ?? [];
  const activities = data?.recent_activity ?? [];

  return (
    <div className="flex flex-col gap-5">
      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-mono">
          Dashboard error: {(error as any)?.response?.status ?? 'network'} —{' '}
          {JSON.stringify((error as any)?.response?.data ?? (error as any)?.message ?? String(error))}
        </div>
      )}

      {/* ── Stat cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              title="Total Students"
              value={stats?.total_students ?? 0}
              icon={Users}
              change={stats?.students_change_pct}
              changeLabel="vs last term"
              variant="default"
              delay={0}
            />
            <StatCard
              title="Total Staff"
              value={stats?.total_staff ?? 0}
              icon={UserCheck}
              change={stats?.staff_change_pct}
              changeLabel="vs last month"
              variant="gold"
              delay={1}
            />
            <StatCard
              title="Monthly Revenue"
              value={formatNaira(stats?.monthly_revenue_kobo ?? 0)}
              icon={TrendingUp}
              change={stats?.revenue_change_pct}
              changeLabel="vs last month"
              variant="success"
              delay={2}
            />
            <StatCard
              title="Today's Attendance"
              value={`${stats?.attendance_today_percent ?? 0}%`}
              icon={CalendarCheck}
              change={stats?.attendance_change_pct}
              changeLabel="vs yesterday"
              variant="info"
              delay={3}
            />
          </>
        )}
      </div>

      {/* ── Charts row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Enrollment — 60% */}
        <div className="lg:col-span-3 card-shell">
          <div className="card-core p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] font-display">
                Student Enrollment
              </h3>
              <span className="text-[11px] text-[var(--color-text-muted)]">This session</span>
            </div>
            <EnrollmentChart data={enrollmentData} />
          </div>
        </div>

        {/* Revenue — 40% */}
        <div className="lg:col-span-2 card-shell">
          <div className="card-core p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] font-display">
                Revenue This Term
              </h3>
              <span className="text-[11px] text-[var(--color-text-muted)]">Monthly</span>
            </div>
            <RevenueChart data={revenueData} />
          </div>
        </div>
      </div>

      {/* ── Activity feed ──────────────────────────────────────────────── */}
      <div className="card-shell">
        <div className="card-core">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] font-display">
              Recent Activity
            </h3>
            <span className="text-[11px] text-[var(--color-text-muted)]">Last 10 actions</span>
          </div>

          <div className="divide-y divide-[var(--color-border)]">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3.5 px-5 py-3.5">
                  <div className="skeleton w-8 h-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-3.5 rounded w-3/4" />
                    <div className="skeleton h-3 rounded w-1/4" />
                  </div>
                  <div className="skeleton h-3 rounded w-16" />
                </div>
              ))
            ) : activities.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-[var(--color-text-muted)]">No recent activity</p>
              </div>
            ) : (
              activities
                .slice(0, 10)
                .map((item) => <ActivityRow key={item.id} item={item} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
