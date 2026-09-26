'use client';

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';

import { useAuth } from '@/hooks/useAuth';
import { SuperAdminSidebar } from './SuperAdminSidebar';
import { DashboardHeader } from './DashboardHeader';
import { getRoleHome } from '@/lib/roleRouting';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated, role, isLoading, hasHydrated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!hasHydrated || isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (role !== 'super_admin') {
      router.replace(getRoleHome(role) ?? '/login');
    }
  }, [hasHydrated, isAuthenticated, role, isLoading, router]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useBodyScrollLock(mobileOpen);

  if (!hasHydrated || isLoading || !isAuthenticated || role !== 'super_admin') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[var(--color-cream)]">
        <div className="w-7 h-7 rounded-full border-2 border-[var(--color-navy)] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--color-cream)]">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <SuperAdminSidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        />
      </div>

      {/* Mobile sidebar — always in DOM, slide via transform */}
      <div className="lg:hidden">
        {/* Backdrop */}
        <div
          className={clsx(
            'fixed inset-0 z-overlay bg-black/40 transition-opacity duration-300',
            mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
          )}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
        {/* Drawer */}
        <div
          className={clsx(
            'fixed inset-y-0 left-0 z-modal w-[min(260px,calc(100vw-2rem))] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <SuperAdminSidebar collapsed={false} onToggle={() => setMobileOpen(false)} onClose={() => setMobileOpen(false)} />
        </div>
      </div>

      {/* Page area shifts right on desktop to account for sidebar */}
      <div
        className={clsx(
          'flex min-w-0 flex-col min-h-[100dvh]',
          'transition-[padding-left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
          collapsed ? 'lg:pl-[60px]' : 'lg:pl-[260px]',
        )}
      >
        <DashboardHeader onMenuClick={() => setMobileOpen(true)} />
        <main className="w-full min-w-0 max-w-[1600px] flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
