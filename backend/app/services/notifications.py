import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.notification import DomainEventType, Notification, NotificationOutbox

async def emit_notifications(db: AsyncSession, *, school_id: uuid.UUID, user_ids: set[uuid.UUID], event_type: DomainEventType, title: str, body: str, data: dict | None = None) -> list[Notification]:
    """Stage in-app notifications and durable delivery events in the caller's transaction."""
    records = []
    for user_id in user_ids:
        notification = Notification(school_id=school_id, user_id=user_id, event_type=event_type, title=title, body=body, data=data or {})
        db.add(notification)
        await db.flush()
        db.add(NotificationOutbox(notification_id=notification.id, event_type=event_type, payload={"notification_id": str(notification.id), "user_id": str(user_id), **(data or {})}))
        records.append(notification)
    return records
