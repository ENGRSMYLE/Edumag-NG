'use client';

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';

import { useAuth } from '@/hooks/useAuth';
import { AdminSidebar } from './AdminSidebar';
import { DashboardHeader } from './DashboardHeader';

interface AdminShellProps {
  children: ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
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
    if (role === 'teacher') { router.replace('/dashboard/staff'); return; }
  }, [isAuthenticated, role, isLoading, router]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (isLoading || !isAuthenticated || role !== 'admin') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[var(--color-cream)]">
        <div className="w-7 h-7 rounded-full border-2 border-[var(--color-navy)] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--color-cream)]">
      <div className="hidden lg:block">
        <AdminSidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        />
      </div>

      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-overlay bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="lg:hidden">
            <AdminSidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
          </div>
        </>
      )}

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
