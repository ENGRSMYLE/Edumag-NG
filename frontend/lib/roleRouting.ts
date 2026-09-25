import type { UserRole } from '@/types/auth';

export const ROLE_HOME: Record<UserRole, string> = {
  super_admin: '/dashboard/super-admin',
  admin: '/dashboard/admin',
  teacher: '/dashboard/staff',
  parent: '/dashboard/parent',
};

export function getRoleHome(role: string | null | undefined): string | null {
  return role && role in ROLE_HOME ? ROLE_HOME[role as UserRole] : null;
}

export function isRouteInRoleSection(pathname: string, roleHome: string): boolean {
  return pathname === roleHome || pathname.startsWith(`${roleHome}/`);
}
