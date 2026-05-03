export interface ClassListItem {
  id: string;
  name: string;
  level: string;
  teacher_name?: string;
  student_count?: number;
}

export interface StudentListParams {
  page?: number;
  per_page?: number;
  search?: string;
  class_id?: string;
  is_active?: boolean;
}
