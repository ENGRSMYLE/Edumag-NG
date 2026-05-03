export interface AssignmentListItem {
  id: string;
  title: string;
  subject: string;
  description?: string;
  due_date: string;
  max_score: number;
  submission_count: number;
  graded_count: number;
  created_at: string;
}

export interface Assignment extends AssignmentListItem {
  class_id: string;
  class_name: string;
  file_url?: string;
}

export interface CreateAssignmentRequest {
  title: string;
  subject: string;
  description?: string;
  due_date: string;
  max_score: number;
  file_url?: string;
}

export interface AssignmentSubmission {
  id: string;
  student_id: string;
  student_name: string;
  submitted_at: string;
  file_url?: string;
  score?: number;
  feedback?: string;
  is_graded: boolean;
}

export interface GradeSubmissionRequest {
  score: number;
  feedback?: string;
}

export interface AssignmentListParams {
  page?: number;
  per_page?: number;
  subject?: string;
}
