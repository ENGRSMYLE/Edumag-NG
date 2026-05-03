'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';

import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Badge } from '@/components/shared/Badge';
import { studentsApi } from '@/lib/api';
import { getInitials } from '@/lib/formatters';
import type { StudentListItem } from '@/types/student';

// Mock: a teacher with no class assigned would have class_id = null from useAuth.
// For now we simulate having a class assigned.
const TEACHER_CLASS_ASSIGNED = true;
const CLASS_NAME = 'JSS 3A';

function StudentNameCell({ row }: { row: StudentListItem }) {
  const fullName = `${row.first_name} ${row.last_name}`;
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-full bg-[var(--color-gold)]/15 flex items-center justify-center flex-shrink-0">
        <span className="text-[10px] font-bold text-[var(--color-gold)]">
          {getInitials(fullName)}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{fullName}</p>
        <p className="text-[11px] text-[var(--color-text-muted)] font-mono">{row.admission_number}</p>
      </div>
    </div>
  );
}

function NoClassAssignedState() {
  return (
    <div className="card-shell">
      <div className="card-core p-16 flex flex-col items-center gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-amber-50 ring-1 ring-amber-100 flex items-center justify-center">
          <GraduationCap className="w-7 h-7 text-amber-500" strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            No class assigned yet
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 max-w-xs">
            You haven't been assigned to a class yet. Contact your admin to get a class assignment.
          </p>
        </div>
        <div className="mt-2 px-4 py-2 rounded-lg bg-amber-50 ring-1 ring-amber-200 text-xs font-medium text-amber-700">
          Reach out to your school administrator
        </div>
      </div>
    </div>
  );
}

export default function MyClassPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['my-class-students', { page, search, per_page: 25 }],
    queryFn: () =>
      studentsApi.list({ page, per_page: 25, search: search || undefined, is_active: true }).then((r) => r.data),
    staleTime: 60_000,
    retry: 1,
    enabled: TEACHER_CLASS_ASSIGNED,
  });

  if (!TEACHER_CLASS_ASSIGNED) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="My Class"
          description="Students assigned to your class"
        />
        <NoClassAssignedState />
      </div>
    );
  }

  const columns: Column<StudentListItem>[] = [
    {
      key: 'first_name',
      header: 'Student',
      sortable: true,
      render: (_, row) => <StudentNameCell row={row} />,
    },
    {
      key: 'gender',
      header: 'Gender',
      render: (v) => (
        <span className="text-sm text-[var(--color-text-secondary)] capitalize">{String(v)}</span>
      ),
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
      key: 'is_active',
      header: 'Status',
      render: (v) => (
        <Badge variant={v ? 'success' : 'danger'} dot>
          {v ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'id',
      header: '',
      className: 'w-20',
      render: (_, row) => (
        <Link
          href={`/dashboard/staff/students/${row.id}`}
          className={clsx(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer',
            'text-[var(--color-navy)] bg-[var(--color-navy)]/8 hover:bg-[var(--color-navy)]/14',
            'transition-colors duration-150',
          )}
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
        title={CLASS_NAME}
        description="Students enrolled in your class"
      />

      <DataTable
        columns={columns}
        data={(data?.items ?? []) as unknown as StudentListItem[]}
        rowKey="id"
        isLoading={isLoading}
        totalCount={data?.total ?? 0}
        page={page}
        perPage={25}
        onPageChange={setPage}
        onSearch={(q) => { setSearch(q); setPage(1); }}
        searchPlaceholder="Search by name or admission no…"
        emptyTitle="No students found"
        emptyDescription="No students are currently enrolled in your class."
      />
    </div>
  );
}
