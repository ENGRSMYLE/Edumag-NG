'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield } from 'lucide-react';
import { clsx } from 'clsx';

import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Badge } from '@/components/shared/Badge';
import { settingsApi } from '@/lib/api';
import { formatDateTime } from '@/lib/formatters';
import type { AuditLog } from '@/types/dashboard';

const ACTION_OPTIONS = [
  'LOGIN',
  'LOGOUT',
  'CREATE_STUDENT',
  'UPDATE_STUDENT',
  'DELETE_STUDENT',
  'INVITE_USER',
  'DEACTIVATE_USER',
  'UPDATE_SETTINGS',
  'CREATE_PAYMENT',
  'CONFIRM_PAYMENT',
  'SET_CURRENT_TERM',
];

function actionVariant(action: string): 'danger' | 'warning' | 'info' | 'neutral' {
  if (action.startsWith('DELETE') || action.startsWith('DEACTIVATE')) return 'danger';
  if (action.startsWith('UPDATE') || action === 'LOGOUT') return 'warning';
  if (action === 'LOGIN' || action.startsWith('CREATE') || action.startsWith('INVITE')) return 'info';
  return 'neutral';
}

export default function SystemLogsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const queryParams = {
    page,
    per_page: 20,
    action: actionFilter || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', queryParams],
    queryFn: () => settingsApi.logs(queryParams).then((r) => r.data),
    staleTime: 15_000,
    retry: 1,
  });

  const columns: Column<AuditLog>[] = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      sortable: true,
      render: (v) => (
        <span className="text-xs font-mono tabular-nums text-[var(--color-text-muted)]">
          {formatDateTime(String(v))}
        </span>
      ),
    },
    {
      key: 'user_name',
      header: 'User',
      render: (v, row) => (
        <div>
          <span className="text-sm font-medium text-[var(--color-text-primary)]">{String(v)}</span>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 capitalize">{String(row.user_role)}</p>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (v) => (
        <Badge variant={actionVariant(String(v))}>
          {String(v).replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'ip_address',
      header: 'IP Address',
      render: (v) => (
        <span className="text-xs font-mono tabular-nums text-[var(--color-text-secondary)]">
          {String(v)}
        </span>
      ),
    },
    {
      key: 'details',
      header: 'Details',
      render: (v) => (
        <span className="text-xs text-[var(--color-text-muted)] max-w-[200px] truncate block">
          {v ? String(v) : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="System Logs"
        description="Audit trail of all actions performed in the system"
        breadcrumbs={[
          { label: 'Settings', href: '/dashboard/super-admin/settings' },
          { label: 'System Logs' },
        ]}
      />

      {/* Filters */}
      <div className="card-shell">
        <div className="card-core">
          <div className="flex items-start gap-3 p-4 flex-wrap">
            <div className="flex items-center gap-1.5 flex-shrink-0 text-[var(--color-text-muted)]">
              <Shield className="w-4 h-4" strokeWidth={1.5} />
              <span className="text-xs font-medium">Filters</span>
            </div>

            {/* Action type filter */}
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              className={clsx(
                'text-sm rounded-lg px-3 py-1.5 cursor-pointer',
                'bg-[var(--color-surface)] border border-[var(--color-border)]',
                'text-[var(--color-text-primary)]',
                'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30',
                'transition-all duration-150',
              )}
              aria-label="Filter by action"
            >
              <option value="">All Actions</option>
              {ACTION_OPTIONS.map((a) => (
                <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
              ))}
            </select>

            {/* Date from */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-[var(--color-text-muted)]">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className={clsx(
                  'text-sm rounded-lg px-3 py-1.5',
                  'bg-[var(--color-surface)] border border-[var(--color-border)]',
                  'text-[var(--color-text-primary)]',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30',
                  'transition-all duration-150',
                )}
              />
            </div>

            {/* Date to */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-[var(--color-text-muted)]">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className={clsx(
                  'text-sm rounded-lg px-3 py-1.5',
                  'bg-[var(--color-surface)] border border-[var(--color-border)]',
                  'text-[var(--color-text-primary)]',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30',
                  'transition-all duration-150',
                )}
              />
            </div>

            {(actionFilter || dateFrom || dateTo) && (
              <button
                onClick={() => { setActionFilter(''); setDateFrom(''); setDateTo(''); setPage(1); }}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] underline cursor-pointer transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Logs table */}
      <DataTable
        columns={columns}
        data={(data?.items ?? []) as unknown as AuditLog[]}
        rowKey="id"
        isLoading={isLoading}
        totalCount={data?.total ?? 0}
        page={page}
        perPage={20}
        onPageChange={setPage}
        searchPlaceholder="Search logs…"
        emptyTitle="No logs found"
        emptyDescription="System activity will appear here."
      />
    </div>
  );
}
