export type AnnouncementAudience = 'all' | 'admin' | 'teacher';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  target_audience: AnnouncementAudience;
  sent_by_name: string;
  created_at: string;
}

export interface CreateAnnouncementRequest {
  title: string;
  body: string;
  target_audience: AnnouncementAudience;
}

export interface MessageResponse {
  id: string;
  sender_id: string;
  sender_name: string;
  recipient_id: string | null;
  recipient_name: string;
  recipients: MessageRecipient[];
  subject: string | null;
  body: string;
  is_read: boolean;
  thread_id: string;
  created_at: string;
}

export interface SendMessageRequest {
  recipient_id?: string;
  recipient_ids?: string[];
  recipient_group?: 'all_teachers' | 'all_admins';
  body: string;
  subject?: string;
  thread_id?: string;
  parent_message_id?: string;
}

export interface MessageRecipient {
  id: string;
  name: string;
  role: 'super_admin' | 'admin' | 'teacher';
}

export interface RecipientPage {
  total: number;
  page: number;
  per_page: number;
  items: MessageRecipient[];
}

export interface ThreadResponse {
  thread_id: string;
  items: MessageResponse[];
}

export interface InboxResponse {
  total: number;
  page: number;
  per_page: number;
  items: MessageResponse[];
  unread_count: number;
}

export interface UnreadCountResponse {
  count: number;
}
