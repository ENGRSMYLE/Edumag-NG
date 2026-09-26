'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';

import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/lib/api';
import { getRoleHome } from '@/lib/roleRouting';
import { useAuthStore } from '@/store/authStore';
import { ParentHeader } from './ParentHeader';
import { ParentSidebar } from './ParentSidebar';

export function ParentShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated, role, isLoading, hasHydrated, logout } = useAuth();
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();
  // Always verify the server session after hydration. Installed PWAs can open
  // in a fresh browser session where sessionStorage is empty while the secure
  // authentication cookies are still valid.
  const sessionEnabled = hasHydrated && !isLoading;

  const session = useQuery({
    queryKey: ['me'],
    queryFn: ({ signal }) => authApi.me({ signal, timeout: 15_000 }).then((response) => { setUser(response.data); return response.data; }),
    enabled: sessionEnabled,
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (!hasHydrated || isLoading || session.isPending || session.isError) return;
    if (!isAuthenticated) { router.replace('/login'); return; }
    if (role !== 'parent') router.replace(getRoleHome(role) ?? '/login');
  }, [hasHydrated, isAuthenticated, isLoading, role, router, session.isError, session.isPending]);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1024) setMobileOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  if (sessionEnabled && session.isError) return <div className="min-h-[100dvh] flex items-center justify-center bg-[var(--color-cream)] p-4"><div className="card-shell w-full max-w-md"><div className="card-core p-6 text-center"><h1 className="font-display text-xl font-semibold text-[var(--color-text-primary)]">We could not load your parent session</h1><p className="mt-2 text-sm text-[var(--color-text-muted)]">The server did not complete the session check. Check your connection and try again, or sign in again.</p><div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row"><button type="button" onClick={() => session.refetch()} disabled={session.isFetching} className="rounded-lg bg-[var(--color-navy)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{session.isFetching ? 'Trying again…' : 'Try again'}</button><button type="button" onClick={() => { logout(); router.replace('/login'); }} className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-semibold">Sign in again</button></div></div></div></div>;

  const waitingForAuth = !hasHydrated || isLoading || !isAuthenticated || role !== 'parent';
  const waitingForSession = sessionEnabled && session.isPending;
  if (waitingForAuth || waitingForSession) return <div className="min-h-[100dvh] flex items-center justify-center bg-[var(--color-cream)]"><div className="w-7 h-7 rounded-full border-2 border-[var(--color-navy)] border-t-transparent animate-spin" /></div>;

  return <div className="min-h-[100dvh] bg-[var(--color-cream)]">
    <div className="hidden lg:block"><ParentSidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} /></div>
    <div className="lg:hidden">
      <div className={clsx('fixed inset-0 z-overlay bg-black/40 transition-opacity duration-300', mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none')} onClick={() => setMobileOpen(false)} aria-hidden="true" />
      <div className={clsx('fixed inset-y-0 left-0 z-modal w-[260px] transition-transform duration-300', mobileOpen ? 'translate-x-0' : '-translate-x-full')}><ParentSidebar collapsed={false} onToggle={() => setMobileOpen(false)} onClose={() => setMobileOpen(false)} /></div>
    </div>
    <div className={clsx('flex flex-col min-h-[100dvh] transition-[padding-left] duration-300', collapsed ? 'lg:pl-[60px]' : 'lg:pl-[260px]')}>
      <ParentHeader onMenuClick={() => setMobileOpen(true)} />
      <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full">{children}</main>
    </div>
  </div>;
}
