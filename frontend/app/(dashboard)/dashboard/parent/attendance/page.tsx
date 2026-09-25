'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck } from 'lucide-react';
import { ChildSelector } from '@/components/parent/ChildSelector';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { parentPortalApi } from '@/lib/api';
import { formatDate } from '@/lib/formatters';

const STYLE = { present: 'bg-emerald-50 text-emerald-700', absent: 'bg-red-50 text-red-700', late: 'bg-amber-50 text-amber-700', excused: 'bg-blue-50 text-blue-700' };
function Content() {
  const selectedId = useSearchParams().get('child') ?? undefined;
  const [start, setStart] = useState(''); const [end, setEnd] = useState('');
  const childrenQuery = useQuery({ queryKey: ['parent', 'children'], queryFn: () => parentPortalApi.children().then(r => r.data), staleTime: 60_000 });
  const children = childrenQuery.data?.items ?? [];
  const child = children.find(c => c.id === selectedId) ?? (children.length === 1 ? children[0] : undefined);
  const query = useQuery({ queryKey: ['parent', 'attendance', child?.id, { start, end }], queryFn: () => parentPortalApi.attendance(child!.id, { per_page: 50, start_date: start || undefined, end_date: end || undefined }).then(r => r.data), enabled: Boolean(child?.permissions.attendance) });
  return <div><PageHeader title="Attendance" description="Review attendance history for an authorized child." /><ChildSelector children={children} selectedChildId={child?.id} disabled={!children.length} />
    {children.length > 1 && !child && <EmptyState icon={CalendarCheck} title="Select a child" description="Choose a child to view attendance." />}
    {child && !child.permissions.attendance && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Attendance access is not enabled for this child.</div>}
    {child?.permissions.attendance && <><div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Attendance', `${query.data?.attendance_rate ?? 0}%`], ['Present', query.data?.present_count ?? 0], ['Absent', query.data?.absent_count ?? 0], ['Late', query.data?.late_count ?? 0]].map(([label, value]) => <div key={label} className="rounded-xl border border-[var(--color-border)] bg-white p-4"><p className="text-xs text-[var(--color-text-muted)]">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}</div>
      <div className="card-shell mb-5"><div className="card-core flex flex-col gap-3 p-4 sm:flex-row sm:items-end">{[['From', start, setStart], ['To', end, setEnd]].map(([label, value, setter]) => <label key={label as string} className="flex-1 text-xs font-semibold">{label as string}<input type="date" value={value as string} onChange={e => (setter as (v: string) => void)(e.target.value)} className="input-base mt-1 w-full" /></label>)}<button onClick={() => { setStart(''); setEnd(''); }} className="h-10 rounded-lg border border-[var(--color-border)] px-4 text-sm">Clear</button></div></div>
      <div className="card-shell"><div className="card-core overflow-hidden">{query.isLoading ? <p className="p-8 text-center text-sm">Loading attendance…</p> : query.isError ? <p className="p-8 text-center text-sm text-red-600">Attendance could not be loaded.</p> : query.data?.items.length ? <div className="divide-y divide-[var(--color-border)]">{query.data.items.map(item => <div key={item.id} className="flex items-center p-4"><div className="flex-1"><p className="text-sm font-medium">{formatDate(item.date)}</p>{item.note && <p className="text-xs text-[var(--color-text-muted)]">{item.note}</p>}</div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STYLE[item.status]}`}>{item.status}</span></div>)}</div> : <EmptyState icon={CalendarCheck} title="No attendance records" description="No records match the selected dates." />}</div></div></>}
  </div>;
}
export default function AttendancePage() { return <Suspense><Content /></Suspense>; }
