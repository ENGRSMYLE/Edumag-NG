'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { BookOpenCheck } from 'lucide-react';
import { ChildSelector } from '@/components/parent/ChildSelector';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { parentPortalApi } from '@/lib/api';
import { formatDate } from '@/lib/formatters';
function Content() {
  const selectedId = useSearchParams().get('child') ?? undefined;
  const cq = useQuery({ queryKey: ['parent', 'children'], queryFn: () => parentPortalApi.children().then(r => r.data), staleTime: 60_000 });
  const children = cq.data?.items ?? []; const child = children.find(c => c.id === selectedId) ?? (children.length === 1 ? children[0] : undefined);
  const query = useQuery({ queryKey: ['parent', 'assignments', child?.id], queryFn: () => parentPortalApi.assignments(child!.id, { per_page: 100 }).then(r => r.data), enabled: Boolean(child?.permissions.assignments) });
  return <div><PageHeader title="Assignments" description="Current class assignments and submission status." /><ChildSelector children={children} selectedChildId={child?.id} disabled={!children.length} />{children.length > 1 && !child && <EmptyState icon={BookOpenCheck} title="Select a child" />}{child && !child.permissions.assignments && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Assignment access is not enabled for this child.</p>}{child?.permissions.assignments && <div className="grid gap-4 md:grid-cols-2">{query.isLoading ? <p>Loading assignments…</p> : query.isError ? <p className="text-red-600">Assignments could not be loaded.</p> : query.data?.items.length ? query.data.items.map(item => <article key={item.id} className="card-shell"><div className="card-core p-5"><div className="flex justify-between gap-3"><div><p className="text-xs font-semibold text-[var(--color-gold)]">{item.subject}</p><h2 className="mt-1 font-semibold">{item.title}</h2></div><span className={`h-fit rounded-full px-2.5 py-1 text-xs ${item.submitted_at ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{item.submitted_at ? 'Submitted' : 'Not submitted'}</span></div><p className="mt-3 text-sm text-[var(--color-text-muted)]">Due {formatDate(item.due_date)}</p>{item.description && <p className="mt-3 text-sm">{item.description}</p>}</div></article>) : <EmptyState icon={BookOpenCheck} title="No assignments" />}</div>}</div>;
}
export default function AssignmentsPage() { return <Suspense><Content /></Suspense>; }
