'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, FileCheck, Download, FileDown } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Badge } from '@/components/shared/Badge';
import { resultsApi, classesApi } from '@/lib/api';
import type { ResultSummary } from '@/lib/api';
import { getCurrentSession } from '@/lib/formatters';
import { useReportCardPDF } from '@/hooks/useReportCardPDF';
import type { ResultStatus } from '@/types/dashboard';

const TERMS = [
  { value: 'first',  label: 'First Term'  },
  { value: 'second', label: 'Second Term' },
  { value: 'third',  label: 'Third Term'  },
];

const STATUS_CONFIG: Record<ResultStatus, { label: string; variant: 'neutral' | 'warning' | 'success' | 'info' }> = {
  pending:   { label: 'Pending',   variant: 'warning' },
  approved:  { label: 'Approved',  variant: 'success' },
  generated: { label: 'Generated', variant: 'info'    },
};

function ScoreProgress({ entered, total }: { entered: number; total: number }) {
  const pct = total > 0 ? (entered / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden min-w-[60px]">
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-500',
            pct === 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-amber-500' : 'bg-red-400',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-[var(--color-text-muted)] font-mono tabular-nums whitespace-nowrap">
        {entered}/{total}
      </span>
    </div>
  );
}

interface ResultRow {
  id: string;
  student_name: string;
  student_id: string;
  class_name: string;
  subjects_entered: number;
  subjects_total: number;
  comments?: string;
  status: ResultStatus;
}

function deriveStatus(summary: ResultSummary): ResultStatus {
  if (summary.subjects.length === 0) return 'pending';
  return summary.subjects.every((s) => s.is_approved) ? 'approved' : 'pending';
}

const filterCls = clsx(
  'text-sm rounded-lg px-3 py-1.5',
  'bg-[var(--color-surface)] border border-[var(--color-border)]',
  'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
  'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30',
  'transition-all duration-150',
);

export default function AdminResultsPage() {
  const [session, setSession]           = useState('');
  const [term, setTerm]                 = useState('first');
  const [classFilter, setClassFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState<ResultStatus | ''>('');
  const [search, setSearch]             = useState('');
  const [approving, setApproving]       = useState(false);

  const { generateSingle, generateBulk, isGeneratingId, isBulkGenerating } = useReportCardPDF();

  useEffect(() => {
    setSession(getCurrentSession());
  }, []);

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classesApi.list().then((r) => r.data.items),
    staleTime: 120_000,
  });

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['results', 'report-cards', { classFilter, session, term }],
    queryFn: () =>
      resultsApi.classReportCards(classFilter, { academic_session: session, term }).then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
    enabled: !!session && !!classFilter,
  });

  const rows: ResultRow[] = useMemo(() => {
    if (!rawData) return [];
    const maxSubjects = Math.max(...rawData.map((s) => s.subjects.length), 1);
    return rawData.map((s) => ({
      id:               s.student_id,
      student_name:     s.student_name,
      student_id:       s.student_id,
      class_name:       s.class_name,
      subjects_entered: s.subjects.length,
      subjects_total:   maxSubjects,
      comments:         s.teacher_comment ?? undefined,
      status:           deriveStatus(s),
    }));
  }, [rawData]);

  const filtered = useMemo(() => {
    let out = rows;
    if (statusFilter) out = out.filter((r) => r.status === statusFilter);
    if (search)       out = out.filter((r) => r.student_name.toLowerCase().includes(search.toLowerCase()));
    return out;
  }, [rows, statusFilter, search]);

  const handleApprove = async () => {
    if (!classFilter || !session) {
      toast.error('Select a class and session first');
      return;
    }
    setApproving(true);
    try {
      await resultsApi.approve({ class_id: classFilter, academic_session: session, term });
      toast.success('Report cards approved successfully');
    } catch {
      toast.error('Failed to approve report cards');
    } finally {
      setApproving(false);
    }
  };

  const handleDownloadAll = () => {
    if (!classFilter || !session) {
      toast.error('Select a class and session first');
      return;
    }
    generateBulk(classFilter, session, term);
  };

  const allApproved = filtered.length > 0 && filtered.every((r) => r.status === 'approved');

  const columns: Column<ResultRow>[] = [
    {
      key:      'student_name',
      header:   'Student',
      sortable: true,
      render:   (v) => (
        <span className="text-sm font-medium text-[var(--color-text-primary)]">{String(v)}</span>
      ),
    },
    {
      key:    'class_name',
      header: 'Class',
      mobileHide: true,
      render: (v) => (
        <span className="text-sm text-[var(--color-text-secondary)]">{String(v)}</span>
      ),
    },
    {
      key:    'subjects_entered',
      header: 'Scores Entered',
      render: (v, row) => (
        <ScoreProgress entered={Number(v)} total={(row as ResultRow).subjects_total} />
      ),
    },
    {
      key:    'comments',
      header: 'Comments',
      mobileHide: true,
      render: (v) => (
        <span className="text-sm text-[var(--color-text-muted)] truncate max-w-[180px] block">
          {v ? String(v) : <span className="italic opacity-50">—</span>}
        </span>
      ),
    },
    {
      key:    'status',
      header: 'Status',
      render: (v) => {
        const cfg = STATUS_CONFIG[v as ResultStatus];
        return cfg ? <Badge variant={cfg.variant} dot>{cfg.label}</Badge> : null;
      },
    },
    {
      key:    'student_id',
      header: 'PDF',
      render: (v, row) => {
        const sid  = String(v);
        const busy = isGeneratingId(sid);
        return (
          <button
            onClick={() => generateSingle(sid, session, term)}
            disabled={busy || !(row as ResultRow).subjects_entered}
            title={
              !(row as ResultRow).subjects_entered
                ? 'No scores entered yet'
                : 'Download report card PDF'
            }
            className={clsx(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer',
              'border border-[var(--color-border)] text-[var(--color-navy)]',
              'hover:bg-[var(--color-navy)] hover:text-white hover:border-[var(--color-navy)]',
              'transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            {busy
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <Download className="w-3 h-3" strokeWidth={2} />
            }
            {busy ? 'Generating…' : 'PDF'}
          </button>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Report Cards"
        description="Manage academic results and generate report cards"
        actions={
          <div className="flex items-center gap-2">
            {/* Bulk PDF download */}
            <button
              onClick={handleDownloadAll}
              disabled={isBulkGenerating || !classFilter || !filtered.length}
              title={!classFilter ? 'Select a class first' : 'Download all report cards as a single PDF'}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer',
                'border border-[var(--color-navy)] text-[var(--color-navy)]',
                'hover:bg-[var(--color-navy)] hover:text-white',
                'transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {isBulkGenerating
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <FileDown className="w-3.5 h-3.5" strokeWidth={1.5} />
              }
              {isBulkGenerating ? 'Generating…' : 'Download All PDFs'}
            </button>

            {/* Approve */}
            <button
              onClick={handleApprove}
              disabled={approving || !allApproved || !classFilter}
              title={
                !classFilter     ? 'Select a class first'
                : !allApproved   ? 'All results must be approved before generating'
                : undefined
              }
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer',
                'bg-[var(--color-navy)] text-white',
                'hover:bg-[var(--color-navy-mid)] active:scale-[0.98]',
                'transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {approving
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <FileCheck className="w-3.5 h-3.5" strokeWidth={1.5} />
              }
              {approving ? 'Approving…' : 'Approve Report Cards'}
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 -mt-2">
        <input
          type="text"
          value={session}
          onChange={(e) => setSession(e.target.value)}
          placeholder="e.g. 2024/2025"
          className={clsx(filterCls, 'w-32')}
        />
        <select
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          className={clsx(filterCls, 'cursor-pointer')}
        >
          {TERMS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className={clsx(filterCls, 'cursor-pointer')}
        >
          <option value="">Select a class…</option>
          {(classes ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ResultStatus | '')}
          className={clsx(filterCls, 'cursor-pointer')}
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={filtered as unknown as ResultRow[]}
        rowKey="id"
        isLoading={isLoading}
        totalCount={filtered.length}
        page={1}
        perPage={filtered.length || 20}
        onPageChange={() => {}}
        onSearch={(q) => setSearch(q)}
        searchPlaceholder="Search by student name…"
        emptyTitle={!classFilter ? 'Select a class to view results' : 'No results found'}
        emptyDescription={
          !classFilter
            ? 'Choose a class from the filter above.'
            : 'Results will appear here once teachers enter scores.'
        }
      />
    </div>
  );
}
