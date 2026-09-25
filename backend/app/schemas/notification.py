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
