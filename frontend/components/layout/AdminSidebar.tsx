'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  UserCircle,
  CreditCard,
  Megaphone,
  BookOpen,
  ClipboardList,
  GraduationCap,
  FileBarChart,
  UserPlus,
  Upload,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { LucideIcon } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { getInitials } from '@/lib/formatters';
import { authApi } from '@/lib/api';

interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  exact?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'OVERVIEW',
    items: [
      { href: '/dashboard/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
    ],
  },
  {
    label: 'STUDENTS',
    items: [
      { href: '/dashboard/admin/students', icon: Users, label: 'All Students', exact: true },
      { href: '/dashboard/admin/students/new', icon: UserPlus, label: 'Add Student', exact: true },
      { href: '/dashboard/admin/students/bulk-upload', icon: Upload, label: 'Bulk Upload', exact: true },
    ],
  },
  {
    label: 'PARENTS',
    items: [
      { href: '/dashboard/admin/parents', icon: UserCircle, label: 'Parent Directory' },
    ],
  },
  {
    label: 'ACADEMICS',
    items: [
      { href: '/dashboard/admin/classes', icon: BookOpen, label: 'Classes' },
    ],
  },
  {
    label: 'ATTENDANCE',
    items: [
      { href: '/dashboard/admin/attendance', icon: ClipboardList, label: 'Attendance Report' },
    ],
  },
  {
    label: 'FINANCE',
    items: [
      { href: '/dashboard/admin/finance', icon: CreditCard, label: 'Payments', exact: true },
      { href: '/dashboard/admin/finance/debtors', icon: AlertTriangle, label: 'Debtors' },
    ],
  },
  {
    label: 'RESULTS',
    items: [
      { href: '/dashboard/admin/results', icon: FileBarChart, label: 'Report Cards' },
    ],
  },
  {
    label: 'COMMUNICATION',
    items: [
      { href: '/dashboard/admin/communication', icon: Megaphone, label: 'Announcements' },
    ],
  },
];

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onClose?: () => void;
}

export function AdminSidebar({ collapsed, onToggle, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const { user, schoolName, logout } = useAuth();

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* fire and forget */ }
    logout();
    window.location.href = '/login';
  };

  return (
    <aside
      className={clsx(
        'fixed inset-y-0 left-0 z-nav flex flex-col',
        'bg-[var(--color-navy)]',
        'shadow-[2px_0_20px_rgba(0,0,0,0.18)]',
        'transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
        collapsed ? 'w-[60px]' : 'w-[260px]',
      )}
    >
      {/* Logo */}
      <div
        className={clsx(
          'flex items-center gap-3 flex-shrink-0 border-b border-white/[0.06]',
          collapsed ? 'justify-center px-0 py-[18px]' : 'px-5 py-[18px]',
        )}
      >
        <div className="w-8 h-8 rounded-lg bg-[var(--color-gold)] flex items-center justify-center flex-shrink-0">
          <GraduationCap className="w-[18px] h-[18px] text-[var(--color-navy)]" strokeWidth={2} />
        </div>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="text-sm font-bold text-white tracking-tight font-display leading-none">
                EduMag NG
              </p>
              <p className="text-[11px] text-[var(--color-gold)] mt-0.5 truncate leading-tight opacity-90">
                {schoolName ?? 'Your School'}
              </p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="flex-shrink-0 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors duration-150"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 overflow-y-auto overflow-x-hidden py-2"
        style={{ scrollbarWidth: 'none' }}
        aria-label="Sidebar navigation"
      >
        {NAV_SECTIONS.map((section) => (
          <div
            key={section.label}
            className={clsx('mb-0.5', collapsed ? 'px-[9px]' : 'px-3')}
          >
            {!collapsed && (
              <p className="px-2 pt-3 pb-1 text-[10px] font-semibold tracking-[0.14em] text-white/30 uppercase select-none">
                {section.label}
              </p>
            )}
            {collapsed && <div className="h-2" />}

            {section.items.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  title={collapsed ? item.label : undefined}
                  aria-current={active ? 'page' : undefined}
                  className={clsx(
                    'flex items-center rounded-lg text-sm font-medium mb-0.5',
                    'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
                    'cursor-pointer select-none',
                    collapsed
                      ? 'justify-center py-2.5 px-0'
                      : 'gap-3 py-2.5',
                    active
                      ? collapsed
                        ? 'bg-[var(--color-navy-light)] text-white'
                        : 'bg-[var(--color-navy-light)] text-white border-l-[3px] border-[var(--color-gold)] pl-[calc(0.75rem-3px)] pr-3'
                      : collapsed
                        ? 'text-white/55 hover:bg-white/[0.07] hover:text-white/90'
                        : 'text-white/55 hover:bg-white/[0.07] hover:text-white/90 px-3 border-l-[3px] border-transparent',
                  )}
                >
                  <item.icon
                    className={clsx(
                      'w-[17px] h-[17px] flex-shrink-0',
                      active ? 'text-[var(--color-gold)]' : '',
                    )}
                    strokeWidth={1.5}
                  />
                  {!collapsed && (
                    <span className="truncate leading-none">{item.label}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className={clsx(
          'flex-shrink-0 flex items-center gap-2 cursor-pointer',
          'border-t border-white/[0.06] text-white/35 hover:text-white/70',
          'transition-colors duration-200',
          collapsed ? 'justify-center py-3' : 'px-5 py-3',
        )}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
        ) : (
          <>
            <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
            <span className="text-xs">Collapse</span>
          </>
        )}
      </button>

      {/* User section */}
      <div
        className={clsx(
          'flex-shrink-0 border-t border-white/[0.06]',
          collapsed ? 'px-[9px] py-3' : 'px-3 py-3',
        )}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[var(--color-gold)]/20 flex items-center justify-center">
              <span className="text-[11px] font-bold text-[var(--color-gold)] leading-none">
                {getInitials(user?.name ?? 'U')}
              </span>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-1.5 rounded-lg cursor-pointer text-white/35 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
              aria-label="Logout"
            >
              <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[var(--color-gold)]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-bold text-[var(--color-gold)] leading-none">
                {getInitials(user?.name ?? 'U')}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate leading-none">
                {user?.name ?? '—'}
              </p>
              <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/10 text-white/60 leading-none">
                Admin
              </span>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-1.5 rounded-lg cursor-pointer text-white/35 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 flex-shrink-0"
              aria-label="Logout"
            >
              <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
