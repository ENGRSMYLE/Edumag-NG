'use client';

import Link from 'next/link';
import { Suspense, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { BookOpenCheck, CalendarCheck, GraduationCap, Mail, Megaphone, UsersRound } from 'lucide-react';
import { ChildSelector } from '@/components/parent/ChildSelector';
import { PageHeader } from '@/components/shared/PageHeader';
import { SkeletonCard } from '@/components/shared/LoadingSkeleton';
import { StatCard } from '@/components/shared/StatCard';
import { useAnnouncements, useUnreadCount } from '@/hooks/useCommunication';
import { parentPortalApi } from '@/lib/api';

function ErrorBanner({ message, retry }: { message: string; retry: () => void }) {
  return <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{message} <button onClick={retry} className="font-semibold underline">Try again</button></div>;
}

function DashboardContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedChildId = searchParams.get('child') ?? undefined;
  const childrenQuery = useQuery({
    queryKey: ['parent', 'children'],
    queryFn: () => parentPortalApi.children().then((response) => response.data),
    staleTime: 60_000,
  });
  const children = childrenQuery.data?.items ?? [];
  const selectedChild = requestedChildId ? children.find((child) => child.id === requestedChildId) : undefined;

  useEffect(() => {
    if (!childrenQuery.isSuccess || !requestedChildId || selectedChild) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('child');
    router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false });
  }, [childrenQuery.isSuccess, pathname, requestedChildId, router, searchParams, selectedChild]);

  const dashboardQuery = useQuery({
    queryKey: ['parent', 'dashboard', selectedChild?.id ?? 'all'],
    queryFn: () => parentPortalApi.dashboard(selectedChild?.id).then((response) => response.data),
    enabled: childrenQuery.isSuccess && (!requestedChildId || Boolean(selectedChild)),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const announcements = useAnnouncements({ page: 1, per_page: 3 });
  const unread = useUnreadCount();
  const data = dashboardQuery.data;
  const loading = childrenQuery.isLoading || dashboardQuery.isLoading;
  const hiddenAreas = selectedChild ? [
    !selectedChild.permissions.attendance && 'attendance',
    !selectedChild.permissions.results && 'results',
    !selectedChild.permissions.assignments && 'assignments',
  ].filter(Boolean) as string[] : [];

  return <div>
    <PageHeader title="Parent Dashboard" description={selectedChild ? `Viewing ${selectedChild.first_name} ${selectedChild.last_name}` : 'An overview of all your linked children.'} />
    {childrenQuery.isError && <ErrorBanner message="We could not load your linked children." retry={() => childrenQuery.refetch()} />}
    {!childrenQuery.isError && <ChildSelector children={children} selectedChildId={selectedChild?.id} disabled={childrenQuery.isLoading || children.length === 0} />}
    {dashboardQuery.isError && <ErrorBanner message="We could not load the selected dashboard." retry={() => dashboardQuery.refetch()} />}
    {hiddenAreas.length > 0 && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Your access to {hiddenAreas.join(', ')} information is not enabled for this child.</div>}
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {loading ? Array.from({ length: 6 }).map((_, index) => <SkeletonCard key={index} />) : <>
        <StatCard title={selectedChild ? 'Selected Child' : 'Linked Children'} value={data?.child_count ?? 0} icon={UsersRound} />
        <StatCard title="Attendance" value={`${data?.attendance_rate ?? 0}%`} icon={CalendarCheck} variant="success" />
        <StatCard title="Approved Results" value={data?.approved_results ?? 0} icon={GraduationCap} variant="info" />
        <StatCard title="Upcoming Assignments" value={data?.upcoming_assignments ?? 0} icon={BookOpenCheck} variant="gold" />
        <StatCard title="Announcements" value={announcements.data?.total ?? 0} icon={Megaphone} />
        <StatCard title="Unread Messages" value={unread.data?.count ?? 0} icon={Mail} variant="info" />
      </>}
    </div>
    <section className="card-shell mt-5"><div className="card-core p-5">
      <div className="flex items-center justify-between mb-4"><h2 className="text-sm font-semibold font-display">{selectedChild ? 'Child Details' : 'My Children'}</h2><Link href="/dashboard/parent/children" className="text-xs font-semibold text-[var(--color-navy)] hover:underline">View all</Link></div>
      {!loading && children.length === 0 ? <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">No active child relationships are linked to this account.</p> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{(selectedChild ? [selectedChild] : children).map((child) => <div key={child.id} className="rounded-xl border border-[var(--color-border)] bg-white p-4"><p className="font-semibold text-sm text-[var(--color-text-primary)]">{child.first_name} {child.last_name}</p><p className="mt-1 text-xs text-[var(--color-text-muted)]">{child.class_name ?? 'Class not assigned'} · {child.admission_number}</p></div>)}</div>}
    </div></section>
  </div>;
}

export default function ParentDashboardPage() {
  return <Suspense fallback={<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, index) => <SkeletonCard key={index} />)}</div>}><DashboardContent /></Suspense>;
}
