'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { Download, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';
import { financeApi, classesApi } from '@/lib/api';
import { formatDate } from '@/lib/formatters';
import type { DebtorListItem } from '@/types/dashboard';

export default function AdminDebtorsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');

  const queryParams = {
    page,
    per_page: 20,
    search: search || undefined,
    class_id: classFilter || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['finance', 'debtors', queryParams],
    queryFn: () => financeApi.debtors(queryParams).then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
  });

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classesApi.list().then((r) => r.data.items),
    staleTime: 120_000,
  });

  const exportCSV = () => {
    const items = (data?.items ?? []) as DebtorListItem[];
    const rows = items.map((d) => ({
      'Student Name': d.student_name,
      'Class': d.class_name ?? '—',
      'Expected (₦)': (d.expected_kobo / 100).toFixed(2),
      'Paid (₦)': (d.paid_kobo / 100).toFixed(2),
      'Balance (₦)': (d.balance_kobo / 100).toFixed(2),
      'Last Payment': d.last_payment_date ? formatDate(d.last_payment_date) : '—',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Debtors');
    XLSX.writeFile(wb, 'debtors_report.xlsx');
  };

  const columns: Column<DebtorListItem>[] = [
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
        <span className="text-sm text-[var(--color-text-secondary)]">
          {v ? String(v) : <span className="text-[var(--color-text-muted)]/50">Unassigned</span>}
        </span>
      ),
    },
    {
      key: 'expected_kobo',
      header: 'Expected',
      mobileHide: true,
      render: (v) => <CurrencyDisplay kobo={Number(v)} size="sm" />,
    },
    {
      key: 'paid_kobo',
      header: 'Paid',
      render: (v) => <CurrencyDisplay kobo={Number(v)} size="sm" className="text-emerald-600" />,
    },
    {
      key: 'balance_kobo',
      header: 'Balance',
      render: (v) => <CurrencyDisplay kobo={Number(v)} size="sm" className="text-red-600 font-semibold" />,
    },
    {
      key: 'last_payment_date',
      header: 'Last Payment',
      sortable: true,
      mobileHide: true,
      render: (v) => (
        <span className="text-sm text-[var(--color-text-muted)] font-mono tabular-nums">
          {v ? formatDate(String(v)) : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Debtors"
        description="Students with outstanding fee balances"
        breadcrumbs={[
          { label: 'Finance', href: '/dashboard/admin/finance' },
          { label: 'Debtors' },
        ]}
        actions={
          <button
            onClick={exportCSV}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer',
              'bg-[var(--color-surface)] border border-[var(--color-border)]',
              'text-[var(--color-text-primary)] hover:bg-[var(--color-border)]',
              'transition-all duration-150',
            )}
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
            Export CSV
          </button>
        }
      />

      {/* Alert banner */}
      {!isLoading && data && data.total > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" strokeWidth={1.5} />
          <p className="text-sm text-amber-700">
            <span className="font-semibold">{data.total} students</span> have outstanding fee balances this term.
          </p>
        </div>
      )}

      {/* Class filter */}
      <div className="flex items-center gap-3 -mt-2">
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
      </div>

      <DataTable
        columns={columns}
        data={(data?.items ?? []) as unknown as DebtorListItem[]}
        rowKey="id"
        isLoading={isLoading}
        totalCount={data?.total ?? 0}
        page={page}
        perPage={20}
        onPageChange={setPage}
        onSearch={(q) => { setSearch(q); setPage(1); }}
        searchPlaceholder="Search by student name…"
        emptyTitle="No debtors found"
        emptyDescription="All students are up to date with their fees."
      />
    </div>
  );
}
