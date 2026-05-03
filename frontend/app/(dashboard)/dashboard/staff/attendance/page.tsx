'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  Check,
  X,
  Clock,
  AlertCircle,
  History,
  ClipboardCheck,
  PencilLine,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/shared/Badge';
import { studentsApi } from '@/lib/api';
import { getInitials } from '@/lib/formatters';
import type { StudentListItem } from '@/types/student';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
type ActiveTab = 'take' | 'history';

const STATUS_CONFIG: Record<
  AttendanceStatus,
  {
    label: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    color: string;
    bg: string;
    activeBg: string;
    badge: 'success' | 'danger' | 'warning' | 'info';
  }
> = {
  present: {
    label: 'Present',
    icon: Check,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-200',
    activeBg: 'bg-emerald-500 text-white border-emerald-500',
    badge: 'success',
  },
  absent: {
    label: 'Absent',
    icon: X,
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
    activeBg: 'bg-red-500 text-white border-red-500',
    badge: 'danger',
  },
  late: {
    label: 'Late',
    icon: Clock,
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200',
    activeBg: 'bg-amber-500 text-white border-amber-500',
    badge: 'warning',
  },
  excused: {
    label: 'Excused',
    icon: AlertCircle,
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
    activeBg: 'bg-blue-500 text-white border-blue-500',
    badge: 'info',
  },
};

const STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'excused'];

// Mock history records
const MOCK_HISTORY = [
  { date: '2026-04-25', present: 28, absent: 2, late: 1, excused: 0, total: 31 },
  { date: '2026-04-24', present: 30, absent: 1, late: 0, excused: 0, total: 31 },
  { date: '2026-04-23', present: 27, absent: 3, late: 1, excused: 0, total: 31 },
  { date: '2026-04-22', present: 29, absent: 1, late: 1, excused: 1, total: 32 },
  { date: '2026-04-17', present: 31, absent: 0, late: 1, excused: 0, total: 32 },
  { date: '2026-04-16', present: 28, absent: 4, late: 0, excused: 0, total: 32 },
  { date: '2026-04-15', present: 30, absent: 2, late: 0, excused: 0, total: 32 },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusButton({
  status,
  active,
  onClick,
}: {
  status: AttendanceStatus;
  active: boolean;
  onClick: () => void;
}) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border cursor-pointer',
        'transition-all duration-150',
        active ? cfg.activeBg : clsx(cfg.bg, cfg.color, 'hover:opacity-80'),
      )}
    >
      <Icon className="w-3 h-3" strokeWidth={2} />
      {cfg.label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Take Attendance tab
// ---------------------------------------------------------------------------

function TakeAttendanceTab() {
  const [today, setToday] = useState('');
  const [date, setDate] = useState('');
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const d = new Date().toISOString().split('T')[0];
    setToday(d);
    setDate(d);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['students', { per_page: 100, is_active: true }],
    queryFn: () => studentsApi.list({ per_page: 100, is_active: true }).then((r) => r.data),
    staleTime: 60_000,
    retry: 1,
  });

  const students = (data?.items ?? []) as StudentListItem[];

  const mark = (id: string, status: AttendanceStatus) =>
    setAttendance((prev) => ({ ...prev, [id]: status }));

  const markAll = (status: AttendanceStatus) => {
    const all: Record<string, AttendanceStatus> = {};
    students.forEach((s) => { all[s.id] = status; });
    setAttendance(all);
  };

  const handleSubmit = () => {
    const unmarked = students.filter((s) => !attendance[s.id]);
    if (unmarked.length > 0) {
      toast.error(`${unmarked.length} student(s) not marked`);
      return;
    }
    toast.success('Attendance saved successfully');
    setSubmitted(true);
  };

  const presentCount = Object.values(attendance).filter((s) => s === 'present').length;
  const absentCount = Object.values(attendance).filter((s) => s === 'absent').length;
  const markedCount = Object.values(attendance).length;

  if (submitted) {
    return (
      <div className="card-shell">
        <div className="card-core p-12 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-100 ring-1 ring-emerald-200 flex items-center justify-center">
            <Check className="w-7 h-7 text-emerald-600" strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              Attendance Saved
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {presentCount} present · {absentCount} absent · {students.length} total for{' '}
              <span className="font-medium">{date}</span>
            </p>
          </div>
          <button
            onClick={() => setSubmitted(false)}
            className={clsx(
              'flex items-center gap-1.5 text-sm font-medium cursor-pointer',
              'text-[var(--color-navy)] hover:underline',
            )}
          >
            <PencilLine className="w-3.5 h-3.5" strokeWidth={1.5} />
            Edit attendance
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="card-shell">
        <div className="card-core p-4">
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

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[var(--color-text-muted)]">Mark all:</span>
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => markAll(s)}
                  className={clsx(
                    'px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer border',
                    'transition-all duration-150',
                    STATUS_CONFIG[s].bg,
                    STATUS_CONFIG[s].color,
                    'hover:opacity-80',
                  )}
                >
                  All {STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 ml-auto text-xs text-[var(--color-text-muted)]">
              <span>Marked: {markedCount}/{students.length}</span>
              <span className="text-emerald-600 font-medium">Present: {presentCount}</span>
              <span className="text-red-600 font-medium">Absent: {absentCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Student list */}
      <div className="card-shell">
        <div className="card-core">
          {isLoading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="skeleton w-8 h-8 rounded-full" />
                    <div className="skeleton h-4 w-32 rounded" />
                  </div>
                  <div className="flex gap-1.5">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <div key={j} className="skeleton h-7 w-16 rounded-md" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">No active students found.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {students.map((student) => {
                const fullName = `${student.first_name} ${student.last_name}`;
                const current = attendance[student.id];
                return (
                  <div
                    key={student.id}
                    className={clsx(
                      'flex items-center justify-between px-5 py-3',
                      'transition-colors duration-150',
                      current === 'present' && 'bg-emerald-50/40',
                      current === 'absent' && 'bg-red-50/40',
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[var(--color-gold)]/15 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-[var(--color-gold)]">
                          {getInitials(fullName)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                          {fullName}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-muted)] font-mono">
                          {student.admission_number}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {STATUSES.map((s) => (
                        <StatusButton
                          key={s}
                          status={s}
                          active={current === s}
                          onClick={() => mark(student.id, s)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {students.length > 0 && !isLoading && (
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            className={clsx(
              'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer',
              'bg-[var(--color-navy)] text-white',
              'hover:bg-[var(--color-navy-mid)] active:scale-[0.98]',
              'transition-all duration-200',
            )}
          >
            <Check className="w-4 h-4" strokeWidth={2} />
            Save Attendance
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// History tab
// ---------------------------------------------------------------------------

function HistoryTab() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filtered = MOCK_HISTORY.filter((r) => {
    if (startDate && r.date < startDate) return false;
    if (endDate && r.date > endDate) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Date range filter */}
      <div className="card-shell">
        <div className="card-core p-4">
          <div className="flex flex-wrap items-center gap-3">
            <CalendarDays className="w-4 h-4 text-[var(--color-text-muted)]" strokeWidth={1.5} />
            <span className="text-xs font-medium text-[var(--color-text-muted)]">Filter:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="From"
              className={clsx(
                'text-sm rounded-lg px-3 py-1.5',
                'bg-[var(--color-surface)] border border-[var(--color-border)]',
                'text-[var(--color-text-primary)]',
                'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30',
              )}
            />
            <span className="text-xs text-[var(--color-text-muted)]">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={clsx(
                'text-sm rounded-lg px-3 py-1.5',
                'bg-[var(--color-surface)] border border-[var(--color-border)]',
                'text-[var(--color-text-primary)]',
                'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30',
              )}
            />
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* History table */}
      <div className="card-shell">
        <div className="card-core">
          {/* Header */}
          <div className="grid grid-cols-[1fr_80px_80px_80px_80px_80px] gap-2 px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-navy)]">
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wide">Date</span>
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wide text-center">Present</span>
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wide text-center">Absent</span>
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wide text-center">Late</span>
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wide text-center">Excused</span>
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wide text-center">Rate</span>
          </div>

          {filtered.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">No attendance records found.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {filtered.map((record, i) => {
                const pct = Math.round((record.present / record.total) * 100);
                return (
                  <div
                    key={record.date}
                    className={clsx(
                      'grid grid-cols-[1fr_80px_80px_80px_80px_80px] gap-2 px-5 py-3 items-center',
                      'transition-colors duration-150 hover:bg-[var(--color-surface)]',
                      i % 2 === 0 ? 'bg-[var(--color-cream)]' : 'bg-white',
                    )}
                  >
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {new Date(record.date + 'T00:00:00').toLocaleDateString('en-NG', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="text-sm font-medium text-emerald-600 text-center tabular-nums">{record.present}</span>
                    <span className="text-sm font-medium text-red-600 text-center tabular-nums">{record.absent}</span>
                    <span className="text-sm font-medium text-amber-600 text-center tabular-nums">{record.late}</span>
                    <span className="text-sm font-medium text-blue-600 text-center tabular-nums">{record.excused}</span>
                    <div className="flex justify-center">
                      <Badge
                        variant={pct >= 90 ? 'success' : pct >= 75 ? 'warning' : 'danger'}
                      >
                        {pct}%
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AttendancePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('take');

  const tabs: { key: ActiveTab; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }[] = [
    { key: 'take', label: 'Take Attendance', icon: ClipboardCheck },
    { key: 'history', label: 'History', icon: History },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Attendance"
        description="Record and review daily class attendance"
      />

      {/* Tab switcher */}
      <div className="flex items-center gap-1 bg-[var(--color-surface)] rounded-xl p-1 w-fit border border-[var(--color-border)]">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer',
              'transition-all duration-200',
              activeTab === key
                ? 'bg-[var(--color-navy)] text-white shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
            )}
          >
            <Icon className="w-4 h-4" strokeWidth={1.5} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'take' ? <TakeAttendanceTab /> : <HistoryTab />}
    </div>
  );
}
