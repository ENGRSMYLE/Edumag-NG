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
  const { isAuthenticated, role, isLoading, hasHydrated } = useAuth();
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();

  const session = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.me().then((response) => { setUser(response.data); return response.data; }),
    enabled: hasHydrated && isAuthenticated && role === 'parent',
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (!hasHydrated || isLoading) return;
    if (!isAuthenticated) { router.replace('/login'); return; }
    if (role !== 'parent') router.replace(getRoleHome(role) ?? '/login');
  }, [hasHydrated, isAuthenticated, isLoading, role, router]);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1024) setMobileOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const waiting = !hasHydrated || isLoading || !isAuthenticated || role !== 'parent' || session.isPending;
  if (waiting || session.isError) return <div className="min-h-[100dvh] flex items-center justify-center bg-[var(--color-cream)]"><div className="w-7 h-7 rounded-full border-2 border-[var(--color-navy)] border-t-transparent animate-spin" /></div>;

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
