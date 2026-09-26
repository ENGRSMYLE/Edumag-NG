'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { UsersRound } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { parentPortalApi } from '@/lib/api';

export default function ChildrenPage() {
  const query = useQuery({ queryKey: ['parent', 'children'], queryFn: () => parentPortalApi.children().then(r => r.data), staleTime: 60_000 });
  return <div><PageHeader title="My Children" description="Children linked to your parent account and the information you may access." />
    {query.isLoading ? <p className="py-12 text-center text-sm">Loading children…</p> : query.isError ? <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Children could not be loaded.</p> : !query.data?.items.length ? <EmptyState icon={UsersRound} title="No active children" description="Contact the school if a child should be linked to your account." /> : <div className="grid gap-4 md:grid-cols-2">{query.data.items.map(child => <article key={child.id} className="card-shell"><div className="card-core p-5"><div className="flex gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-navy)]/10 font-bold text-[var(--color-navy)]">{child.first_name[0]}{child.last_name[0]}</div><div><h2 className="font-semibold">{child.first_name} {child.middle_name} {child.last_name}</h2><p className="text-xs text-[var(--color-text-muted)]">{child.admission_number} · {child.class_name ?? 'Class not assigned'}</p></div></div><div className="mt-4 flex flex-wrap gap-2">{Object.entries(child.permissions).filter(([, enabled]) => enabled).map(([name]) => <span key={name} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs capitalize text-emerald-700">{name}</span>)}</div><Link href={`/dashboard/parent?child=${child.id}`} className="mt-4 inline-block text-sm font-semibold text-[var(--color-navy)]">View dashboard →</Link></div></article>)}</div>}
  </div>;
}
