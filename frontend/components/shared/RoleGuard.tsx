'use client';

import type { ReactNode } from 'react';
import type { Permission } from '@/constants/permissions';
import { usePermission, useAnyPermission } from '@/hooks/usePermission';

interface RoleGuardProps {
  permission?: Permission;
  anyOf?: Permission[];
  fallback?: ReactNode;
  children: ReactNode;
}

function SingleGuard({
  permission,
  fallback,
  children,
}: {
  permission: Permission;
  fallback: ReactNode;
  children: ReactNode;
}) {
  const allowed = usePermission(permission);
  return allowed ? <>{children}</> : <>{fallback}</>;
}

function AnyGuard({
  permissions,
  fallback,
  children,
}: {
  permissions: Permission[];
  fallback: ReactNode;
  children: ReactNode;
}) {
  const allowed = useAnyPermission(permissions);
  return allowed ? <>{children}</> : <>{fallback}</>;
}

export function RoleGuard({
  permission,
  anyOf,
  fallback = null,
  children,
}: RoleGuardProps) {
  if (permission) {
    return (
      <SingleGuard permission={permission} fallback={fallback}>
        {children}
      </SingleGuard>
    );
  }

  if (anyOf && anyOf.length > 0) {
    return (
      <AnyGuard permissions={anyOf} fallback={fallback}>
        {children}
      </AnyGuard>
    );
  }

  return <>{children}</>;
}
