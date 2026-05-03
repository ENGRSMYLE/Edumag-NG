'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Badge } from '@/components/shared/Badge';
import { studentsApi } from '@/lib/api';
import { getInitials, formatDate } from '@/lib/formatters';
import type { StudentListItem } from '@/types/student';

function StudentNameCell({ row }: { row: StudentListItem }) {
  const fullName = `${row.first_name} ${row.last_name}`;
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-full bg-[var(--color-gold)]/15 flex items-center justify-center flex-shrink-0">
        <span className="text-[10px] font-bold text-[var(--color-gold)]">
          {getInitials(fullName)}
        </span>
      </div>
      <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
        {fullName}
      </span>
    </div>
  );
}

export default function StaffStudentsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['students', { page, search, per_page: 20 }],
    queryFn: () =>
      studentsApi.list({ page, per_page: 20, search: search || undefined }).then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
  });

  const columns: Column<StudentListItem>[] = [
    {
      key: 'first_name',
      header: 'Name',
      sortable: true,
      render: (_, row) => <StudentNameCell row={row} />,
    },
    {
      key: 'admission_number',
      header: 'Admission No.',
      render: (v) => (
        <span className="text-sm font-mono tabular-nums text-[var(--color-text-secondary)]">
          {String(v)}
        </span>
      ),
    },
    {
      key: 'class_name',
      header: 'Class',
      render: (v) => (
        <span className="text-sm text-[var(--color-text-secondary)]">
          {v ? String(v) : <span className="text-[var(--color-text-muted)]">—</span>}
        </span>
      ),
    },
    {
      key: 'gender',
      header: 'Gender',
      render: (v) => (
        <span className="text-sm text-[var(--color-text-secondary)] capitalize">{String(v)}</span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (v) => (
        <Badge variant={v ? 'success' : 'danger'} dot>
          {v ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'admission_date',
      header: 'Admitted',
      render: (v) => (
        <span className="text-sm text-[var(--color-text-muted)] font-mono tabular-nums">
          {v ? formatDate(String(v)) : '—'}
        </span>
      ),
    },
    {
      key: 'id',
      header: '',
      className: 'w-20',
      render: (_, row) => (
        <Link
          href={`/dashboard/staff/students/${row.id}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-[var(--color-navy)] bg-[var(--color-navy)]/8 hover:bg-[var(--color-navy)]/12 transition-colors duration-150"
        >
          <Eye className="w-3 h-3" strokeWidth={1.5} />
          View
        </Link>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Students"
        description="View student profiles in your class"
      />

      <DataTable
        columns={columns}
        data={(data?.items ?? []) as unknown as StudentListItem[]}
        rowKey="id"
        isLoading={isLoading}
        totalCount={data?.total ?? 0}
        page={page}
        perPage={20}
        onPageChange={setPage}
        onSearch={(q) => { setSearch(q); setPage(1); }}
        searchPlaceholder="Search by name or admission no…"
        emptyTitle="No students found"
        emptyDescription="Students assigned to your class will appear here."
      />
    </div>
  );
}
