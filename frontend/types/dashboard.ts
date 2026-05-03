export interface DashboardStats {
  total_students: number;
  total_staff: number;
  monthly_revenue_kobo: number;
  attendance_today_percent: number;
  students_change_pct: number;
  staff_change_pct: number;
  revenue_change_pct: number;
  attendance_change_pct: number;
}

export interface EnrollmentDataPoint {
  month: string;
  students: number;
}

export interface RevenueDataPoint {
  month: string;
  amount_kobo: number;
}

export type ActivityType =
  | 'student_added'
  | 'payment_received'
  | 'staff_invited'
  | 'class_created'
  | 'announcement_posted';

export interface RecentActivity {
  id: string;
  type: ActivityType;
  description: string;
  actor_name: string;
  timestamp: string;
}

export interface DashboardOverview {
  stats: DashboardStats;
  enrollment_data: EnrollmentDataPoint[];
  revenue_data: RevenueDataPoint[];
  recent_activity: RecentActivity[];
}

// ── Finance ─────────────────────────────────────────────────────────────────

export interface FinanceStats {
  total_collected_kobo: number;
  outstanding_kobo: number;
  fully_paid_count: number;
  debtors_count: number;
  collected_change_pct: number;
}

export type PaymentType = 'tuition' | 'levy' | 'uniform' | 'books' | 'other';
export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'pos';
export type PaymentStatus = 'pending' | 'confirmed' | 'rejected';

export interface PaymentListItem {
  id: string;
  student_name: string;
  student_id: string;
  amount_kobo: number;
  payment_type: PaymentType;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  paid_at: string;
  confirmed_by?: string;
}

export interface PaymentListParams {
  page?: number;
  per_page?: number;
  status?: PaymentStatus;
  payment_type?: PaymentType;
  search?: string;
}

// ── Settings ─────────────────────────────────────────────────────────────────

export interface SchoolSettings {
  id: string;
  name: string;
  school_type: 'primary' | 'secondary' | 'both';
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  motto?: string;
  report_header?: string;
  report_logo_position?: 'left' | 'center' | 'right';
}

export interface GradeScale {
  id: string;
  grade: string;
  min_score: number;
  max_score: number;
  remark: string;
}

export interface AcademicTerm {
  id: string;
  session: string;
  term: 'first' | 'second' | 'third';
  start_date: string;
  end_date: string;
  is_current: boolean;
}

// ── Finance – Debtors ────────────────────────────────────────────────────────

export interface DebtorListItem {
  id: string;
  student_name: string;
  student_id: string;
  class_name?: string;
  expected_kobo: number;
  paid_kobo: number;
  balance_kobo: number;
  last_payment_date?: string;
}

export interface DebtorListParams {
  page?: number;
  per_page?: number;
  search?: string;
  class_id?: string;
}

// ── Results ───────────────────────────────────────────────────────────────────

export type ResultStatus = 'pending' | 'approved' | 'generated';

export interface ResultListItem {
  id: string;
  student_name: string;
  student_id: string;
  class_name: string;
  subjects_entered: number;
  subjects_total: number;
  comments?: string;
  status: ResultStatus;
}

export interface ResultListParams {
  page?: number;
  per_page?: number;
  class_id?: string;
  session?: string;
  term?: string;
  status?: ResultStatus;
}

// ── Audit Logs ───────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  timestamp: string;
  user_name: string;
  user_role: string;
  action: string;
  ip_address: string;
  details?: string;
}

export interface AuditLogParams {
  page?: number;
  per_page?: number;
  action?: string;
  date_from?: string;
  date_to?: string;
}
