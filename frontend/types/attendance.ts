export interface AttendanceReportItem {
  class_id: string;
  class_name: string;
  total_students: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendance_pct: number;
}

export interface AttendanceSummary {
  total_students: number;
  present: number;
  absent: number;
  late: number;
}

export interface AttendanceReportParams {
  date?: string;
  class_id?: string;
}
