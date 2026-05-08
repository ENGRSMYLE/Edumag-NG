'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  CalendarCheck,
  BookOpen,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  GraduationCap,
} from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';

import { SkeletonCard } from '@/components/shared/LoadingSkeleton';
import { Badge } from '@/components/shared/Badge';
import { useAuth } from '@/hooks/useAuth';
import { studentsApi, attendanceApi, assignmentsApi } from '@/lib/api';
import { getInitials } from '@/lib/formatters';
import type { StudentListItem } from '@/types/student';

// ---------------------------------------------------------------------------
// Quick action card
// ---------------------------------------------------------------------------

interface QuickStatProps {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  sub?: string;
  variant: 'green' | 'amber' | 'blue' | 'violet';
  href?: string;
  actionLabel?: string;
}

const variantStyles: Record<QuickStatProps['variant'], { icon: string; bg: string; ring: string }> = {
  green:  { icon: 'text-emerald-600', bg: 'bg-emerald-50',  ring: 'ring-emerald-100' },
  amber:  { icon: 'text-amber-600',   bg: 'bg-amber-50',    ring: 'ring-amber-100'   },
  blue:   { icon: 'text-blue-600',    bg: 'bg-blue-50',     ring: 'ring-blue-100'    },
  violet: { icon: 'text-violet-600',  bg: 'bg-violet-50',   ring: 'ring-violet-100'  },
};

function QuickStat({ icon: Icon, label, value, sub, variant, href, actionLabel }: QuickStatProps) {
  const s = variantStyles[variant];
  const inner = (
    <div className="card-core p-5 flex items-start gap-4">
      <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ring-1', s.bg, s.ring)}>
        <Icon className={clsx('w-5 h-5', s.icon)} strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-[0.08em]">{label}</p>
        <p className="text-lg font-bold text-[var(--color-text-primary)] mt-0.5 leading-tight">{value}</p>
        {sub && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{sub}</p>}
      </div>
      {href && actionLabel && (
        <div className="flex items-center gap-1 text-xs font-medium text-[var(--color-navy)] flex-shrink-0 mt-1">
          {actionLabel}
          <ArrowRight className="w-3 h-3" strokeWidth={2} />
        </div>
      )}
    </div>
  );

  return href ? (
    <Link href={href} className="card-shell group hover:shadow-md transition-all duration-200 cursor-pointer">
      {inner}
    </Link>
  ) : (
    <div className="card-shell">{inner}</div>
  );
}

// ---------------------------------------------------------------------------
// Student row preview
// ---------------------------------------------------------------------------

function StudentPreviewRow({ student, index }: { student: StudentListItem; index: number }) {
  const fullName = student.full_name || `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim() || 'Unknown';
  const attendancePct = Math.floor(70 + Math.random() * 30); // mock until backend ready
  return (
    <div
      className={clsx(
        'flex items-center justify-between px-5 py-3',
        'transition-colors duration-150 hover:bg-[var(--color-surface)]',
        index < 4 && 'border-b border-[var(--color-border)]',
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-[var(--color-gold)]/15 flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-bold text-[var(--color-gold)]">{getInitials(fullName)}</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{fullName}</p>
          <p className="text-[11px] text-[var(--color-text-muted)] font-mono">{student.admission_number}</p>
        </div>
      </div>
      <Badge variant={attendancePct >= 80 ? 'success' : attendancePct >= 60 ? 'warning' : 'danger'}>
        {attendancePct}%
      </Badge>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function StaffDashboardPage() {
  const { user, classId } = useAuth();
  const [greeting, setGreeting] = useState('Good morning');
  const [today, setToday] = useState('');

  useEffect(() => {
    const h = new Date().getHours();
    if (h >= 17) setGreeting('Good evening');
    else if (h >= 12) setGreeting('Good afternoon');
    const d = new Date().toISOString().split('T')[0];
    setToday(d);
  }, []);

  const { data: studentsData, isLoading } = useQuery({
    queryKey: ['my-class-students', { per_page: 5 }],
    queryFn: () => studentsApi.myClass({ per_page: 5, is_active: true }).then((r) => r.data),
    staleTime: 60_000,
    retry: 1,
    enabled: !!classId,
  });

  const { data: attendanceCheck } = useQuery({
    queryKey: ['attendance', 'check', classId, today],
    queryFn: () => attendanceApi.check(classId!, { date: today }).then((r) => r.data),
    staleTime: 60_000,
    retry: 1,
    enabled: !!classId && !!today,
  });

  const { data: assignmentsData } = useQuery({
    queryKey: ['assignments', { per_page: 50 }],
    queryFn: () => assignmentsApi.list({ per_page: 50 }).then((r) => r.data),
    staleTime: 60_000,
    retry: 1,
    enabled: !!classId,
  });

  const students = (studentsData?.items ?? []) as StudentListItem[];
  const totalStudents = studentsData?.total ?? 0;

  const attendanceTaken = attendanceCheck?.is_marked ?? false;
  const pendingGrading: number = (assignmentsData?.items ?? []).filter(
    (a) => a.submission_count > a.graded_count
  ).length;
  const pendingScores: number = 0; // shown as 0 until scores endpoint exposes pending count

  return (
    <div className="flex flex-col gap-6">
      {/* Greeting */}
      <div>
        <h1
          className="text-2xl font-bold text-[var(--color-text-primary)] font-display tracking-tight"
          suppressHydrationWarning
        >
          {greeting}, {user?.name?.split(' ')[0] ?? 'Teacher'}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Here's what needs your attention today.
        </p>
      </div>

      {/* My Class card */}
      <div className="card-shell">
        <div className="card-core p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--color-navy)]/8 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-6 h-6 text-[var(--color-navy)]" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-[0.08em]">
                My Class
              </p>
              <p className="text-base font-bold text-[var(--color-text-primary)] mt-0.5">
                {classId ? 'Class assigned' : 'No class assigned'}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {classId
                  ? `${totalStudents} enrolled students`
                  : 'Contact admin to be assigned a class'}
              </p>
            </div>
            <Link
              href="/dashboard/staff/my-class"
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 cursor-pointer',
                'text-[var(--color-navy)] bg-[var(--color-navy)]/8 hover:bg-[var(--color-navy)]/14',
                'transition-colors duration-150',
              )}
            >
              View Class
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
            </Link>
          </div>
        </div>
      </div>

      {/* Quick-action stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <QuickStat
          icon={attendanceTaken ? CheckCircle2 : AlertTriangle}
          label="Today's Attendance"
          value={attendanceTaken ? 'Taken' : 'Not Taken'}
          sub={attendanceTaken ? 'All students marked' : `Date: ${today}`}
          variant={attendanceTaken ? 'green' : 'amber'}
          href={attendanceTaken ? undefined : '/dashboard/staff/attendance'}
          actionLabel={attendanceTaken ? undefined : 'Take Now'}
        />
        <QuickStat
          icon={BookOpen}
          label="Pending Scores"
          value={`${pendingScores} subject${pendingScores !== 1 ? 's' : ''}`}
          sub="Incomplete score entry"
          variant="blue"
          href="/dashboard/staff/scores"
          actionLabel="Enter Scores"
        />
        <QuickStat
          icon={ClipboardList}
          label="Pending Grading"
          value={`${pendingGrading} assignment${pendingGrading !== 1 ? 's' : ''}`}
          sub="Awaiting grading"
          variant="violet"
          href="/dashboard/staff/assignments"
          actionLabel="Grade Now"
        />
      </div>

      {/* Student preview */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-[0.08em]">
            My Students
          </h2>
          <Link
            href="/dashboard/staff/my-class"
            className="text-xs font-medium text-[var(--color-navy)] hover:underline flex items-center gap-1"
          >
            View all {totalStudents > 0 && `(${totalStudents})`}
            <ArrowRight className="w-3 h-3" strokeWidth={2} />
          </Link>
        </div>

        <div className="card-shell">
          <div className="card-core">
            {isLoading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="skeleton w-8 h-8 rounded-full" />
                      <div className="skeleton h-4 w-36 rounded" />
                    </div>
                    <div className="skeleton h-5 w-12 rounded-full" />
                  </div>
                ))}
              </div>
            ) : students.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-10 h-10 rounded-full bg-[var(--color-navy)]/8 flex items-center justify-center mx-auto mb-3">
                  <Users className="w-5 h-5 text-[var(--color-navy)]" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">No students yet</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Students will appear here once assigned to your class.
                </p>
              </div>
            ) : (
              students.map((s, i) => <StudentPreviewRow key={s.id} student={s} index={i} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
