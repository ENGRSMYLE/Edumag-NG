export type Relationship = 'father' | 'mother' | 'guardian' | 'other';
export type GuardianStatus = 'invited' | 'active' | 'suspended' | 'disabled';

export interface GuardianRelationship {
  relationship_id: string;
  guardian_profile_id: string;
  student_id: string;
  guardian_name: string;
  email: string;
  phone?: string;
  relationship_type: Relationship;
  is_primary: boolean;
  is_active: boolean;
}

export interface ParentListItem {
  guardian_id: string;
  membership_id: string;
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  occupation?: string;
  status: GuardianStatus;
  membership_active: boolean;
  activation_status: 'active' | 'invited' | 'disabled';
  invitation_status: 'accepted' | 'pending' | 'expired' | 'none';
  invitation_expires_at?: string;
  active_children_count: number;
  relationships: GuardianRelationship[];
}

export interface CreateParentRequest {
  student_id: string;
  guardian_profile_id?: string;
  name: string;
  email: string;
  phone?: string;
  relationship_type: Relationship;
  address?: string;
  occupation?: string;
  is_primary?: boolean;
}

export interface ParentListParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: GuardianStatus;
}
