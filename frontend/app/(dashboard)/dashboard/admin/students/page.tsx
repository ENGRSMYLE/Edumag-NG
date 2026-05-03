'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, UserPlus, Upload } from 'lucide-react';
import { clsx } from 'clsx';
import Link from 'next/link';

import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Badge } from '@/components/shared/Badge';
import { studentsApi, classesApi } from '@/lib/api';
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

export default function AdminStudentsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('');

  const queryParams = {
    page,
    per_page: 20,
    search: search || undefined,
    class_id: classFilter || undefined,
    is_active: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['students', queryParams],
    queryFn: () => studentsApi.list(queryParams).then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
  });

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classesApi.list().then((r) => r.data),
    staleTime: 120_000,
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
      header: 'Date Admitted',
      sortable: true,
      render: (v) => (
        <span className="text-sm text-[var(--color-text-muted)] font-mono tabular-nums">
          {v ? formatDate(String(v)) : '—'}
        </span>
      ),
    },
    {
      key: 'id',
      header: 'Actions',
      className: 'w-24',
      render: (_, row) => (
        <Link
          href={`/dashboard/admin/students/${row.id}`}
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
        description="View and manage student records"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/admin/students/bulk-upload"
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer',
                'bg-[var(--color-surface)] border border-[var(--color-border)]',
                'text-[var(--color-text-primary)] hover:bg-[var(--color-border)]',
                'transition-all duration-150',
              )}
            >
              <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />
              Bulk Upload
            </Link>
            <Link
              href="/dashboard/admin/students/new"
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer',
                'bg-[var(--color-navy)] text-white',
                'hover:bg-[var(--color-navy-mid)] active:scale-[0.98]',
                'transition-all duration-200',
              )}
            >
              <UserPlus className="w-3.5 h-3.5" strokeWidth={1.5} />
              Add Student
            </Link>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 -mt-2">
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
          aria-label="Filter by class"
        >
          <option value="">All Classes</option>
          {(classes ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as '' | 'active' | 'inactive'); setPage(1); }}
          className={clsx(
            'text-sm rounded-lg px-3 py-1.5 cursor-pointer',
            'bg-[var(--color-surface)] border border-[var(--color-border)]',
            'text-[var(--color-text-primary)]',
            'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30',
            'transition-all duration-150',
          )}
          aria-label="Filter by status"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

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
        emptyDescription="Adjust your filters or contact the super admin."
      />
    </div>
  );
}
