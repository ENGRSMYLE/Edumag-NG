import type { Gender, Term } from './common';

export interface Student {
  id: string;
  school_id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  date_of_birth: string;
  gender: Gender;
  photo_url?: string;
  address?: string;
  state_of_origin?: string;
  religion?: string;
  blood_group?: string;
  genotype?: string;
  class_id?: string;
  is_active: boolean;
  admission_date: string;
  created_at: string;
  updated_at: string;
}

export interface StudentListItem {
  id: string;
  admission_number: string;
  first_name?: string;
  last_name?: string;
  full_name: string;
  middle_name?: string;
  gender: Gender;
  photo_url?: string;
  class_id?: string;
  class_name?: string;
  is_active: boolean;
  admission_date: string;
}

export interface CreateStudentRequest {
  admission_number: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  date_of_birth: string;
  gender: Gender;
  address?: string;
  state_of_origin?: string;
  religion?: string;
  blood_group?: string;
  genotype?: string;
  class_id?: string;
  photo_url?: string;
  admission_date: string;
}

export interface StudentParent {
  id: string;
  student_id: string;
  name: string;
  relationship: 'father' | 'mother' | 'guardian' | 'other';
  phone: string;
  email?: string;
  address?: string;
  occupation?: string;
  is_primary: boolean;
  created_at: string;
}

export interface StudentResult {
  id: string;
  student_id: string;
  class_id: string;
  subject: string;
  academic_session: string;
  term: Term;
  ca_score?: number;
  exam_score?: number;
  total_score?: number;
  grade?: string;
  teacher_comment?: string;
  is_approved: boolean;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  note?: string;
}
