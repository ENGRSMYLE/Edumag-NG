'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Menu, Bell, ChevronRight, LogOut, Settings, Building2, ArrowLeftRight, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

import { useAuth } from '@/hooks/useAuth';
import { getInitials } from '@/lib/formatters';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { SchoolSwitchOverlay } from '@/components/shared/SchoolSwitchOverlay';
import type { SchoolOption, UserRole } from '@/types/auth';

const ROLE_HOME: Record<UserRole, string> = {
  super_admin: '/dashboard/super-admin',
  admin: '/dashboard/admin',
  teacher: '/dashboard/staff',
};

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard/super-admin': 'Dashboard',
  '/dashboard/super-admin/students': 'Students',
  '/dashboard/super-admin/staff': 'Staff & Admins',
  '/dashboard/super-admin/classes': 'Classes',
  '/dashboard/super-admin/finance': 'Payments',
  '/dashboard/super-admin/announcements': 'Announcements',
  '/dashboard/super-admin/settings': 'Settings',
  '/dashboard/super-admin/settings/logs': 'System Logs',
};

function getPageLabel(pathname: string): string {
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname];
  const segments = pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1] ?? '';
  return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, ' ');
}

interface DashboardHeaderProps {
  onMenuClick?: () => void;
}

export function DashboardHeader({ onMenuClick }: DashboardHeaderProps) {
  const pathname = usePathname();
  const { user, schoolName, logout } = useAuth();
  const switchSchoolStore = useAuthStore((s) => s.switchSchool);

  const [mounted, setMounted] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
  const [showSchools, setShowSchools] = useState(false);

  const [isSwitching, setIsSwitching] = useState(false);
  const [switchTarget, setSwitchTarget] = useState<{
    name: string;
    logo?: string;
    membershipId: string;
    role: UserRole;
  } | null>(null);

  // Stable ref so the navigation timer never resets on re-renders
  const switchTargetRef = useRef(switchTarget);
  useEffect(() => { switchTargetRef.current = switchTarget; }, [switchTarget]);

  useEffect(() => {
    if (!isSwitching) return;
    const t = setTimeout(() => {
      const target = switchTargetRef.current;
      window.location.href = target ? (ROLE_HOME[target.role] ?? '/login') : '/login';
    }, 3800);
    return () => clearTimeout(t);
  }, [isSwitching]);

  useEffect(() => { setMounted(true); }, []);

  const avatarRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pageName = getPageLabel(pathname);

  const { data: schools = [], isLoading: schoolsLoading } = useQuery<SchoolOption[]>({
    queryKey: ['my-schools'],
    queryFn: () => authApi.mySchools().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    enabled: showSchools,
  });

  useEffect(() => {
    if (!dropdownOpen) setShowSchools(false);
  }, [dropdownOpen]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handle = (e: MouseEvent) => {
      if (
        !avatarRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [dropdownOpen]);

  const openDropdown = () => {
    if (avatarRef.current) {
      const rect = avatarRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setDropdownOpen((o) => !o);
  };

  const handleLogout = async () => {
    setDropdownOpen(false);
    try { await authApi.logout(); } catch { /* fire and forget */ }
    logout();
    window.location.href = '/login';
  };

  const handleSwitchSchool = useCallback(async (option: SchoolOption) => {
    if (isSwitching) return;
    if (option.membership_id === user?.membership_id) {
      setDropdownOpen(false);
      return;
    }

    setDropdownOpen(false);

    try {
      const res = await authApi.switchSchool({ membership_id: option.membership_id });
      const { user: newUser, access_token } = res.data;
      switchSchoolStore(newUser, access_token);
      setSwitchTarget({
        name: option.school_name,
        logo: option.school_logo_url ?? undefined,
        membershipId: option.membership_id,
        role: newUser.role,
      });
      setIsSwitching(true);
    } catch {
      toast.error('Failed to switch school.');
    }
  }, [isSwitching, user?.membership_id, switchSchoolStore]);

  return (
    <header className="h-16 bg-white border-b border-[var(--color-border)] flex items-center px-4 lg:px-6 gap-3 sticky top-0 z-nav flex-shrink-0">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 -ml-1 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] transition-all duration-150 cursor-pointer"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" strokeWidth={1.5} />
      </button>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 flex-1 min-w-0" aria-label="Breadcrumb">
        <span className="text-xs text-[var(--color-text-muted)] truncate hidden sm:block max-w-[140px]">
          {schoolName ?? 'School'}
        </span>
        <ChevronRight
          className="w-3 h-3 text-[var(--color-text-muted)] flex-shrink-0 hidden sm:block"
          strokeWidth={1.5}
        />
        <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
          {pageName}
        </span>
      </nav>

      {/* Right controls */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          className="relative p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] transition-all duration-150 cursor-pointer"
          aria-label="Notifications"
        >
          <Bell className="w-[18px] h-[18px]" strokeWidth={1.5} />
          <span
            className="absolute top-[7px] right-[7px] w-[7px] h-[7px] rounded-full bg-[var(--color-gold)] border-2 border-white"
            aria-hidden="true"
          />
        </button>

        <div className="hidden md:block w-px h-5 bg-[var(--color-border)] mx-1" />

        <span className="hidden md:block text-xs font-medium text-[var(--color-text-secondary)] max-w-[140px] truncate">
          {schoolName}
        </span>

        <button
          ref={avatarRef}
          onClick={openDropdown}
          className="flex items-center gap-2 cursor-pointer p-1 rounded-full hover:ring-2 hover:ring-[var(--color-gold)]/30 transition-all duration-150"
          aria-label="Account menu"
          aria-expanded={dropdownOpen}
          aria-haspopup="true"
        >
          <div className="w-8 h-8 rounded-full bg-[var(--color-navy)] flex items-center justify-center ring-2 ring-white">
            <span className="text-[11px] font-bold text-white leading-none">
              {getInitials(user?.name ?? 'U')}
            </span>
          </div>
        </button>
      </div>

      {/* School switch overlay */}
      {isSwitching && switchTarget && (
        <SchoolSwitchOverlay
          isVisible={isSwitching}
          schoolName={switchTarget.name}
          schoolLogo={switchTarget.logo}
        />
      )}

      {/* Dropdown portal */}
      {dropdownOpen && mounted &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-tooltip bg-white rounded-xl border border-[var(--color-border)] shadow-dropdown overflow-hidden animate-fade-in"
            style={{ top: dropdownPos.top, right: dropdownPos.right, width: 224 }}
            role="menu"
          >
            {!showSchools ? (
              <>
                <div className="px-4 py-3 border-b border-[var(--color-border)]">
                  <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                    {user?.name ?? '—'}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">
                    {user?.email ?? '—'}
                  </p>
                </div>

                <div className="py-1" role="none">
                  <button
                    onClick={() => setShowSchools(true)}
                    role="menuitem"
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] transition-colors duration-150 cursor-pointer"
                  >
                    <ArrowLeftRight className="w-4 h-4 text-[var(--color-text-muted)]" strokeWidth={1.5} />
                    Switch School
                  </button>
                  <Link
                    href="/dashboard/super-admin/settings"
                    onClick={() => setDropdownOpen(false)}
                    role="menuitem"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] transition-colors duration-150 cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-[var(--color-text-muted)]" strokeWidth={1.5} />
                    Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    role="menuitem"
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors duration-150 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" strokeWidth={1.5} />
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
                  <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                    Your Schools
                  </p>
                  <button
                    onClick={() => setShowSchools(false)}
                    className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors"
                  >
                    Back
                  </button>
                </div>

                <div className="py-1 max-h-64 overflow-y-auto" role="none">
                  {schoolsLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-4 h-4 animate-spin text-[var(--color-text-muted)]" />
                    </div>
                  ) : (
                    schools.map((option) => {
                      const isCurrent = option.membership_id === user?.membership_id;

                      return (
                        <button
                          key={option.membership_id}
                          onClick={() => handleSwitchSchool(option)}
                          disabled={isSwitching}
                          role="menuitem"
                          className={clsx(
                            'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 cursor-pointer',
                            isCurrent
                              ? 'text-[var(--color-gold)] font-semibold bg-[var(--color-gold)]/5'
                              : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]',
                            isSwitching && 'opacity-50 cursor-not-allowed',
                          )}
                        >
                          <div className="w-7 h-7 rounded-lg bg-[var(--color-navy)]/8 flex items-center justify-center flex-shrink-0">
                            {option.school_logo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={option.school_logo_url}
                                alt=""
                                className="w-5 h-5 object-contain rounded"
                              />
                            ) : (
                              <Building2 className="w-3.5 h-3.5 text-[var(--color-navy)]/50" strokeWidth={1.5} />
                            )}
                          </div>
                          <span className="flex-1 text-left truncate text-xs">
                            {option.school_name}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] bg-[var(--color-gold)]/15 text-[var(--color-gold)] px-1.5 py-0.5 rounded-full flex-shrink-0">
                              Active
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>,
          document.body,
        )}
    </header>
  );
}
