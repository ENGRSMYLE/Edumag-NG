'use client';

import { useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Save, Lock, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

import { PageHeader } from '@/components/shared/PageHeader';
import { studentsApi } from '@/lib/api';
import { getInitials } from '@/lib/formatters';
import type { StudentListItem } from '@/types/student';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUBJECTS = [
  { name: 'Mathematics',              isApproved: false },
  { name: 'English Language',         isApproved: false },
  { name: 'Basic Science',            isApproved: true  },
  { name: 'Social Studies',           isApproved: false },
  { name: 'Civic Education',          isApproved: false },
  { name: 'Christian Religious Stud.', isApproved: false },
  { name: 'Computer Studies',         isApproved: true  },
  { name: 'Agricultural Science',     isApproved: false },
  { name: 'Physical Education',       isApproved: false },
];

interface StudentScore {
  ca: string;
  exam: string;
  comment: string;
}

// ---------------------------------------------------------------------------
// Grade helpers
// ---------------------------------------------------------------------------

function getTotal(scores: StudentScore): string {
  if (!scores.ca && !scores.exam) return '—';
  const ca   = parseFloat(scores.ca)   || 0;
  const exam = parseFloat(scores.exam) || 0;
  return (ca + exam).toFixed(1);
}

function getGrade(total: string): string {
  if (total === '—') return '—';
  const t = parseFloat(total);
  if (t >= 70) return 'A';
  if (t >= 60) return 'B';
  if (t >= 50) return 'C';
  if (t >= 45) return 'D';
  if (t >= 40) return 'E';
  return 'F';
}

function gradeColor(grade: string): string {
  if (grade === 'A') return 'text-emerald-600';
  if (grade === 'B') return 'text-blue-600';
  if (grade === 'C') return 'text-amber-600';
  if (grade === 'D' || grade === 'E') return 'text-orange-600';
  if (grade === 'F') return 'text-red-600';
  return 'text-[var(--color-text-muted)]';
}

// ---------------------------------------------------------------------------
// Subject tab bar
// ---------------------------------------------------------------------------

function SubjectTabs({
  subjects,
  active,
  onChange,
}: {
  subjects: typeof SUBJECTS;
  active: string;
  onChange: (name: string) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {subjects.map(({ name, isApproved }) => (
        <button
          key={name}
          type="button"
          onClick={() => onChange(name)}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer',
            'transition-all duration-150',
            active === name
              ? 'bg-[var(--color-navy)] text-white shadow-sm'
              : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-navy)]/30 hover:text-[var(--color-text-primary)]',
          )}
        >
          {isApproved && (
            <Lock className="w-2.5 h-2.5 text-amber-400" strokeWidth={2} />
          )}
          {name}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scores table
// ---------------------------------------------------------------------------

function ScoresTable({
  students,
  isLoading,
  isApproved,
  scores,
  onScoreChange,
}: {
  students: StudentListItem[];
  isLoading: boolean;
  isApproved: boolean;
  scores: Record<string, StudentScore>;
  onScoreChange: (id: string, field: keyof StudentScore, value: string) => void;
}) {
  const inputCls = (disabled: boolean) =>
    clsx(
      'w-16 text-sm text-center rounded-lg px-2 py-1.5 tabular-nums',
      'border transition-all duration-150',
      disabled
        ? 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed'
        : [
            'bg-[var(--color-surface)] border-[var(--color-border)]',
            'text-[var(--color-text-primary)]',
            'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)]',
          ],
    );

  const commentCls = (disabled: boolean) =>
    clsx(
      'w-full text-xs rounded-lg px-2 py-1.5',
      'border transition-all duration-150',
      disabled
        ? 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed'
        : [
            'bg-[var(--color-surface)] border-[var(--color-border)]',
            'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
            'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30',
          ],
    );

  if (isLoading) {
    return (
      <div className="p-5 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="grid grid-cols-[1fr_80px_80px_60px_52px_1fr] gap-3 items-center">
            <div className="skeleton h-8 rounded" />
            <div className="skeleton h-8 rounded" />
            <div className="skeleton h-8 rounded" />
            <div className="skeleton h-6 w-10 rounded mx-auto" />
            <div className="skeleton h-6 w-8 rounded mx-auto" />
            <div className="skeleton h-8 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="p-10 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">No students found.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-[var(--color-border)]">
      {students.map((student, idx) => {
        const fullName = `${student.first_name} ${student.last_name}`;
        const s = scores[student.id] ?? { ca: '', exam: '', comment: '' };
        const total = getTotal(s);
        const grade = getGrade(total);
        const enteredCount = (s.ca ? 1 : 0) + (s.exam ? 1 : 0);

        return (
          <div
            key={student.id}
            className={clsx(
              'grid grid-cols-[1fr_80px_80px_60px_52px_180px] gap-3 px-5 py-2.5 items-center',
              idx % 2 === 0 ? 'bg-[var(--color-cream)]' : 'bg-white',
              'transition-colors duration-100',
            )}
          >
            {/* Student */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-[var(--color-gold)]/15 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-[var(--color-gold)]">
                  {getInitials(fullName)}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{fullName}</p>
                {isApproved && enteredCount === 0 && (
                  <p className="text-[10px] text-amber-600">No scores entered</p>
                )}
              </div>
            </div>

            {/* CA */}
            <input
              type="text"
              inputMode="numeric"
              className={inputCls(isApproved)}
              disabled={isApproved}
              value={s.ca}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d.]/g, '');
                if (parseFloat(v) > 40) return;
                onScoreChange(student.id, 'ca', v);
              }}
              placeholder="0"
              maxLength={4}
              aria-label={`CA score for ${fullName}`}
            />

            {/* Exam */}
            <input
              type="text"
              inputMode="numeric"
              className={inputCls(isApproved)}
              disabled={isApproved}
              value={s.exam}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d.]/g, '');
                if (parseFloat(v) > 60) return;
                onScoreChange(student.id, 'exam', v);
              }}
              placeholder="0"
              maxLength={4}
              aria-label={`Exam score for ${fullName}`}
            />

            {/* Total */}
            <p
              className={clsx(
                'text-sm font-semibold text-center tabular-nums',
                total !== '—'
                  ? 'text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-muted)]',
              )}
            >
              {total}
            </p>

            {/* Grade */}
            <p className={clsx('text-sm font-bold text-center', gradeColor(grade))}>{grade}</p>

            {/* Comment */}
            <input
              type="text"
              className={commentCls(isApproved)}
              disabled={isApproved}
              value={s.comment}
              onChange={(e) => onScoreChange(student.id, 'comment', e.target.value)}
              placeholder="Comment…"
              maxLength={100}
              aria-label={`Comment for ${fullName}`}
            />
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ScoresPage() {
  const [selectedSubject, setSelectedSubject] = useState(SUBJECTS[0].name);
  const [scores, setScores] = useState<Record<string, Record<string, StudentScore>>>({});
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const currentSubjectMeta = SUBJECTS.find((s) => s.name === selectedSubject)!;
  const isApproved = currentSubjectMeta?.isApproved ?? false;

  const { data, isLoading } = useQuery({
    queryKey: ['students', { per_page: 100, is_active: true }],
    queryFn: () => studentsApi.list({ per_page: 100, is_active: true }).then((r) => r.data),
    staleTime: 60_000,
    retry: 1,
  });

  const students = (data?.items ?? []) as StudentListItem[];
  const subjectScores = scores[selectedSubject] ?? {};

  const enteredCount = students.filter((s) => {
    const sc = subjectScores[s.id];
    return sc && (sc.ca || sc.exam);
  }).length;

  const onScoreChange = useCallback(
    (studentId: string, field: keyof StudentScore, value: string) => {
      setScores((prev) => ({
        ...prev,
        [selectedSubject]: {
          ...(prev[selectedSubject] ?? {}),
          [studentId]: {
            ...(prev[selectedSubject]?.[studentId] ?? { ca: '', exam: '', comment: '' }),
            [field]: value,
          },
        },
      }));
    },
    [selectedSubject],
  );

  const handleSave = () => {
    const entered = students.filter((s) => {
      const sc = subjectScores[s.id];
      return sc && (sc.ca || sc.exam);
    });
    toast.success(`${selectedSubject}: ${entered.length}/${students.length} scores saved`);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Enter Scores"
        description="Record CA and exam scores by subject"
      />

      {/* Subject tabs */}
      <div className="card-shell">
        <div className="card-core p-4 flex flex-col gap-3">
          <SubjectTabs
            subjects={SUBJECTS}
            active={selectedSubject}
            onChange={setSelectedSubject}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-[var(--color-text-muted)]" strokeWidth={1.5} />
              <span className="text-xs text-[var(--color-text-muted)]">
                CA max: <strong>40</strong> · Exam max: <strong>60</strong> · Total: <strong>100</strong>
              </span>
              {isApproved && (
                <span className="flex items-center gap-1 text-xs text-amber-600 font-medium ml-2">
                  <Lock className="w-3 h-3" strokeWidth={2} />
                  Results approved — locked for editing
                </span>
              )}
            </div>
            {!isLoading && students.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-muted)]">
                  {enteredCount} / {students.length} students scored
                </span>
                {enteredCount === students.length ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} />
                    All scores entered
                  </span>
                ) : (
                  <div className="w-24 h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--color-gold)] transition-all duration-300"
                      style={{ width: `${students.length ? (enteredCount / students.length) * 100 : 0}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scores table */}
      <div className="card-shell">
        <div className="card-core">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_80px_80px_60px_52px_180px] gap-3 px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-navy)]">
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wide">Student</span>
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wide text-center">CA (40)</span>
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wide text-center">Exam (60)</span>
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wide text-center">Total</span>
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wide text-center">Grade</span>
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wide">Comment</span>
          </div>

          <ScoresTable
            students={students}
            isLoading={isLoading}
            isApproved={isApproved}
            scores={subjectScores}
            onScoreChange={onScoreChange}
          />
        </div>
      </div>

      {students.length > 0 && !isLoading && !isApproved && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className={clsx(
              'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer',
              'bg-[var(--color-navy)] text-white',
              'hover:bg-[var(--color-navy-mid)] active:scale-[0.98]',
              'transition-all duration-200',
            )}
          >
            <Save className="w-4 h-4" strokeWidth={1.5} />
            Save {selectedSubject}
          </button>
        </div>
      )}
    </div>
  );
}
