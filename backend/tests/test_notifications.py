from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from app.models.notification import DomainEventType, Notification, NotificationOutbox
from app.services.notifications import emit_notifications
from tests.test_parent_authorization import _seed_parent_access

async def test_notification_and_outbox_are_staged_without_external_delivery(client, test_engine):
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, *_ = await _seed_parent_access(db)
        records = await emit_notifications(db, school_id=context.school_id, user_ids={context.user.id}, event_type=DomainEventType.student_absent, title="Attendance alert", body="A student was absent")
        await db.commit()
        notification = (await db.execute(select(Notification).where(Notification.id == records[0].id))).scalar_one()
        outbox = (await db.execute(select(NotificationOutbox).where(NotificationOutbox.notification_id == notification.id))).scalar_one()
        assert notification.user_id == context.user.id and notification.is_read is False
        assert outbox.processed_at is None and outbox.attempts == 0
