'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote, AlertCircle, CheckCircle2, Users, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { SkeletonCard } from '@/components/shared/LoadingSkeleton';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Badge } from '@/components/shared/Badge';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';
import { financeApi } from '@/lib/api';
import { formatDate } from '@/lib/formatters';
import type { PaymentListItem, PaymentStatus, PaymentType, PaymentMethod } from '@/types/dashboard';

const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  tuition: 'Tuition',
  levy:    'Levy',
  uniform: 'Uniform',
  books:   'Books',
  other:   'Other',
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash:     'Cash',
  transfer: 'Transfer',
  card:     'Card',
  pos:      'POS',
};

const STATUS_VARIANT: Record<PaymentStatus, 'success' | 'warning' | 'danger'> = {
  confirmed: 'success',
  pending:   'warning',
  rejected:  'danger',
};

export default function AdminFinancePage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | ''>('');

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['finance', 'stats'],
    queryFn: () => financeApi.stats().then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
  });

  const queryParams = {
    page,
    per_page: 20,
    search: search || undefined,
    status: statusFilter || undefined,
  };

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['finance', 'payments', queryParams],
    queryFn: () => financeApi.payments(queryParams).then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
  });

  const columns: Column<PaymentListItem>[] = [
    {
      key: 'student_name',
      header: 'Student',
      sortable: true,
      render: (v) => (
        <span className="text-sm font-medium text-[var(--color-text-primary)]">{String(v)}</span>
      ),
    },
    {
      key: 'amount_kobo',
      header: 'Amount',
      render: (v) => <CurrencyDisplay kobo={Number(v)} size="sm" />,
    },
    {
      key: 'payment_type',
      header: 'Type',
      render: (v) => (
        <span className="text-sm text-[var(--color-text-secondary)]">
          {PAYMENT_TYPE_LABELS[v as PaymentType] ?? String(v)}
        </span>
      ),
    },
    {
      key: 'payment_method',
      header: 'Method',
      render: (v) => (
        <span className="text-sm text-[var(--color-text-secondary)]">
          {PAYMENT_METHOD_LABELS[v as PaymentMethod] ?? String(v)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (v) => (
        <Badge variant={STATUS_VARIANT[v as PaymentStatus] ?? 'neutral'} dot>
          {String(v).charAt(0).toUpperCase() + String(v).slice(1)}
        </Badge>
      ),
    },
    {
      key: 'paid_at',
      header: 'Date',
      sortable: true,
      render: (v) => (
        <span className="text-sm text-[var(--color-text-muted)] font-mono tabular-nums">
          {formatDate(String(v))}
        </span>
      ),
    },
    {
      key: 'confirmed_by',
      header: 'Confirmed By',
      render: (v) => (
        <span className="text-sm text-[var(--color-text-muted)]">
          {v ? String(v) : <span className="text-[var(--color-text-muted)]/50">—</span>}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Payments"
        description="Track fee collections and outstanding balances"
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              title="Total Collected This Term"
              value={statsData ? `₦${(statsData.total_collected_kobo / 100).toLocaleString()}` : '₦0'}
              icon={Banknote}
              change={statsData?.collected_change_pct}
              changeLabel="vs last term"
              variant="success"
              delay={0}
            />
            <StatCard
              title="Outstanding Fees"
              value={statsData ? `₦${(statsData.outstanding_kobo / 100).toLocaleString()}` : '₦0'}
              icon={AlertCircle}
              variant="danger"
              delay={1}
            />
            <StatCard
              title="Fully Paid Students"
              value={statsData?.fully_paid_count ?? 0}
              icon={CheckCircle2}
              variant="gold"
              delay={2}
            />
            <StatCard
              title="Debtors"
              value={statsData?.debtors_count ?? 0}
              icon={Users}
              variant="default"
              delay={3}
            />
          </>
        )}
      </div>

      {/* Payments table */}
      <div className="card-shell">
        <div className="card-core p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] font-display">
              Payment Records
            </h3>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as PaymentStatus | ''); setPage(1); }}
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
              <option value="confirmed">Confirmed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <DataTable
            columns={columns}
            data={(paymentsData?.items ?? []) as unknown as PaymentListItem[]}
            rowKey="id"
            isLoading={paymentsLoading}
            totalCount={paymentsData?.total ?? 0}
            page={page}
            perPage={20}
            onPageChange={setPage}
            onSearch={(q) => { setSearch(q); setPage(1); }}
            searchPlaceholder="Search by student name…"
            emptyTitle="No payments found"
            emptyDescription="Payments will appear here once recorded."
          />
        </div>
      </div>
    </div>
  );
}
