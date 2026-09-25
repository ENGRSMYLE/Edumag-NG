'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import { ChildSelector } from '@/components/parent/ChildSelector';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { parentPortalApi } from '@/lib/api';
import { formatDateTime, formatNaira, formatTerm } from '@/lib/formatters';
function Content() {
 const selectedId = useSearchParams().get('child') ?? undefined; const cq = useQuery({ queryKey: ['parent', 'children'], queryFn: () => parentPortalApi.children().then(r => r.data), staleTime: 60_000 }); const children = cq.data?.items ?? []; const child = children.find(c => c.id === selectedId) ?? (children.length === 1 ? children[0] : undefined); const query = useQuery({ queryKey: ['parent', 'finance', child?.id], queryFn: () => parentPortalApi.finance(child!.id, { per_page: 100 }).then(r => r.data), enabled: Boolean(child?.permissions.finance) });
 return <div><PageHeader title="Finance" description="Payment history for an authorized child." /><ChildSelector children={children} selectedChildId={child?.id} disabled={!children.length} />{children.length > 1 && !child && <EmptyState icon={Wallet} title="Select a child" />}{child && !child.permissions.finance && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Finance access is not enabled for this child.</p>}{child?.permissions.finance && <div className="card-shell"><div className="card-core overflow-x-auto">{query.isLoading ? <p className="p-8 text-center">Loading payments…</p> : query.isError ? <p className="p-8 text-center text-red-600">Payments could not be loaded.</p> : query.data?.items.length ? <table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-4">Date</th><th className="p-4">Type</th><th className="p-4">Term</th><th className="p-4">Amount</th><th className="p-4">Status</th></tr></thead><tbody>{query.data.items.map(item => <tr key={item.id} className="border-b"><td className="p-4">{formatDateTime(item.paid_at ?? item.created_at)}</td><td className="p-4 capitalize">{item.payment_type.replaceAll('_', ' ')}</td><td className="p-4">{formatTerm(item.term)}</td><td className="p-4 font-semibold">{formatNaira(item.amount_kobo)}</td><td className="p-4 capitalize">{item.status}</td></tr>)}</tbody></table> : <EmptyState icon={Wallet} title="No payment history" />}</div></div>}</div>;
}
export default function FinancePage() { return <Suspense><Content /></Suspense>; }
