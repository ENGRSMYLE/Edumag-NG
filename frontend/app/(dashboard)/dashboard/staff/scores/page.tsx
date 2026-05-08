'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Save, Lock, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

import { PageHeader } from '@/components/shared/PageHeader';
import { studentsApi, resultsApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { getInitials, getCurrentSession } from '@/lib/formatters';
import type { StudentListItem } from '@/types/student';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUBJECTS = [
  'Mathematics',
  'English Language',
  'Basic Science',
  'Social Studies',
  'Civic Education',
  'Christian Religious Studies',
  'Computer Studies',
  'Agricultural Science',
  'Physical Education',
];

const TERMS = [
  { value: 'first', label: 'First Term' },
  { value: 'second', label: 'Second Term' },
  { value: 'third', label: 'Third Term' },
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
  approvedSet,
  onChange,
}: {
  subjects: string[];
  active: string;
  approvedSet: Set<string>;
  onChange: (name: string) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {subjects.map((name) => (
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
          {approvedSet.has(name) && (
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
        const fullName = student.full_name || `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim() || 'Unknown';
        const s = scores[student.id] ?? { ca: '', exam: '', comment: '' };
        const total = getTotal(s);
        const grade = getGrade(total);
        const enteredCount = (s.ca ? 1 : 0) + (s.exam ? 1 : 0);

        return (
          <div
            key={student.id}
            className={clsx(
              'grid grid-cols-[1fr_80px_80px_60px_52px_180px] gap-3 px-5 py-2.5 items-center min-w-[540px]',
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
  const { classId } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSubject, setSelectedSubject] = useState(SUBJECTS[0]);
  const [session, setSession] = useState('');
  const [term, setTerm] = useState('first');
  const [scores, setScores] = useState<Record<string, Record<string, StudentScore>>>({});

  useEffect(() => { setSession(getCurrentSession()); }, []);

  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['my-class-students', { per_page: 100 }],
    queryFn: () => studentsApi.myClass({ per_page: 100, is_active: true }).then((r) => r.data),
    staleTime: 60_000,
    retry: 1,
    enabled: !!classId,
  });

  const { data: existingResults, isLoading: resultsLoading } = useQuery({
    queryKey: ['results', 'class', classId, { academic_session: session, term, subject: selectedSubject }],
    queryFn: () => resultsApi.classResults(classId!, { academic_session: session, term, subject: selectedSubject }).then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
    enabled: !!classId && !!session,
  });

  // Pre-populate scores from existing results when data loads
  useEffect(() => {
    if (!existingResults) return;
    const existing: Record<string, StudentScore> = {};
    existingResults.forEach((r) => {
      existing[r.student_id] = {
        ca: r.ca_score != null ? String(r.ca_score) : '',
        exam: r.exam_score != null ? String(r.exam_score) : '',
        comment: r.teacher_comment ?? '',
      };
    });
    setScores((prev) => ({ ...prev, [selectedSubject]: existing }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingResults]);

  const { mutate: saveScores, isPending: isSaving } = useMutation({
    mutationFn: (data: Parameters<typeof resultsApi.enterScores>[0]) =>
      resultsApi.enterScores(data).then((r) => r.data),
    onSuccess: (data) => {
      toast.success(`${data.subject}: ${data.updated_count} scores saved`);
      queryClient.invalidateQueries({ queryKey: ['results', 'class', classId] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? 'Failed to save scores';
      toast.error(typeof msg === 'string' ? msg : 'Failed to save scores');
    },
  });

  const students = (studentsData?.items ?? []) as StudentListItem[];
  const subjectScores = scores[selectedSubject] ?? {};

  const isApproved = (existingResults ?? []).some((r) => r.is_approved);
  const approvedSet = new Set(
    SUBJECTS.filter((subj) =>
      subj === selectedSubject ? isApproved : false
    )
  );

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
    if (!classId || !session) {
      toast.error('Missing class or session');
      return;
    }
    const entries = students
      .filter((s) => {
        const sc = subjectScores[s.id];
        return sc && (sc.ca || sc.exam);
      })
      .map((s) => ({
        student_id: s.id,
        ca_score: parseFloat(subjectScores[s.id]?.ca || '0') || 0,
        exam_score: parseFloat(subjectScores[s.id]?.exam || '0') || 0,
      }));

    if (entries.length === 0) {
      toast.error('No scores entered to save');
      return;
    }

    saveScores({ class_id: classId, academic_session: session, term, subject: selectedSubject, entries });
  };

  const isLoading = studentsLoading || resultsLoading;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Enter Scores"
        description="Record CA and exam scores by subject"
      />

      {/* Session/Term selectors */}
      <div className="flex flex-wrap items-center gap-3 -mt-1">
        <input
          type="text"
          value={session}
          onChange={(e) => setSession(e.target.value)}
          placeholder="e.g. 2024/2025"
          className={clsx(
            'text-sm rounded-lg px-3 py-1.5 w-32',
            'bg-[var(--color-surface)] border border-[var(--color-border)]',
            'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
            'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30',
            'transition-all duration-150',
          )}
        />
        <select
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          className={clsx(
            'text-sm rounded-lg px-3 py-1.5 cursor-pointer',
            'bg-[var(--color-surface)] border border-[var(--color-border)]',
            'text-[var(--color-text-primary)]',
            'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30',
            'transition-all duration-150',
          )}
        >
          {TERMS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Subject tabs */}
      <div className="card-shell">
        <div className="card-core p-4 flex flex-col gap-3">
          <SubjectTabs
            subjects={SUBJECTS}
            active={selectedSubject}
            approvedSet={approvedSet}
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
        <div className="card-core overflow-x-auto">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_80px_80px_60px_52px_180px] gap-3 px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-navy)] min-w-[540px]">
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
            disabled={isSaving}
            className={clsx(
              'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer',
              'bg-[var(--color-navy)] text-white',
              'hover:bg-[var(--color-navy-mid)] active:scale-[0.98]',
              'transition-all duration-200 disabled:opacity-60',
            )}
          >
            <Save className="w-4 h-4" strokeWidth={1.5} />
            {isSaving ? 'Saving…' : `Save ${selectedSubject}`}
          </button>
        </div>
      )}
    </div>
  );
}
