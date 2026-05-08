'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  User,
  GraduationCap,
  CalendarDays,
  MapPin,
  Droplets,
  FileDown,
  Loader2,
  BookOpen,
  ChevronRight,
} from 'lucide-react';
import { clsx } from 'clsx';

import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/shared/Badge';
import { studentsApi, resultsApi } from '@/lib/api';
import { formatDate, getInitials, getCurrentSession, formatTerm } from '@/lib/formatters';
import { useReportCardPDF } from '@/hooks/useReportCardPDF';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
        {label}
      </span>
      <span className="text-sm text-[var(--color-text-primary)]">
        {value ?? <span className="text-[var(--color-text-muted)]/50 italic">Not provided</span>}
      </span>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  children: React.ReactNode;
}) {
  return (
    <div className="card-shell">
      <div className="card-core p-5">
        <div className="flex items-center gap-2 mb-4">
          <Icon className="w-4 h-4 text-[var(--color-gold)]" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] font-display">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Results tab ─────────────────────────────────────────────────────────────

const TERMS = [
  { value: 'first',  label: 'First Term'  },
  { value: 'second', label: 'Second Term' },
  { value: 'third',  label: 'Third Term'  },
];

const inputCls = clsx(
  'text-sm rounded-lg px-3 py-2',
  'bg-[var(--color-surface)] border border-[var(--color-border)]',
  'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
  'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30',
  'transition-all duration-150',
);

function ResultsTab({ studentId }: { studentId: string }) {
  const [session, setSession] = useState('');
  const [term, setTerm]       = useState('first');

  const { generateSingle, isGeneratingId } = useReportCardPDF();
  const busy = isGeneratingId(studentId);

  useEffect(() => {
    setSession(getCurrentSession());
  }, []);

  const { data: resultData, isLoading, error } = useQuery({
    queryKey: ['results', 'student', studentId, session, term],
    queryFn: () =>
      resultsApi.studentResult(studentId, { academic_session: session, term }).then((r) => r.data),
    staleTime: 60_000,
    retry: 1,
    enabled: !!session,
  });

  const subjectCount = resultData?.subjects.length ?? 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Controls */}
      <div className="card-shell">
        <div className="card-core p-5">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-[0.08em]">
                Academic Session
              </label>
              <input
                type="text"
                value={session}
                onChange={(e) => setSession(e.target.value)}
                placeholder="e.g. 2024/2025"
                className={clsx(inputCls, 'w-36')}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-[0.08em]">
                Term
              </label>
              <select
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className={clsx(inputCls, 'cursor-pointer')}
              >
                {TERMS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => generateSingle(studentId, session, term)}
              disabled={busy || !subjectCount}
              title={!subjectCount ? 'No scores entered for this term yet' : 'Download report card as PDF'}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer',
                'bg-[var(--color-navy)] text-white',
                'hover:bg-[var(--color-navy-mid)] active:scale-[0.98]',
                'transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {busy
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <FileDown className="w-4 h-4" strokeWidth={1.5} />
              }
              {busy ? 'Generating PDF…' : 'Download Report Card'}
            </button>
          </div>
        </div>
      </div>

      {/* Results preview */}
      {isLoading ? (
        <div className="card-shell">
          <div className="card-core p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="skeleton h-4 flex-1 rounded" />
                <div className="skeleton h-4 w-12 rounded" />
                <div className="skeleton h-4 w-12 rounded" />
                <div className="skeleton h-4 w-16 rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : error || !resultData ? (
        <div className="card-shell">
          <div className="card-core p-8 text-center">
            <div className="w-10 h-10 rounded-full bg-[var(--color-navy)]/8 flex items-center justify-center mx-auto mb-3">
              <BookOpen className="w-5 h-5 text-[var(--color-navy)]" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">No results found</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              No scores have been entered for {formatTerm(term)}, {session}.
            </p>
          </div>
        </div>
      ) : (
        <div className="card-shell">
          <div className="card-core">
            {/* Summary strip */}
            <div className="flex flex-wrap items-center gap-6 px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Average Score</p>
                <p className="text-lg font-bold text-[var(--color-text-primary)] font-mono tabular-nums mt-0.5">
                  {resultData.average.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Total Score</p>
                <p className="text-lg font-bold text-[var(--color-text-primary)] font-mono tabular-nums mt-0.5">
                  {resultData.total_score}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Position</p>
                <p className="text-lg font-bold text-[var(--color-text-primary)] font-mono tabular-nums mt-0.5">
                  {resultData.position != null ? `#${resultData.position}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Subjects</p>
                <p className="text-lg font-bold text-[var(--color-text-primary)] font-mono tabular-nums mt-0.5">
                  {subjectCount}
                </p>
              </div>
            </div>

            {/* Subject rows */}
            {resultData.subjects.map((subj, idx) => (
              <div
                key={subj.subject}
                className={clsx(
                  'flex items-center gap-4 px-5 py-3',
                  idx < resultData.subjects.length - 1 && 'border-b border-[var(--color-border)]',
                  'hover:bg-[var(--color-surface)] transition-colors duration-150',
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">{subj.subject}</p>
                </div>
                <div className="flex items-center gap-5 text-xs font-mono tabular-nums text-[var(--color-text-muted)] flex-shrink-0">
                  <span title="Continuous Assessment">CA: {subj.ca_score ?? '—'}</span>
                  <span title="Examination">Exam: {subj.exam_score ?? '—'}</span>
                  <span className="font-bold text-[var(--color-text-primary)] text-sm" title="Total">
                    {subj.total_score ?? '—'}
                  </span>
                </div>
                <div className="w-16 flex-shrink-0 text-center">
                  <Badge
                    variant={
                      (subj.total_score ?? 0) >= 70 ? 'success'
                      : (subj.total_score ?? 0) >= 50 ? 'info'
                      : (subj.total_score ?? 0) >= 40 ? 'warning'
                      : 'danger'
                    }
                  >
                    {subj.grade ?? '—'}
                  </Badge>
                </div>
                {subj.is_approved && (
                  <div className="w-4 flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" title="Approved" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'results';

export default function AdminStudentDetailPage() {
  const { id }    = useParams<{ id: string }>();
  const router    = useRouter();
  const [tab, setTab] = useState<Tab>('profile');

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: () => studentsApi.get(id).then((r) => r.data),
    staleTime: 60_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="h-10 w-64 rounded-lg bg-[var(--color-border)] animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card-shell">
              <div className="card-core p-5 h-40 animate-pulse bg-[var(--color-border)]/30" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-[var(--color-text-muted)]">Student not found.</p>
        <button
          onClick={() => router.back()}
          className="text-sm text-[var(--color-navy)] underline cursor-pointer"
        >
          Go back
        </button>
      </div>
    );
  }

  const fullName = `${student.first_name}${student.middle_name ? ' ' + student.middle_name : ''} ${student.last_name}`;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={fullName}
        description={`Admission No. ${student.admission_number}`}
        breadcrumbs={[
          { label: 'Students', href: '/dashboard/admin/students' },
          { label: fullName },
        ]}
      />

      {/* Avatar card */}
      <div className="card-shell">
        <div className="card-core p-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[var(--color-gold)]/15 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-[var(--color-gold)]">{getInitials(fullName)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] font-display">{fullName}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className="text-sm font-mono text-[var(--color-text-muted)]">{student.admission_number}</span>
                <Badge variant={student.is_active ? 'success' : 'danger'} dot>
                  {student.is_active ? 'Active' : 'Inactive'}
                </Badge>
                <span className="text-xs text-[var(--color-text-muted)] capitalize">{student.gender}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-[var(--color-border)]">
        {(['profile', 'results'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'px-5 py-3 text-sm font-medium cursor-pointer capitalize',
              'border-b-2 -mb-px transition-colors duration-150',
              tab === t
                ? 'border-[var(--color-gold)] text-[var(--color-text-primary)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
            )}
          >
            {t === 'results' ? 'Academic Results' : 'Profile'}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === 'profile' && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Section title="Personal Information" icon={User}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <InfoRow label="First Name"    value={student.first_name} />
                <InfoRow label="Last Name"     value={student.last_name} />
                <InfoRow label="Middle Name"   value={student.middle_name} />
                <InfoRow label="Gender"        value={student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : null} />
                <InfoRow label="Date of Birth" value={student.date_of_birth ? formatDate(student.date_of_birth) : null} />
                <InfoRow label="Religion"      value={student.religion} />
                <InfoRow label="State of Origin" value={student.state_of_origin} />
              </div>
            </Section>

            <Section title="Academic Information" icon={GraduationCap}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <InfoRow label="Admission Number" value={student.admission_number} />
                <InfoRow label="Date Admitted"    value={student.admission_date ? formatDate(student.admission_date) : null} />
                <InfoRow label="Current Class"    value={(student as any).class_name ?? null} />
                <InfoRow label="Status"           value={student.is_active ? 'Active' : 'Inactive'} />
              </div>
            </Section>

            <Section title="Medical Information" icon={Droplets}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <InfoRow label="Blood Group" value={student.blood_group} />
                <InfoRow label="Genotype"    value={student.genotype} />
              </div>
            </Section>

            <Section title="Contact & Address" icon={MapPin}>
              <div className="grid grid-cols-1 gap-y-4">
                <InfoRow label="Home Address" value={student.address} />
              </div>
            </Section>
          </div>

          <div className="card-shell">
            <div className="card-core p-5">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="w-4 h-4 text-[var(--color-gold)]" strokeWidth={1.5} />
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] font-display">
                  Record Timeline
                </h3>
              </div>
              <div className="flex flex-wrap gap-6">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Created</span>
                  <p className="text-sm text-[var(--color-text-primary)] font-mono tabular-nums mt-0.5">
                    {formatDate(student.created_at)}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Last Updated</span>
                  <p className="text-sm text-[var(--color-text-primary)] font-mono tabular-nums mt-0.5">
                    {formatDate(student.updated_at)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results tab */}
      {tab === 'results' && <ResultsTab studentId={id} />}
    </div>
  );
}
