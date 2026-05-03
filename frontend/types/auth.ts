export type UserRole = 'super_admin' | 'admin' | 'teacher';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  school_id: string;
  school_name: string;
  membership_id: string;
  is_first_login: boolean;
  profile_photo_url?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface SchoolOption {
  membership_id: string;
  school_id: string;
  school_name: string;
  school_logo_url?: string;
  role: UserRole;
  is_first_login: boolean;
}

export interface LoginStep1Response {
  requires_school_selection: true;
  temp_token: string;
  schools: SchoolOption[];
  user_name: string;
}

export type LoginResponse = TokenResponse | LoginStep1Response;

export interface SelectSchoolRequest {
  temp_token: string;
  membership_id: string;
}

export interface SwitchSchoolRequest {
  membership_id: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SendOTPRequest {
  email: string;
  school_name: string;
}

export interface VerifyOTPRequest {
  email: string;
  otp: string;
}

export interface VerifyOTPResponse {
  verified: boolean;
  verification_token: string;
}

export interface RegisterSchoolRequest {
  school_name: string;
  school_type: 'primary' | 'secondary' | 'both';
  address: string;
  lga: string;
  state: string;
  phone: string;
  admin_name: string;
  email: string;
  password: string;
  verification_token: string;
}

export interface SetPasswordRequest {
  invite_token: string;
  new_password: string;
}
