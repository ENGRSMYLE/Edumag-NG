'use client';

import { useState } from 'react';
import { Banknote, AlertCircle, CheckCircle2, Users } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { SkeletonCard } from '@/components/shared/LoadingSkeleton';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Badge } from '@/components/shared/Badge';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';
import { useFinancialSummary, usePayments } from '@/hooks/useFinance';
import { formatDate } from '@/lib/formatters';
import type { PaymentListItem, PaymentStatus, PaymentType, PaymentMethod } from '@/types/dashboard';

const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  school_fees:       'School Fees',
  development_levy:  'Development Levy',
  exam_fees:         'Exam Fees',
  other:             'Other',
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash:          'Cash',
  bank_transfer: 'Bank Transfer',
  paystack:      'Paystack',
  pos:           'POS',
};

const STATUS_VARIANT: Record<PaymentStatus, 'success' | 'warning' | 'danger'> = {
  confirmed: 'success',
  pending:   'warning',
  rejected:  'danger',
};

export default function FinancePage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data: statsData, isLoading: statsLoading } = useFinancialSummary();

  const { data: paymentsData, isLoading: paymentsLoading } = usePayments({
    page,
    per_page: 20,
    search: search || undefined,
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
      mobileHide: true,
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
      mobileHide: true,
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
        description="Track all fee collections and outstanding balances"
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
              variant="success"
              delay={0}
            />
            <StatCard
              title="Outstanding Fees"
              value={statsData ? `₦${(statsData.total_outstanding_kobo / 100).toLocaleString()}` : '₦0'}
              icon={AlertCircle}
              variant="danger"
              delay={1}
            />
            <StatCard
              title="Confirmed Payments"
              value={statsData?.confirmed_payments_count ?? 0}
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
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] font-display mb-4">
            Recent Payments
          </h3>
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
