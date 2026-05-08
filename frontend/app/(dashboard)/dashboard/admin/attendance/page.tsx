'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Users, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { clsx } from 'clsx';

import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { SkeletonCard } from '@/components/shared/LoadingSkeleton';
import { attendanceApi, classesApi } from '@/lib/api';
import type { AttendanceReportItem } from '@/types/attendance';

function AttendancePctBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-500',
            pct >= 90 ? 'bg-emerald-500' : pct >= 75 ? 'bg-amber-500' : 'bg-red-500',
          )}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span
        className={clsx(
          'text-xs font-mono font-semibold tabular-nums w-10 text-right',
          pct >= 90 ? 'text-emerald-600' : pct >= 75 ? 'text-amber-600' : 'text-red-600',
        )}
      >
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

export default function AdminAttendancePage() {
  const [today, setToday] = useState('');
  const [date, setDate] = useState('');
  const [classFilter, setClassFilter] = useState('');

  useEffect(() => {
    const d = new Date().toISOString().split('T')[0];
    setToday(d);
    setDate(d);
  }, []);

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classesApi.list().then((r) => r.data.items),
    staleTime: 120_000,
  });

  const { data: report, isLoading } = useQuery({
    queryKey: ['attendance', 'school', { date, class_id: classFilter || undefined }],
    queryFn: () => attendanceApi.school({ date, class_id: classFilter || undefined }).then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
    enabled: !!date,
  });

  const rows = report?.by_class ?? [];

  const totalStudents = rows.reduce((s, r) => s + r.total_students, 0);
  const totalPresent = rows.reduce((s, r) => s + r.present, 0);
  const totalAbsent = rows.reduce((s, r) => s + r.absent, 0);
  const totalLate = rows.reduce((s, r) => s + r.late, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Attendance Report"
        description="School-wide daily attendance overview"
      />

      {/* Filters */}
      <div className="card-shell">
        <div className="card-core px-5 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[var(--color-text-muted)]" strokeWidth={1.5} />
              <input
                type="date"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value)}
                className={clsx(
                  'text-sm rounded-lg px-3 py-1.5',
                  'bg-[var(--color-surface)] border border-[var(--color-border)]',
                  'text-[var(--color-text-primary)]',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30',
                  'transition-all duration-150',
                )}
              />
            </div>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className={clsx(
                'text-sm rounded-lg px-3 py-1.5 cursor-pointer',
                'bg-[var(--color-surface)] border border-[var(--color-border)]',
                'text-[var(--color-text-primary)]',
                'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30',
                'transition-all duration-150',
              )}
            >
              <option value="">All Classes</option>
              {(classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard title="Total Students" value={totalStudents} icon={Users} variant="default" delay={0} />
            <StatCard title="Present" value={totalPresent} icon={CheckCircle2} variant="success" delay={1} />
            <StatCard title="Absent" value={totalAbsent} icon={XCircle} variant="danger" delay={2} />
            <StatCard title="Late" value={totalLate} icon={Clock} variant="gold" delay={3} />
          </>
        )}
      </div>

      {/* Per-class table */}
      <div className="card-shell">
        <div className="card-core">
          <div className="px-5 py-4 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] font-display">
              Breakdown by Class
            </h3>
          </div>

          {isLoading ? (
            <div className="divide-y divide-[var(--color-border)]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="skeleton h-4 w-24 rounded" />
                  <div className="skeleton h-4 w-12 rounded" />
                  <div className="skeleton h-4 w-12 rounded" />
                  <div className="skeleton h-4 w-12 rounded" />
                  <div className="skeleton h-3 w-32 rounded-full flex-1" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">
                No attendance data for {date || 'this date'}.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Class</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Total</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-emerald-600 uppercase tracking-wide">Present</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-red-500 uppercase tracking-wide">Absent</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-amber-500 uppercase tracking-wide hidden sm:table-cell">Late</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide min-w-[120px] sm:min-w-[180px]">Attendance %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {rows.map((row) => (
                    <tr key={row.class_id} className="hover:bg-[var(--color-surface)] transition-colors duration-100">
                      <td className="px-5 py-3.5 text-sm font-medium text-[var(--color-text-primary)]">
                        {row.class_name}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-mono text-right text-[var(--color-text-secondary)] tabular-nums">
                        {row.total_students}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-mono text-right text-emerald-600 tabular-nums">
                        {row.present}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-mono text-right text-red-500 tabular-nums">
                        {row.absent}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-mono text-right text-amber-500 tabular-nums hidden sm:table-cell">
                        {row.late}
                      </td>
                      <td className="px-5 py-3.5 min-w-[180px]">
                        <AttendancePctBar pct={row.attendance_rate} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
