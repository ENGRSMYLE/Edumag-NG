'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Mail, Phone, UserCircle } from 'lucide-react';
import { clsx } from 'clsx';

import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Badge } from '@/components/shared/Badge';
import { parentsApi } from '@/lib/api';
import { formatNigerianPhone, getInitials } from '@/lib/formatters';
import type { ParentListItem } from '@/types/parent';

const STATUS_VARIANT: Record<string, 'info' | 'success' | 'neutral' | 'warning'> = {
  active: 'success',
  invited: 'info',
  disabled: 'neutral',
  suspended: 'warning',
};

function ParentNameCell({ row }: { row: ParentListItem }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-full bg-[var(--color-navy)]/10 flex items-center justify-center flex-shrink-0">
        <span className="text-[10px] font-bold text-[var(--color-navy)]">
          {getInitials(row.name)}
        </span>
      </div>
      <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
        {row.name}
      </span>
    </div>
  );
}

export default function AdminParentsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const queryParams = { page, per_page: 20, search: search || undefined };

  const { data, isLoading } = useQuery({
    queryKey: ['parents', queryParams],
    queryFn: () => parentsApi.list(queryParams).then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
  });

  const columns: Column<ParentListItem>[] = [
    {
      key: 'name',
      header: 'Parent Name',
      sortable: true,
      render: (_, row) => <ParentNameCell row={row} />,
    },
    {
      key: 'active_children_count',
      header: 'Children',
      render: (v) => (
        <span className="text-sm text-[var(--color-text-secondary)]">{String(v)}</span>
      ),
    },
    {
      key: 'activation_status',
      header: 'Status',
      render: (v) => (
        <Badge variant={STATUS_VARIANT[String(v)] ?? 'neutral'}>
          {String(v).replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (v) => (
        <div className="flex items-center gap-1.5">
          <Phone className="w-3 h-3 text-[var(--color-text-muted)] flex-shrink-0" strokeWidth={1.5} />
          <span className="text-sm font-mono text-[var(--color-text-secondary)]">
            {v ? formatNigerianPhone(String(v)) : '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      mobileHide: true,
      render: (v) => (
        v ? (
          <div className="flex items-center gap-1.5">
            <Mail className="w-3 h-3 text-[var(--color-text-muted)] flex-shrink-0" strokeWidth={1.5} />
            <span className="text-sm text-[var(--color-text-secondary)] truncate max-w-[180px]">
              {String(v)}
            </span>
          </div>
        ) : (
          <span className="text-[var(--color-text-muted)]/50">—</span>
        )
      ),
    },
    {
      key: 'guardian_id',
      header: 'Actions',
      className: 'w-24',
      render: (_, row) => (
        <button
          className={clsx(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer',
            'text-[var(--color-navy)] bg-[var(--color-navy)]/8 hover:bg-[var(--color-navy)]/12',
            'transition-colors duration-150',
          )}
        >
          <UserCircle className="w-3 h-3" strokeWidth={1.5} />
          View
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Parent Directory"
        description="View and manage parent and guardian contacts"
      />

      <DataTable
        columns={columns}
        data={(data?.items ?? []) as unknown as ParentListItem[]}
        rowKey="guardian_id"
        isLoading={isLoading}
        totalCount={data?.total ?? 0}
        page={page}
        perPage={20}
        onPageChange={setPage}
        onSearch={(q) => { setSearch(q); setPage(1); }}
        searchPlaceholder="Search by parent or student name…"
        emptyTitle="No parents found"
        emptyDescription="Parent records will appear here once added."
      />
    </div>
  );
}
