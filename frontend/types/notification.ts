export type NotificationEventType = 'parent_linked' | 'message_received' | 'result_published' | 'student_absent' | 'assignment_created' | 'fee_reminder' | 'announcement_published';
export interface AppNotification { id: string; event_type: NotificationEventType; title: string; body: string; data: Record<string, unknown>; is_read: boolean; read_at?: string | null; created_at: string }
export interface NotificationPage { items: AppNotification[]; total: number; page: number; per_page: number; unread_count: number }
