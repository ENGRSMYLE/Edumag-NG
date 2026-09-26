import uuid
from datetime import datetime
from pydantic import BaseModel
from app.models.notification import DomainEventType

class NotificationResponse(BaseModel):
    id: uuid.UUID; event_type: DomainEventType; title: str; body: str; data: dict; is_read: bool; read_at: datetime | None; created_at: datetime
    model_config = {"from_attributes": True}
class NotificationPage(BaseModel):
    items: list[NotificationResponse]; total: int; page: int; per_page: int; unread_count: int
class NotificationUnreadCount(BaseModel): count: int


class NotificationPreferenceResponse(BaseModel):
    event_type: DomainEventType
    in_app_enabled: bool
    push_enabled: bool
    email_enabled: bool
    sms_enabled: bool
    whatsapp_enabled: bool
    mandatory: bool


class NotificationPreferenceUpdate(BaseModel):
    in_app_enabled: bool | None = None
    push_enabled: bool | None = None
    email_enabled: bool | None = None
    sms_enabled: bool | None = None
    whatsapp_enabled: bool | None = None


class NotificationPreferenceList(BaseModel):
    items: list[NotificationPreferenceResponse]
