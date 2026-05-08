// Per-class breakdown row (from /attendance/school → by_class)
export interface AttendanceReportItem {
  class_id: string;
  class_name: string;
  total_students: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendance_rate: number;
}

// School-wide summary (from GET /attendance/school)
export interface SchoolAttendanceSummary {
  date: string;
  total_students: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendance_rate: number;
  by_class: AttendanceReportItem[];
}

// Class-level summary (from GET /attendance/class/{class_id}/summary)
export interface ClassAttendanceSummary {
  date?: string;
  class_id?: string;
  class_name?: string;
  total_students: number;
  present: number;
  absent: number;
  late: number;
  excused?: number;
  attendance_rate?: number;
}

// Individual attendance record (from GET /attendance/class/{class_id})
export interface AttendanceRecord {
  id: string;
  student_id: string;
  student_name: string;
  class_id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  note?: string;
  marked_by_name: string;
}

// Mark attendance request
export interface MarkAttendanceEntry {
  student_id: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  note?: string;
}

export interface MarkAttendanceRequest {
  class_id: string;
  date: string;
  records: MarkAttendanceEntry[];
}

// Mark attendance response
export interface MarkAttendanceResponse {
  marked_count: number;
  date: string;
  class_name: string;
  already_marked: boolean;
}

// Check attendance response
export interface CheckAttendanceResponse {
  is_marked: boolean;
  date: string;
  marked_at?: string;
  marked_by?: string;
}

export interface AttendanceReportParams {
  date?: string;
  class_id?: string;
}
