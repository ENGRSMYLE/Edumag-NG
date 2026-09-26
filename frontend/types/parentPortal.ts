export interface ParentChildPermissions {
  attendance: boolean;
  results: boolean;
  assignments: boolean;
  finance: boolean;
  messaging: boolean;
  pickup: boolean;
}

export interface ParentChild {
  id: string;
  admission_number: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  date_of_birth: string;
  gender: string;
  photo_url?: string | null;
  class_id?: string | null;
  class_name?: string | null;
  class_level?: string | null;
  academic_session?: string | null;
  permissions: ParentChildPermissions;
}

export interface ParentDashboard {
  children: ParentChild[];
  child_count: number;
  attendance_records: number;
  present_records: number;
  attendance_rate: number;
  approved_results: number;
  upcoming_assignments: number;
}

export interface ParentChildrenPage {
  items: ParentChild[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ParentProfile {
  guardian_id: string;
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  occupation?: string | null;
  preferred_contact_channel: 'in_app' | 'email' | 'sms' | 'whatsapp';
}

export interface ParentAttendanceItem { id: string; date: string; status: 'present' | 'absent' | 'late' | 'excused'; note?: string | null }
export interface ParentAttendancePage {
  items: ParentAttendanceItem[]; total: number; page: number; per_page: number; total_pages: number;
  present_count: number; absent_count: number; late_count: number; excused_count: number; attendance_rate: number;
}
export interface ParentResultItem { id: string; subject: string; academic_session: string; term: string; ca_score?: number | null; exam_score?: number | null; total_score?: number | null; grade?: string | null; teacher_comment?: string | null }
export interface ParentResultsPage { items: ParentResultItem[]; total: number; page: number; per_page: number; total_pages: number }
export interface ParentAssignmentItem { id: string; title: string; subject: string; description?: string | null; due_date: string; max_score: number; file_url?: string | null; submitted_at?: string | null; score?: number | null; feedback?: string | null }
export interface ParentAssignmentsPage { items: ParentAssignmentItem[]; total: number; page: number; per_page: number; total_pages: number }
export interface ParentFinanceItem { id: string; amount_kobo: number; payment_type: string; payment_method: string; academic_session: string; term: string; status: string; reference: string; paid_at?: string | null; created_at: string }
export interface ParentFinancePage { items: ParentFinanceItem[]; total: number; page: number; per_page: number; total_pages: number }
