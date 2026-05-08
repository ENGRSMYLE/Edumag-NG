export interface ClassListItem {
  id: string;
  name: string;
  level: string;
  arm?: string | null;
  teacher_name?: string | null;
  student_count?: number;
  academic_session: string;
  term: 'first' | 'second' | 'third';
  is_active: boolean;
}

export interface StudentListParams {
  page?: number;
  per_page?: number;
  search?: string;
  class_id?: string;
  is_active?: boolean;
}
