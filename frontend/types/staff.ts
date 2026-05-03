import type { UserRole } from './auth';

export interface StaffMember {
  id: string;
  school_id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  is_active: boolean;
  is_first_login: boolean;
  profile_photo_url?: string;
  created_by?: string;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface StaffListItem {
  user_id: string;
  membership_id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  class_id: string | null;
  created_at: string;
}

export interface InviteUserRequest {
  name: string;
  email: string;
  role: 'admin' | 'teacher';
  class_id?: string;
}

export interface UpdateStaffRequest {
  name?: string;
  phone?: string;
}

export interface UserListParams {
  page?: number;
  per_page?: number;
  role?: UserRole;
  is_active?: boolean;
  search?: string;
}
