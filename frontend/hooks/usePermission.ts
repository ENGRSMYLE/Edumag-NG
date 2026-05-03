'use client';

import { hasPermission, hasAnyPermission } from '@/lib/rbac';
import { useAuthStore } from '@/store/authStore';
import type { Permission, UserRole } from '@/constants/permissions';

export function usePermission(permission: Permission): boolean {
  const user = useAuthStore((s) => s.user);
  if (!user) return false;
  return hasPermission(user.role as UserRole, permission);
}

export function useAnyPermission(permissions: Permission[]): boolean {
  const user = useAuthStore((s) => s.user);
  if (!user) return false;
  return hasAnyPermission(user.role as UserRole, permissions);
}

export function useRole(): UserRole | undefined {
  const user = useAuthStore((s) => s.user);
  return user?.role as UserRole | undefined;
}
