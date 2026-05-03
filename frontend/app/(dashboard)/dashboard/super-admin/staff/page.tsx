'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Badge } from '@/components/shared/Badge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { InviteUserModal } from '@/components/shared/InviteUserModal';
import { usersApi } from '@/lib/api';
import { getInitials, formatDate } from '@/lib/formatters';
import type { StaffListItem } from '@/types/staff';
import type { UserRole } from '@/types/auth';

type FilterTab = 'all' | 'admin' | 'teacher' | 'inactive';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'admin',    label: 'Admins' },
  { key: 'teacher',  label: 'Teachers' },
  { key: 'inactive', label: 'Inactive' },
];

function InitialsAvatar({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-full bg-[var(--color-navy)]/10 flex items-center justify-center flex-shrink-0">
        <span className="text-[10px] font-bold text-[var(--color-navy)]">
          {getInitials(name)}
        </span>
      </div>
      <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
        {name}
      </span>
    </div>
  );
}

export default function StaffPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<'admin' | 'teacher'>('teacher');
  const [deactivateId, setDeactivateId] = useState<string | null>(null);

  const queryParams = {
    page,
    per_page: 20,
    search: search || undefined,
    role: filter === 'admin' ? ('admin' as UserRole) : filter === 'teacher' ? ('teacher' as UserRole) : undefined,
    is_active: filter === 'inactive' ? false : undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['staff', queryParams],
    queryFn: () => usersApi.list(queryParams).then((r) => r.data),
    staleTime: 30_000,
  });

  const { mutate: deactivate, isPending: isDeactivating } = useMutation({
    mutationFn: (id: string) => usersApi.deactivate(id),
    onSuccess: () => {
      toast.success('Staff member deactivated');
      setDeactivateId(null);
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: () => toast.error('Failed to deactivate'),
  });

  const { mutate: resendInvite, isPending: isResending } = useMutation({
    mutationFn: (id: string) => usersApi.resendInvite(id),
    onSuccess: () => toast.success('Invitation resent'),
    onError: () => toast.error('Failed to resend invitation'),
  });

  const columns: Column<StaffListItem>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (_, row) => <InitialsAvatar name={row.name} />,
    },
    {
      key: 'email',
      header: 'Email',
      render: (v) => (
        <span className="text-sm text-[var(--color-text-secondary)]">{String(v)}</span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (v) => (
        <Badge variant={v === 'admin' ? 'info' : 'neutral'}>
          {v === 'admin' ? 'Admin' : 'Teacher'}
        </Badge>
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
      key: 'created_at',
      header: 'Joined',
      sortable: true,
      render: (v) => (
        <span className="text-sm text-[var(--color-text-muted)] font-mono tabular-nums">
          {formatDate(String(v))}
        </span>
      ),
    },
    {
      key: 'user_id',
      header: 'Actions',
      className: 'w-[160px]',
      render: (_, row) => (
        <div className="flex items-center gap-1.5">
          {row.is_active && (
            <button
              onClick={() => setDeactivateId(row.user_id)}
              className="px-2.5 py-1 rounded-md text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors duration-150 cursor-pointer"
            >
              Deactivate
            </button>
          )}
          {!row.is_active && (
            <button
              onClick={() => resendInvite(row.user_id)}
              disabled={isResending}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface)] hover:bg-[var(--color-border)] transition-colors duration-150 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className="w-3 h-3" strokeWidth={1.5} />
              Resend
            </button>
          )}
        </div>
      ),
    },
  ];

  const openInvite = (role: 'admin' | 'teacher') => {
    setInviteRole(role);
    setInviteOpen(true);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Staff & Admins"
        description="Manage all staff members and administrators"
        actions={
          <>
            <button
              onClick={() => openInvite('admin')}
              className={clsx(
                'flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium cursor-pointer',
                'bg-[var(--color-surface)] text-[var(--color-text-primary)]',
                'border border-[var(--color-border)]',
                'hover:bg-[var(--color-border)] active:scale-[0.98]',
                'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
              )}
            >
              <UserPlus className="w-4 h-4" strokeWidth={1.5} />
              Invite Admin
            </button>
            <button
              onClick={() => openInvite('teacher')}
              className={clsx(
                'flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium cursor-pointer',
                'bg-[var(--color-navy)] text-white',
                'hover:bg-[var(--color-navy-mid)] active:scale-[0.98]',
                'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
              )}
            >
              <UserPlus className="w-4 h-4" strokeWidth={1.5} />
              Invite Teacher
            </button>
          </>
        }
      />

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--color-border)] -mt-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setFilter(tab.key); setPage(1); }}
            className={clsx(
              'px-4 py-2.5 text-sm font-medium cursor-pointer transition-colors duration-150',
              'border-b-2 -mb-px',
              filter === tab.key
                ? 'border-[var(--color-gold)] text-[var(--color-text-primary)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={(data?.items ?? []) as unknown as StaffListItem[]}
        rowKey="user_id"
        isLoading={isLoading}
        totalCount={data?.total ?? 0}
        page={page}
        perPage={20}
        onPageChange={setPage}
        onSearch={(q) => { setSearch(q); setPage(1); }}
        searchPlaceholder="Search by name or email…"
        emptyTitle="No staff members found"
        emptyDescription="Invite an admin or teacher to get started."
      />

      {/* Modals */}
      <InviteUserModal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        defaultRole={inviteRole}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['staff'] })}
      />

      <ConfirmDialog
        isOpen={!!deactivateId}
        onClose={() => setDeactivateId(null)}
        onConfirm={() => deactivateId && deactivate(deactivateId)}
        isLoading={isDeactivating}
        title="Deactivate staff member?"
        description="This will revoke their access immediately. They will no longer be able to log in. You can re-invite them later."
        confirmLabel="Deactivate"
        variant="danger"
      />
    </div>
  );
}
