'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Save } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

import { PageHeader } from '@/components/shared/PageHeader';
import { studentsApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { getInitials } from '@/lib/formatters';
import type { StudentListItem } from '@/types/student';

const SUBJECTS = [
  'Mathematics', 'English Language', 'Basic Science', 'Social Studies',
  'Civic Education', 'Christian Religious Studies', 'Islamic Religious Studies',
  'Computer Studies', 'Agricultural Science', 'Physical Education',
];

interface StudentScore {
  ca: string;
  exam: string;
}

export default function ResultsPage() {
  const { classId } = useAuth();
  const [selectedSubject, setSelectedSubject] = useState(SUBJECTS[0]);
  const [scores, setScores] = useState<Record<string, StudentScore>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['my-class-students', { per_page: 100 }],
    queryFn: () => studentsApi.myClass({ per_page: 100, is_active: true }).then((r) => r.data),
    staleTime: 60_000,
    retry: 1,
    enabled: !!classId,
  });

  const students = (data?.items ?? []) as StudentListItem[];

  const setScore = (id: string, field: 'ca' | 'exam', value: string) => {
    const num = value.replace(/[^\d.]/g, '');
    setScores((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { ca: '', exam: '' }), [field]: num },
    }));
  };

  const getTotal = (id: string) => {
    const s = scores[id];
    if (!s) return '—';
    const ca = parseFloat(s.ca) || 0;
    const exam = parseFloat(s.exam) || 0;
    if (!s.ca && !s.exam) return '—';
    return (ca + exam).toFixed(1);
  };

  const getGrade = (total: string) => {
    if (total === '—') return '—';
    const t = parseFloat(total);
    if (t >= 70) return 'A';
    if (t >= 60) return 'B';
    if (t >= 50) return 'C';
    if (t >= 45) return 'D';
    if (t >= 40) return 'E';
    return 'F';
  };

  const gradeColor = (grade: string) => {
    if (grade === 'A') return 'text-emerald-600';
    if (grade === 'B') return 'text-blue-600';
    if (grade === 'C') return 'text-amber-600';
    if (['D', 'E'].includes(grade)) return 'text-orange-600';
    if (grade === 'F') return 'text-red-600';
    return 'text-[var(--color-text-muted)]';
  };

  const handleSave = () => {
    toast.success(`Results for ${selectedSubject} saved`);
  };

  const inputCls = clsx(
    'w-20 text-sm text-center rounded-lg px-2 py-1.5',
    'bg-[var(--color-surface)] border border-[var(--color-border)]',
    'text-[var(--color-text-primary)]',
    'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30',
    'transition-all duration-150',
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Enter Results"
        description="Record student scores by subject"
      />

      {/* Subject selector */}
      <div className="card-shell">
        <div className="card-core p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[var(--color-text-muted)]" strokeWidth={1.5} />
              <span className="text-xs font-medium text-[var(--color-text-muted)]">Subject:</span>
            </div>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className={clsx(
                'text-sm rounded-lg px-3 py-1.5 cursor-pointer',
                'bg-[var(--color-surface)] border border-[var(--color-border)]',
                'text-[var(--color-text-primary)]',
                'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30',
              )}
            >
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <span className="text-xs text-[var(--color-text-muted)] ml-auto">
              CA max: 40 · Exam max: 60 · Total: 100
            </span>
          </div>
        </div>
      </div>

      {/* Results table */}
      <div className="card-shell">
        <div className="card-core">
          {/* Header */}
          <div className="grid grid-cols-[1fr_100px_100px_80px_60px] gap-3 px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
            <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-[0.08em]">Student</span>
            <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-[0.08em] text-center">CA (40)</span>
            <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-[0.08em] text-center">Exam (60)</span>
            <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-[0.08em] text-center">Total</span>
            <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-[0.08em] text-center">Grade</span>
          </div>

          {isLoading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[1fr_100px_100px_80px_60px] gap-3 items-center">
                  <div className="skeleton h-8 rounded" />
                  <div className="skeleton h-8 rounded" />
                  <div className="skeleton h-8 rounded" />
                  <div className="skeleton h-6 w-12 rounded mx-auto" />
                  <div className="skeleton h-6 w-8 rounded mx-auto" />
                </div>
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">No students found.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {students.map((student) => {
                const fullName = student.full_name || `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim() || 'Unknown';
                const total = getTotal(student.id);
                const grade = getGrade(total);
                return (
                  <div
                    key={student.id}
                    className="grid grid-cols-[1fr_100px_100px_80px_60px] gap-3 px-5 py-2.5 items-center"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-[var(--color-gold)]/15 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-[var(--color-gold)]">
                          {getInitials(fullName)}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                        {fullName}
                      </span>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      className={inputCls}
                      value={scores[student.id]?.ca ?? ''}
                      onChange={(e) => setScore(student.id, 'ca', e.target.value)}
                      placeholder="0"
                      maxLength={4}
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      className={inputCls}
                      value={scores[student.id]?.exam ?? ''}
                      onChange={(e) => setScore(student.id, 'exam', e.target.value)}
                      placeholder="0"
                      maxLength={4}
                    />
                    <p className={clsx('text-sm font-semibold text-center tabular-nums', total !== '—' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]')}>
                      {total}
                    </p>
                    <p className={clsx('text-sm font-bold text-center', gradeColor(grade))}>
                      {grade}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {students.length > 0 && (
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
            Save Results
          </button>
        </div>
      )}
    </div>
  );
}
