'use client';

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';

import { useAuth } from '@/hooks/useAuth';
import { StaffSidebar } from './StaffSidebar';
import { DashboardHeader } from './DashboardHeader';

interface StaffShellProps {
  children: ReactNode;
}

export function StaffShell({ children }: StaffShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated, role, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (role === 'super_admin') { router.replace('/dashboard/super-admin'); return; }
    if (role === 'admin') { router.replace('/dashboard/admin'); return; }
  }, [isAuthenticated, role, isLoading, router]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  if (isLoading || !isAuthenticated || role !== 'teacher') {
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
        <StaffSidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        />
      </div>

      {/* Mobile sidebar */}
      <div className="lg:hidden">
        <div
          className={clsx(
            'fixed inset-0 z-overlay bg-black/40 transition-opacity duration-300',
            mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
          )}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
        <div
          className={clsx(
            'fixed inset-y-0 left-0 z-nav transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <StaffSidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
        </div>
      </div>

      <div
        className={clsx(
          'flex flex-col min-h-[100dvh]',
          'transition-[padding-left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
          collapsed ? 'lg:pl-[60px]' : 'lg:pl-[260px]',
        )}
      >
        <DashboardHeader onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
