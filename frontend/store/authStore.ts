'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AuthUser, SchoolOption, TokenResponse } from '@/types/auth';

interface AuthState {
  user: AuthUser | null;
  /** In-memory only — excluded from sessionStorage via partialize. */
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  /** Set when login returns multiple schools — cleared after school selection. */
  schools: SchoolOption[] | null;
  tempToken: string | null;
  requiresSchoolSelection: boolean;

  login: (tokenResponse: TokenResponse) => void;
  logout: () => void;
  setUser: (user: AuthUser) => void;
  setAccessToken: (token: string) => void;
  setLoading: (loading: boolean) => void;
  setSchoolOptions: (schools: SchoolOption[], tempToken: string) => void;
  clearSchoolSelection: () => void;
  switchSchool: (user: AuthUser, accessToken: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      schools: null,
      tempToken: null,
      requiresSchoolSelection: false,

      login(tokenResponse) {
        set({
          user: tokenResponse.user,
          accessToken: tokenResponse.access_token,
          isAuthenticated: true,
          isLoading: false,
          schools: null,
          tempToken: null,
          requiresSchoolSelection: false,
        });
        // Set a client-readable cookie on this domain so the middleware can
        // see auth state. The real JWT lives in the httpOnly cookie on the API
        // domain — this cookie only carries role + expiry for routing decisions.
        if (typeof document !== 'undefined') {
          const maxAge = 15 * 60; // 15 minutes — matches ACCESS_TOKEN_EXPIRE_MINUTES
          document.cookie = `_auth_role=${tokenResponse.user.role}; path=/; max-age=${maxAge}; SameSite=Lax`;
        }
      },

      logout() {
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: false,
          schools: null,
          tempToken: null,
          requiresSchoolSelection: false,
        });
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('edumag-auth');
          document.cookie = '_auth_role=; path=/; max-age=0';
        }
      },

      setUser(user) {
        set({ user });
      },

      setAccessToken(token) {
        set({ accessToken: token });
      },

      setLoading(loading) {
        set({ isLoading: loading });
      },

      setSchoolOptions(schools, tempToken) {
        set({
          schools,
          tempToken,
          requiresSchoolSelection: true,
          isLoading: false,
        });
      },

      clearSchoolSelection() {
        set({
          schools: null,
          tempToken: null,
          requiresSchoolSelection: false,
        });
      },

      switchSchool(user, accessToken) {
        set({
          user,
          accessToken,
          isAuthenticated: true,
        });
        if (typeof document !== 'undefined') {
          const maxAge = 15 * 60;
          document.cookie = `_auth_role=${user.role}; path=/; max-age=${maxAge}; SameSite=Lax`;
        }
      },
    }),
    {
      name: 'edumag-auth',
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined') return sessionStorage;
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
      // Only persist user identity — never persist the token
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
