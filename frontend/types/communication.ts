export type AnnouncementAudience = 'all' | 'students' | 'parents' | 'staff';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  created_by: string;
  created_at: string;
}

export interface CreateAnnouncementRequest {
  title: string;
  body: string;
  audience: AnnouncementAudience;
}

export interface InboxMessage {
  id: string;
  sender_name: string;
  subject: string;
  preview: string;
  sent_at: string;
  is_read: boolean;
}
