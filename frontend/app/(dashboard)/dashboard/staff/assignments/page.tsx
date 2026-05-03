'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList,
  Plus,
  Save,
  Calendar,
  Users,
  BookOpen,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/shared/Badge';
import { assignmentsApi } from '@/lib/api';
import { formatDate } from '@/lib/formatters';
import type { AssignmentListItem, AssignmentSubmission } from '@/types/assignment';

type ActiveTab = 'mine' | 'grade';

// ---------------------------------------------------------------------------
// Mock data — replaced by real API once backend is wired
// ---------------------------------------------------------------------------

const MOCK_ASSIGNMENTS: AssignmentListItem[] = [
  {
    id: 'asgn-1',
    title: 'Quadratic Equations Practice',
    subject: 'Mathematics',
    description: 'Solve problems 1–20 from Chapter 7.',
    due_date: '2026-05-02',
    max_score: 20,
    submission_count: 18,
    graded_count: 12,
    created_at: '2026-04-20T09:00:00',
  },
  {
    id: 'asgn-2',
    title: 'Essay: My Future Career',
    subject: 'English Language',
    description: 'Write a 500-word essay on your future career goals.',
    due_date: '2026-04-30',
    max_score: 30,
    submission_count: 25,
    graded_count: 25,
    created_at: '2026-04-18T11:00:00',
  },
  {
    id: 'asgn-3',
    title: 'Living and Non-Living Things',
    subject: 'Basic Science',
    description: 'Research and present 5 examples each of living and non-living things.',
    due_date: '2026-05-07',
    max_score: 15,
    submission_count: 8,
    graded_count: 0,
    created_at: '2026-04-22T08:00:00',
  },
];

const MOCK_SUBMISSIONS: Record<string, AssignmentSubmission[]> = {
  'asgn-1': [
    { id: 'sub-1', student_id: 's1', student_name: 'Adaeze Okonkwo', submitted_at: '2026-04-28T14:22:00', score: 17, feedback: 'Well done!', is_graded: true },
    { id: 'sub-2', student_id: 's2', student_name: 'Emeka Chukwu', submitted_at: '2026-04-29T09:15:00', score: undefined, feedback: '', is_graded: false },
    { id: 'sub-3', student_id: 's3', student_name: 'Fatima Aliyu', submitted_at: '2026-04-27T16:40:00', score: 19, feedback: 'Excellent work!', is_graded: true },
    { id: 'sub-4', student_id: 's4', student_name: 'Oluwaseun Bello', submitted_at: '2026-04-29T11:00:00', score: undefined, feedback: '', is_graded: false },
    { id: 'sub-5', student_id: 's5', student_name: 'Chiamaka Eze', submitted_at: '2026-04-28T19:30:00', score: 15, feedback: 'Good effort.', is_graded: true },
  ],
  'asgn-2': [],
  'asgn-3': [
    { id: 'sub-6', student_id: 's1', student_name: 'Adaeze Okonkwo', submitted_at: '2026-04-29T10:00:00', score: undefined, feedback: '', is_graded: false },
  ],
};

// ---------------------------------------------------------------------------
// My Assignments tab
// ---------------------------------------------------------------------------

function MyAssignmentsTab() {
  const assignments = MOCK_ASSIGNMENTS;

  return (
    <div className="flex flex-col gap-3">
      {assignments.length === 0 ? (
        <div className="card-shell">
          <div className="card-core p-12 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--color-navy)]/8 flex items-center justify-center">
              <ClipboardList className="w-6 h-6 text-[var(--color-navy)]" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">No assignments yet</p>
            <p className="text-xs text-[var(--color-text-muted)]">Create your first assignment for your class.</p>
            <Link
              href="/dashboard/staff/assignments/new"
              className={clsx(
                'mt-2 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer',
                'bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy-mid)]',
                'transition-colors duration-150',
              )}
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
              Create Assignment
            </Link>
          </div>
        </div>
      ) : (
        assignments.map((asgn) => {
          const duePast = new Date(asgn.due_date) < new Date();
          const allGraded = asgn.graded_count === asgn.submission_count && asgn.submission_count > 0;
          const pendingGrade = asgn.submission_count - asgn.graded_count;

          return (
            <div key={asgn.id} className="card-shell">
              <div className="card-core p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-navy)]/8 flex items-center justify-center flex-shrink-0">
                    <ClipboardList className="w-5 h-5 text-[var(--color-navy)]" strokeWidth={1.5} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                          {asgn.title}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                            <BookOpen className="w-3 h-3" strokeWidth={1.5} />
                            {asgn.subject}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                            <Calendar className="w-3 h-3" strokeWidth={1.5} />
                            Due {formatDate(asgn.due_date)}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                            <Users className="w-3 h-3" strokeWidth={1.5} />
                            {asgn.submission_count} submitted
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {duePast ? (
                          <Badge variant="neutral">Closed</Badge>
                        ) : (
                          <Badge variant="info" dot>Open</Badge>
                        )}
                        {allGraded ? (
                          <Badge variant="success">All Graded</Badge>
                        ) : pendingGrade > 0 ? (
                          <Badge variant="warning">{pendingGrade} Pending</Badge>
                        ) : null}
                      </div>
                    </div>

                    {asgn.description && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-2 line-clamp-2">
                        {asgn.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grade Submissions tab
// ---------------------------------------------------------------------------

function GradeSubmissionsTab() {
  const [selectedId, setSelectedId] = useState<string>(MOCK_ASSIGNMENTS[0]?.id ?? '');
  const [localGrades, setLocalGrades] = useState<Record<string, { score: string; feedback: string }>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const submissions = MOCK_SUBMISSIONS[selectedId] ?? [];
  const selectedAsgn = MOCK_ASSIGNMENTS.find((a) => a.id === selectedId);

  const setGrade = (subId: string, field: 'score' | 'feedback', value: string) => {
    setLocalGrades((prev) => ({
      ...prev,
      [subId]: { ...(prev[subId] ?? { score: '', feedback: '' }), [field]: value },
    }));
  };

  const handleSave = async (sub: AssignmentSubmission) => {
    const g = localGrades[sub.id];
    if (!g?.score) {
      toast.error('Enter a score before saving');
      return;
    }
    setSaving((prev) => ({ ...prev, [sub.id]: true }));
    await new Promise((r) => setTimeout(r, 600));
    setSaving((prev) => ({ ...prev, [sub.id]: false }));
    toast.success(`Graded ${sub.student_name}`);
  };

  const maxScore = selectedAsgn?.max_score ?? 100;

  return (
    <div className="flex flex-col gap-4">
      {/* Assignment selector */}
      <div className="card-shell">
        <div className="card-core p-4">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-4 h-4 text-[var(--color-text-muted)]" strokeWidth={1.5} />
            <span className="text-xs font-medium text-[var(--color-text-muted)]">Assignment:</span>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className={clsx(
                'flex-1 max-w-xs text-sm rounded-lg px-3 py-1.5 cursor-pointer',
                'bg-[var(--color-surface)] border border-[var(--color-border)]',
                'text-[var(--color-text-primary)]',
                'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30',
              )}
            >
              {MOCK_ASSIGNMENTS.map((a) => (
                <option key={a.id} value={a.id}>{a.title}</option>
              ))}
            </select>
            {selectedAsgn && (
              <span className="text-xs text-[var(--color-text-muted)]">
                Max score: <strong>{maxScore}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Submissions */}
      {submissions.length === 0 ? (
        <div className="card-shell">
          <div className="card-core p-10 text-center">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">No submissions yet</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Students haven't submitted work for this assignment.
            </p>
          </div>
        </div>
      ) : (
        <div className="card-shell">
          <div className="card-core">
            {/* Header */}
            <div className="grid grid-cols-[1fr_120px_1fr_80px] gap-3 px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-navy)]">
              <span className="text-xs font-semibold text-white/80 uppercase tracking-wide">Student</span>
              <span className="text-xs font-semibold text-white/80 uppercase tracking-wide">Submitted</span>
              <span className="text-xs font-semibold text-white/80 uppercase tracking-wide">Feedback</span>
              <span className="text-xs font-semibold text-white/80 uppercase tracking-wide text-center">
                Score/{maxScore}
              </span>
            </div>

            <div className="divide-y divide-[var(--color-border)]">
              {submissions.map((sub, idx) => {
                const local = localGrades[sub.id];
                const scoreVal = local?.score ?? (sub.score != null ? String(sub.score) : '');
                const feedbackVal = local?.feedback ?? (sub.feedback ?? '');
                const isBusy = saving[sub.id] ?? false;

                return (
                  <div
                    key={sub.id}
                    className={clsx(
                      'grid grid-cols-[1fr_120px_1fr_80px] gap-3 px-5 py-3 items-center',
                      idx % 2 === 0 ? 'bg-[var(--color-cream)]' : 'bg-white',
                    )}
                  >
                    {/* Student */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-[var(--color-gold)]/15 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-[var(--color-gold)]">
                          {sub.student_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                          {sub.student_name}
                        </p>
                        {sub.is_graded && !local && (
                          <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium">
                            <CheckCircle2 className="w-2.5 h-2.5" strokeWidth={2} />
                            Graded
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Submitted at */}
                    <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                      <Clock className="w-3 h-3" strokeWidth={1.5} />
                      {new Date(sub.submitted_at).toLocaleDateString('en-NG', {
                        day: 'numeric', month: 'short',
                      })}
                    </span>

                    {/* Feedback */}
                    <input
                      type="text"
                      value={feedbackVal}
                      onChange={(e) => setGrade(sub.id, 'feedback', e.target.value)}
                      placeholder="Feedback…"
                      className={clsx(
                        'w-full text-xs rounded-lg px-2 py-1.5',
                        'bg-[var(--color-surface)] border border-[var(--color-border)]',
                        'placeholder:text-[var(--color-text-muted)]',
                        'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30',
                      )}
                    />

                    {/* Score + Save */}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={scoreVal}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^\d.]/g, '');
                          if (parseFloat(v) > maxScore) return;
                          setGrade(sub.id, 'score', v);
                        }}
                        placeholder="—"
                        className={clsx(
                          'w-14 text-sm text-center rounded-lg px-2 py-1.5 tabular-nums',
                          'bg-[var(--color-surface)] border border-[var(--color-border)]',
                          'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30',
                        )}
                        maxLength={4}
                      />
                      <button
                        type="button"
                        onClick={() => handleSave(sub)}
                        disabled={isBusy}
                        className={clsx(
                          'p-1.5 rounded-lg cursor-pointer transition-all duration-150',
                          'text-emerald-600 bg-emerald-50 hover:bg-emerald-100',
                          isBusy && 'opacity-50 cursor-not-allowed',
                        )}
                        aria-label="Save grade"
                      >
                        {isBusy ? (
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" strokeWidth={2} />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AssignmentsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('mine');

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Assignments"
        description="Create and grade class assignments"
        actions={
          <Link
            href="/dashboard/staff/assignments/new"
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer',
              'bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy-mid)]',
              'transition-colors duration-150',
            )}
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            New Assignment
          </Link>
        }
      />

      {/* Tab switcher */}
      <div className="flex items-center gap-1 bg-[var(--color-surface)] rounded-xl p-1 w-fit border border-[var(--color-border)]">
        {[
          { key: 'mine' as const, label: 'My Assignments' },
          { key: 'grade' as const, label: 'Grade Submissions' },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium cursor-pointer',
              'transition-all duration-200',
              activeTab === key
                ? 'bg-[var(--color-navy)] text-white shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'mine' ? <MyAssignmentsTab /> : <GradeSubmissionsTab />}
    </div>
  );
}
