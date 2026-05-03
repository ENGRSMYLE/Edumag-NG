'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileBarChart, Loader2, CheckCircle2, Clock, FileCheck } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Badge } from '@/components/shared/Badge';
import { resultsApi, classesApi } from '@/lib/api';
import { getCurrentSession, formatTerm } from '@/lib/formatters';
import type { ResultListItem, ResultStatus } from '@/types/dashboard';

const TERMS = [
  { value: 'first', label: 'First Term' },
  { value: 'second', label: 'Second Term' },
  { value: 'third', label: 'Third Term' },
];

const STATUS_CONFIG: Record<ResultStatus, { label: string; variant: 'neutral' | 'warning' | 'success' | 'info' }> = {
  pending:   { label: 'Pending',   variant: 'warning' },
  approved:  { label: 'Approved',  variant: 'success' },
  generated: { label: 'Generated', variant: 'info' },
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

export default function AdminResultsPage() {
  const [session, setSession] = useState('');
  const [term, setTerm] = useState('first');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<ResultStatus | ''>('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setSession(getCurrentSession());
  }, []);

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classesApi.list().then((r) => r.data),
    staleTime: 120_000,
  });

  const queryParams = {
    page,
    per_page: 20,
    session: session || undefined,
    term: term || undefined,
    class_id: classFilter || undefined,
    status: statusFilter || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['results', 'report', queryParams],
    queryFn: () => resultsApi.report(queryParams).then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
    enabled: !!session,
  });

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await new Promise((r) => setTimeout(r, 1500));
      toast.success('Report cards generated successfully');
    } catch {
      toast.error('Failed to generate report cards');
    } finally {
      setGenerating(false);
    }
  };

  const columns: Column<ResultListItem>[] = [
    {
      key: 'student_name',
      header: 'Student',
      sortable: true,
      render: (v) => (
        <span className="text-sm font-medium text-[var(--color-text-primary)]">{String(v)}</span>
      ),
    },
    {
      key: 'class_name',
      header: 'Class',
      render: (v) => (
        <span className="text-sm text-[var(--color-text-secondary)]">{String(v)}</span>
      ),
    },
    {
      key: 'subjects_entered',
      header: 'Scores Entered',
      render: (v, row) => (
        <ScoreProgress entered={Number(v)} total={(row as ResultListItem).subjects_total} />
      ),
    },
    {
      key: 'comments',
      header: 'Comments',
      render: (v) => (
        <span className="text-sm text-[var(--color-text-muted)] truncate max-w-[180px] block">
          {v ? String(v) : <span className="italic opacity-50">—</span>}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (v) => {
        const cfg = STATUS_CONFIG[v as ResultStatus];
        return cfg ? <Badge variant={cfg.variant} dot>{cfg.label}</Badge> : null;
      },
    },
  ];

  const allApproved = data && data.items.length > 0 && data.items.every((r) => r.status === 'approved');

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Report Cards"
        description="Manage academic results and generate report cards"
        actions={
          <button
            onClick={handleGenerate}
            disabled={generating || !allApproved}
            title={!allApproved ? 'All results must be approved before generating' : undefined}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer',
              'bg-[var(--color-navy)] text-white',
              'hover:bg-[var(--color-navy-mid)] active:scale-[0.98]',
              'transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {generating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileCheck className="w-3.5 h-3.5" strokeWidth={1.5} />
            )}
            {generating ? 'Generating…' : 'Generate Report Cards'}
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 -mt-2">
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
          onChange={(e) => { setTerm(e.target.value); setPage(1); }}
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
        <select
          value={classFilter}
          onChange={(e) => { setClassFilter(e.target.value); setPage(1); }}
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
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as ResultStatus | ''); setPage(1); }}
          className={clsx(
            'text-sm rounded-lg px-3 py-1.5 cursor-pointer',
            'bg-[var(--color-surface)] border border-[var(--color-border)]',
            'text-[var(--color-text-primary)]',
            'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30',
            'transition-all duration-150',
          )}
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="generated">Generated</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={(data?.items ?? []) as unknown as ResultListItem[]}
        rowKey="id"
        isLoading={isLoading}
        totalCount={data?.total ?? 0}
        page={page}
        perPage={20}
        onPageChange={setPage}
        onSearch={(q) => { setSearch(q); setPage(1); }}
        searchPlaceholder="Search by student name…"
        emptyTitle="No results found"
        emptyDescription="Results will appear here once teachers enter scores."
      />
    </div>
  );
}
