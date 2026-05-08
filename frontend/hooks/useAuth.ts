'use client';

import { useAuthStore } from '@/store/authStore';
import type { UserRole } from '@/types/auth';

export function useAuth() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuthStore();

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    role: user?.role as UserRole | undefined,
    schoolName: user?.school_name,
    schoolId: user?.school_id,
    classId: user?.current_class_id,
    isFirstLogin: user?.is_first_login ?? false,
  };
}
