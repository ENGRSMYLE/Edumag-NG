'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap } from 'lucide-react';
import { ChildSelector } from '@/components/parent/ChildSelector';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { parentPortalApi } from '@/lib/api';
import { formatTerm, getCurrentSession } from '@/lib/formatters';

function Content() {
  const selectedId = useSearchParams().get('child') ?? undefined;
  const [session, setSession] = useState(getCurrentSession()); const [term, setTerm] = useState('');
  const childrenQuery = useQuery({ queryKey: ['parent', 'children'], queryFn: () => parentPortalApi.children().then(r => r.data), staleTime: 60_000 });
  const children = childrenQuery.data?.items ?? []; const child = children.find(c => c.id === selectedId) ?? (children.length === 1 ? children[0] : undefined);
  const results = useQuery({ queryKey: ['parent', 'results', child?.id, { session, term }], queryFn: () => parentPortalApi.results(child!.id, { per_page: 100, academic_session: session || undefined, term: term || undefined }).then(r => r.data), enabled: Boolean(child?.permissions.results) });
  return <div><PageHeader title="Results" description="Only school-approved academic results are shown." /><ChildSelector children={children} selectedChildId={child?.id} disabled={!children.length} />
    {children.length > 1 && !child && <EmptyState icon={GraduationCap} title="Select a child" />}{child && !child.permissions.results && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Results access is not enabled for this child.</p>}
    {child?.permissions.results && <><div className="card-shell mb-5"><div className="card-core flex gap-3 p-4"><label className="flex-1 text-xs font-semibold">Session<input value={session} onChange={e => setSession(e.target.value)} className="input-base mt-1 w-full" /></label><label className="flex-1 text-xs font-semibold">Term<select value={term} onChange={e => setTerm(e.target.value)} className="input-base mt-1 w-full"><option value="">All terms</option><option value="first">First Term</option><option value="second">Second Term</option><option value="third">Third Term</option></select></label></div></div>
      <div className="card-shell"><div className="card-core overflow-x-auto">{results.isLoading ? <p className="p-8 text-center text-sm">Loading results…</p> : results.isError ? <p className="p-8 text-center text-sm text-red-600">Results could not be loaded.</p> : results.data?.items.length ? <table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-4">Subject</th><th className="p-4">Term</th><th className="p-4">CA</th><th className="p-4">Exam</th><th className="p-4">Total</th><th className="p-4">Grade</th></tr></thead><tbody>{results.data.items.map(item => <tr key={item.id} className="border-b border-[var(--color-border)]"><td className="p-4 font-medium">{item.subject}</td><td className="p-4">{formatTerm(item.term)}</td><td className="p-4">{item.ca_score ?? '—'}</td><td className="p-4">{item.exam_score ?? '—'}</td><td className="p-4 font-semibold">{item.total_score ?? '—'}</td><td className="p-4">{item.grade ?? '—'}</td></tr>)}</tbody></table> : <EmptyState icon={GraduationCap} title="No approved results" description="No approved results match these filters." />}</div></div></>}
  </div>;
}
export default function ResultsPage() { return <Suspense><Content /></Suspense>; }
