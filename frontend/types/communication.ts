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
  recipient_id: string;
  recipient_name: string;
  subject: string | null;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface SendMessageRequest {
  recipient_id: string;
  body: string;
  subject?: string;
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
