'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  BookOpenCheck, CalendarCheck, ChevronLeft, ChevronRight, GraduationCap,
  LayoutDashboard, LogOut, Mail, UserCircle, UsersRound, Wallet, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { authApi } from '@/lib/api';
import { getInitials } from '@/lib/formatters';
import { useAuth } from '@/hooks/useAuth';

interface NavItem { href: string; label: string; icon: LucideIcon; exact?: boolean }
const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard/parent', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/parent/children', label: 'My Children', icon: UsersRound },
  { href: '/dashboard/parent/attendance', label: 'Attendance', icon: CalendarCheck },
  { href: '/dashboard/parent/results', label: 'Results', icon: GraduationCap },
  { href: '/dashboard/parent/assignments', label: 'Assignments', icon: BookOpenCheck },
  { href: '/dashboard/parent/finance', label: 'Finance', icon: Wallet },
  { href: '/dashboard/parent/communication', label: 'Communication', icon: Mail },
  { href: '/dashboard/parent/profile', label: 'My Profile', icon: UserCircle },
];

interface Props { collapsed: boolean; onToggle: () => void; onClose?: () => void }

export function ParentSidebar({ collapsed, onToggle, onClose }: Props) {
  const pathname = usePathname();
  const { user, schoolName, logout } = useAuth();
  const active = (item: NavItem) => item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* clear local session even if API is unavailable */ }
    logout();
    window.location.href = '/login';
  };

  return (
    <aside className={clsx('fixed inset-y-0 left-0 z-nav flex flex-col bg-[var(--color-navy)] shadow-[2px_0_20px_rgba(0,0,0,0.18)] transition-[width] duration-300', collapsed ? 'w-[60px]' : 'w-[260px]')}>
      <div className={clsx('flex items-center gap-3 border-b border-white/[0.06] py-[18px]', collapsed ? 'justify-center' : 'px-5')}>
        <div className="w-8 h-8 rounded-lg bg-[var(--color-gold)] flex items-center justify-center flex-shrink-0">
          <GraduationCap className="w-[18px] h-[18px] text-[var(--color-navy)]" />
        </div>
        {!collapsed && <><div className="min-w-0 flex-1"><p className="text-sm font-bold text-white font-display">EduMag NG</p><p className="text-[11px] text-[var(--color-gold)] truncate">{schoolName ?? 'Your School'}</p></div>{onClose && <button onClick={onClose} aria-label="Close menu" className="p-1.5 text-white/50 hover:text-white"><X className="w-4 h-4" /></button>}</>}
      </div>
      <nav className={clsx('flex-1 overflow-y-auto py-4', collapsed ? 'px-[9px]' : 'px-3')} aria-label="Parent portal navigation">
        {!collapsed && <p className="px-2 pb-2 text-[10px] font-semibold tracking-[0.14em] text-white/30">PARENT PORTAL</p>}
        {NAV_ITEMS.map((item) => {
          const selected = active(item);
          return <Link key={item.href} href={item.href} onClick={onClose} title={collapsed ? item.label : undefined} aria-current={selected ? 'page' : undefined} className={clsx('flex items-center rounded-lg text-sm font-medium mb-1 transition-all', collapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2.5', selected ? 'bg-[var(--color-navy-light)] text-white' : 'text-white/55 hover:bg-white/[0.07] hover:text-white')}>
            <item.icon className={clsx('w-[17px] h-[17px] flex-shrink-0', selected && 'text-[var(--color-gold)]')} strokeWidth={1.5} />
            {!collapsed && <span>{item.label}</span>}
          </Link>;
        })}
      </nav>
      <button onClick={onToggle} className={clsx('flex items-center border-t border-white/[0.06] text-white/35 hover:text-white/70 py-3', collapsed ? 'justify-center' : 'gap-2 px-5')} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /><span className="text-xs">Collapse</span></>}
      </button>
      <div className={clsx('border-t border-white/[0.06] py-3', collapsed ? 'px-[9px]' : 'px-3')}>
        <div className={clsx('flex items-center', collapsed ? 'flex-col gap-2' : 'gap-2.5')}>
          <div className="w-8 h-8 rounded-full bg-[var(--color-gold)]/20 flex items-center justify-center flex-shrink-0"><span className="text-[11px] font-bold text-[var(--color-gold)]">{getInitials(user?.name ?? 'P')}</span></div>
          {!collapsed && <div className="flex-1 min-w-0"><p className="text-xs font-semibold text-white truncate">{user?.name}</p><span className="text-[10px] text-white/60">Parent</span></div>}
          <button onClick={handleLogout} title="Logout" aria-label="Logout" className="p-1.5 text-white/35 hover:text-red-400"><LogOut className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </aside>
  );
}
