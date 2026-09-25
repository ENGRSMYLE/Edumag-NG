'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { UsersRound } from 'lucide-react';
import type { ParentChild } from '@/types/parentPortal';

export function ChildSelector({ children, selectedChildId, disabled }: { children: ParentChild[]; selectedChildId?: string; disabled?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectChild = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') params.delete('child'); else params.set('child', value);
    router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false });
  };
  return <div className="mb-5" aria-label="Select child">
    <label htmlFor="parent-child-selector" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)] lg:hidden">Viewing</label>
    <select id="parent-child-selector" value={selectedChildId ?? 'all'} onChange={(event) => selectChild(event.target.value)} disabled={disabled} className="input-base w-full lg:hidden">
      <option value="all">All Children</option>
      {children.map((child) => <option key={child.id} value={child.id}>{child.first_name} {child.last_name}</option>)}
    </select>
    <div className="hidden lg:flex items-center gap-2 overflow-x-auto pb-1" role="group" aria-label="Choose dashboard child">
      <button onClick={() => selectChild('all')} disabled={disabled} aria-pressed={!selectedChildId} className={`flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium ${!selectedChildId ? 'border-[var(--color-navy)] bg-[var(--color-navy)] text-white' : 'border-[var(--color-border)] bg-white text-[var(--color-text-secondary)]'}`}><UsersRound className="h-4 w-4" />All Children</button>
      {children.map((child) => <button key={child.id} onClick={() => selectChild(child.id)} disabled={disabled} aria-pressed={selectedChildId === child.id} className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium ${selectedChildId === child.id ? 'border-[var(--color-navy)] bg-[var(--color-navy)] text-white' : 'border-[var(--color-border)] bg-white text-[var(--color-text-secondary)]'}`}>{child.first_name} {child.last_name}</button>)}
    </div>
  </div>;
}
