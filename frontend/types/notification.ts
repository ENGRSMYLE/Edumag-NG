export type NotificationEventType = 'parent_linked' | 'message_received' | 'result_published' | 'student_absent' | 'assignment_created' | 'fee_reminder' | 'announcement_published';
export interface AppNotification { id: string; event_type: NotificationEventType; title: string; body: string; data: Record<string, unknown>; is_read: boolean; read_at?: string | null; created_at: string }
export interface NotificationPage { items: AppNotification[]; total: number; page: number; per_page: number; unread_count: number }
export interface PushSubscriptionStatus {
  supported: boolean;
  configured: boolean;
  server_configured: boolean;
  school_enabled: boolean;
  public_key?: string | null;
  subscribed: boolean;
  device_count: number;
}
export interface PushSubscriptionRequest {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  device_name?: string;
  expiration_time?: number | null;
}
export interface PushTestResponse { message: string; notification_id: string; delivery_status: string }
export interface NotificationPreference {
  event_type: NotificationEventType;
  in_app_enabled: boolean;
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  mandatory: boolean;
}
export interface NotificationPreferenceList { items: NotificationPreference[] }
export type NotificationPreferenceUpdate = Partial<Pick<NotificationPreference,
  'in_app_enabled' | 'push_enabled' | 'email_enabled' | 'sms_enabled' | 'whatsapp_enabled'>>;
