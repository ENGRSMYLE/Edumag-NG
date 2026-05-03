import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

import type {
  AuthUser,
  LoginRequest,
  LoginResponse,
  RegisterSchoolRequest,
  SchoolOption,
  SelectSchoolRequest,
  SendOTPRequest,
  SetPasswordRequest,
  SwitchSchoolRequest,
  TokenResponse,
  VerifyOTPRequest,
  VerifyOTPResponse,
} from '@/types/auth';
import type { PaginatedResponse } from '@/types/common';
import type { InviteUserRequest, StaffListItem, UserListParams } from '@/types/staff';
import type { StudentListItem, Student } from '@/types/student';
import type { ClassListItem, StudentListParams } from '@/types/academic';
import type {
  DashboardOverview,
  FinanceStats,
  PaymentListItem,
  PaymentListParams,
  DebtorListItem,
  DebtorListParams,
  ResultListItem,
  ResultListParams,
  SchoolSettings,
  GradeScale,
  AcademicTerm,
  AuditLog,
  AuditLogParams,
} from '@/types/dashboard';
import type { ParentListItem, CreateParentRequest, ParentListParams } from '@/types/parent';
import type { AttendanceReportItem, AttendanceReportParams } from '@/types/attendance';
import type { Announcement, CreateAnnouncementRequest } from '@/types/communication';
import type {
  AssignmentListItem,
  Assignment,
  CreateAssignmentRequest,
  AssignmentSubmission,
  GradeSubmissionRequest,
  AssignmentListParams,
} from '@/types/assignment';

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api',
  withCredentials: true, // send httpOnly cookies automatically
  headers: { 'Content-Type': 'application/json' },
});

// ---------------------------------------------------------------------------
// Request interceptor — attach in-memory access token as fallback header
// ---------------------------------------------------------------------------

api.interceptors.request.use((config) => {
  // Lazy-import avoids a circular dependency at module evaluation time
  const { useAuthStore } = require('@/store/authStore');
  const token: string | null = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---------------------------------------------------------------------------
// Refresh-token rotation state
// ---------------------------------------------------------------------------

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

function drainQueue(token: string) {
  refreshQueue.forEach((cb) => cb(token));
  refreshQueue = [];
}

function flushQueueWithError() {
  refreshQueue = [];
}

// ---------------------------------------------------------------------------
// Response interceptor — handle 401 / 403 PASSWORD_CHANGE_REQUIRED
// ---------------------------------------------------------------------------

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // ── 403: Password change required ──────────────────────────────────────
    if (error.response?.status === 403) {
      const detail = (error.response.data as any)?.detail;
      const code =
        typeof detail === 'object' ? detail?.code : null;
      if (code === 'PASSWORD_CHANGE_REQUIRED') {
        if (typeof window !== 'undefined') {
          window.location.href = '/set-password';
        }
        return Promise.reject(error);
      }
    }

    // ── 401: Attempt silent token refresh (once per request) ───────────────
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // If the refresh endpoint itself returned 401, log out immediately
    if (originalRequest.url?.includes('/auth/refresh')) {
      _forceLogout();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      // Another request already triggered a refresh — queue this one
      return new Promise<string>((resolve) => {
        refreshQueue.push(resolve);
      }).then((newToken) => {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      });
    }

    isRefreshing = true;

    try {
      // Use a bare axios call to avoid going through our own interceptors
      const { data } = await axios.post<{ access_token: string }>(
        `${api.defaults.baseURL}/auth/refresh`,
        {},
        { withCredentials: true },
      );

      const newToken = data.access_token;
      const { useAuthStore } = require('@/store/authStore');
      useAuthStore.getState().setAccessToken(newToken);

      drainQueue(newToken);
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch {
      flushQueueWithError();
      _forceLogout();
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);

function _forceLogout() {
  const { useAuthStore } = require('@/store/authStore');
  useAuthStore.getState().logout();
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------

export const authApi = {
  login: (data: LoginRequest) =>
    api.post<LoginResponse>('/auth/login', data),

  registerSchool: (data: RegisterSchoolRequest) =>
    api.post<TokenResponse>('/auth/register-school', data),

  selectSchool: (data: SelectSchoolRequest) =>
    api.post<TokenResponse>('/auth/select-school', data),

  switchSchool: (data: SwitchSchoolRequest) =>
    api.post<TokenResponse>('/auth/switch-school', data),

  mySchools: () =>
    api.get<SchoolOption[]>('/auth/my-schools'),

  logout: () =>
    api.post('/auth/logout'),

  me: () =>
    api.get<AuthUser>('/auth/me'),

  setPassword: (data: SetPasswordRequest) =>
    api.post<TokenResponse>('/auth/set-password', data),

  refresh: () =>
    api.post<{ access_token: string }>('/auth/refresh'),

  sendOTP: (data: SendOTPRequest) =>
    api.post<{ message: string; expires_in_minutes: number }>('/auth/send-otp', data),

  verifyOTP: (data: VerifyOTPRequest) =>
    api.post<VerifyOTPResponse>('/auth/verify-otp', data),
};

// ---------------------------------------------------------------------------
// Users API
// ---------------------------------------------------------------------------

export const usersApi = {
  invite: (data: InviteUserRequest) =>
    api.post('/users/invite', data),

  list: (params?: UserListParams) =>
    api.get<PaginatedResponse<StaffListItem>>('/users/', { params }),

  get: (id: string) =>
    api.get(`/users/${id}`),

  update: (id: string, data: { name?: string; phone?: string }) =>
    api.patch(`/users/${id}`, data),

  deactivate: (id: string) =>
    api.patch(`/users/${id}/deactivate`),

  resendInvite: (id: string) =>
    api.post(`/users/${id}/resend-invite`),
};

// ---------------------------------------------------------------------------
// Dashboard API
// ---------------------------------------------------------------------------

export const dashboardApi = {
  overview: () =>
    api.get<DashboardOverview>('/dashboard/overview'),
};

// ---------------------------------------------------------------------------
// Students API
// ---------------------------------------------------------------------------

export const studentsApi = {
  list: (params?: StudentListParams) =>
    api.get<PaginatedResponse<StudentListItem>>('/students/', { params }),

  get: (id: string) =>
    api.get<Student>(`/students/${id}`),

  create: (data: import('@/types/student').CreateStudentRequest) =>
    api.post<Student>('/students/', data),

  update: (id: string, data: Partial<import('@/types/student').CreateStudentRequest>) =>
    api.patch<Student>(`/students/${id}`, data),

  bulkUpload: (rows: Record<string, unknown>[]) =>
    api.post<{ created: number; errors: { row: number; message: string }[] }>('/students/bulk-upload', { rows }),

  generateAdmissionNumber: () =>
    api.get<{ admission_number: string }>('/students/generate-admission-number'),
};

// ---------------------------------------------------------------------------
// Parents API
// ---------------------------------------------------------------------------

export const parentsApi = {
  list: (params?: ParentListParams) =>
    api.get<PaginatedResponse<ParentListItem>>('/parents/', { params }),

  create: (data: CreateParentRequest) =>
    api.post<ParentListItem>('/parents/', data),

  update: (id: string, data: Partial<CreateParentRequest>) =>
    api.patch<ParentListItem>(`/parents/${id}`, data),
};

// ---------------------------------------------------------------------------
// Attendance API
// ---------------------------------------------------------------------------

export const attendanceApi = {
  report: (params?: AttendanceReportParams) =>
    api.get<AttendanceReportItem[]>('/attendance/report', { params }),

  submit: (data: { date: string; class_id: string; records: { student_id: string; status: string }[] }) =>
    api.post('/attendance/submit', data),

  history: (params?: { class_id?: string; start_date?: string; end_date?: string; page?: number; per_page?: number }) =>
    api.get<import('@/types/common').PaginatedResponse<{ id: string; date: string; present: number; absent: number; late: number; excused: number; total: number }>>('/attendance/history', { params }),

  checkDate: (params: { date: string; class_id: string }) =>
    api.get<{ submitted: boolean; summary?: { present: number; absent: number; late: number; excused: number } }>('/attendance/check', { params }),
};

// ---------------------------------------------------------------------------
// Announcements API
// ---------------------------------------------------------------------------

export const announcementsApi = {
  list: (params?: { page?: number; per_page?: number }) =>
    api.get<PaginatedResponse<Announcement>>('/announcements/', { params }),

  create: (data: CreateAnnouncementRequest) =>
    api.post<Announcement>('/announcements/', data),
};

// ---------------------------------------------------------------------------
// Results API
// ---------------------------------------------------------------------------

export const resultsApi = {
  report: (params?: ResultListParams) =>
    api.get<PaginatedResponse<ResultListItem>>('/results/report', { params }),
};

// ---------------------------------------------------------------------------
// Classes API
// ---------------------------------------------------------------------------

export const classesApi = {
  list: () =>
    api.get<ClassListItem[]>('/classes/'),

  create: (data: { name: string; level: string; arm?: string; teacher_id?: string; capacity?: number; session?: string; term?: string }) =>
    api.post<ClassListItem>('/classes/', data),

  update: (id: string, data: Partial<{ name: string; level: string; arm?: string; teacher_id?: string; capacity?: number }>) =>
    api.patch<ClassListItem>(`/classes/${id}`, data),
};

// ---------------------------------------------------------------------------
// Finance API
// ---------------------------------------------------------------------------

export const financeApi = {
  stats: () =>
    api.get<FinanceStats>('/finance/stats'),

  payments: (params?: PaymentListParams) =>
    api.get<PaginatedResponse<PaymentListItem>>('/finance/payments', { params }),

  debtors: (params?: DebtorListParams) =>
    api.get<PaginatedResponse<DebtorListItem>>('/finance/debtors', { params }),

  recordPayment: (data: { student_id: string; amount_kobo: number; payment_type: string; payment_method: string; session?: string; term?: string; notes?: string }) =>
    api.post<PaymentListItem>('/finance/payments', data),
};

// ---------------------------------------------------------------------------
// Settings API
// ---------------------------------------------------------------------------

export const settingsApi = {
  school: () =>
    api.get<SchoolSettings>('/settings/school'),

  updateSchool: (data: Partial<SchoolSettings>) =>
    api.patch<SchoolSettings>('/settings/school', data),

  gradeScales: () =>
    api.get<GradeScale[]>('/settings/grade-scales'),

  updateGradeScales: (data: GradeScale[]) =>
    api.put<GradeScale[]>('/settings/grade-scales', data),

  terms: () =>
    api.get<AcademicTerm[]>('/settings/terms'),

  createTerm: (data: Omit<AcademicTerm, 'id' | 'is_current'>) =>
    api.post<AcademicTerm>('/settings/terms', data),

  setCurrentTerm: (id: string) =>
    api.patch<AcademicTerm>(`/settings/terms/${id}/set-current`),

  uploadLogo: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<{ url: string }>('/settings/logo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  logs: (params?: AuditLogParams) =>
    api.get<PaginatedResponse<AuditLog>>('/settings/logs', { params }),
};

// ---------------------------------------------------------------------------
// Assignments API
// ---------------------------------------------------------------------------

export const assignmentsApi = {
  list: (params?: AssignmentListParams) =>
    api.get<import('@/types/common').PaginatedResponse<AssignmentListItem>>('/assignments/', { params }),

  get: (id: string) =>
    api.get<Assignment>(`/assignments/${id}`),

  create: (data: CreateAssignmentRequest) =>
    api.post<Assignment>('/assignments/', data),

  submissions: (assignmentId: string) =>
    api.get<AssignmentSubmission[]>(`/assignments/${assignmentId}/submissions`),

  grade: (submissionId: string, data: GradeSubmissionRequest) =>
    api.patch(`/assignments/submissions/${submissionId}/grade`, data),
};

// ---------------------------------------------------------------------------
// Messages API (staff ↔ admin)
// ---------------------------------------------------------------------------

export const messagesApi = {
  list: () =>
    api.get<import('@/types/common').PaginatedResponse<{ id: string; subject: string; body: string; sent_at: string; is_read: boolean; sender_name: string; recipient_name: string }>>('/messages/'),

  send: (data: { subject: string; body: string }) =>
    api.post('/messages/', data),
};

export default api;
