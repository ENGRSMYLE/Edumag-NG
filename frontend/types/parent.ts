export type Relationship = 'father' | 'mother' | 'guardian' | 'other';

export interface ParentListItem {
  id: string;
  name: string;
  student_name: string;
  student_id: string;
  relationship: Relationship;
  phone: string;
  email?: string;
}

export interface CreateParentRequest {
  student_id: string;
  name: string;
  relationship: Relationship;
  phone: string;
  email?: string;
  address?: string;
  occupation?: string;
  is_primary?: boolean;
}

export interface ParentListParams {
  page?: number;
  per_page?: number;
  search?: string;
  student_id?: string;
}
