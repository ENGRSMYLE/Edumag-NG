from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.notification import DomainEventType, Notification, NotificationOutbox
from app.services.notifications import emit_notifications
from tests.test_parent_authorization import _seed_parent_access


async def test_disabled_school_keeps_in_app_notification_without_push_outbox(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, *_ = await _seed_parent_access(db)
        context.school.push_notifications_enabled = False
        records = await emit_notifications(
            db, school_id=context.school_id, user_ids={context.user.id},
            event_type=DomainEventType.student_absent,
            title="Attendance", body="Open the protected portal",
        )
        await db.commit()
        assert len(records) == 1
        assert records[0].is_in_app_visible is True
        assert (await db.execute(select(func.count(Notification.id)))).scalar_one() == 1
        assert (await db.execute(select(func.count(NotificationOutbox.id)))).scalar_one() == 0


async def test_enabled_school_stages_push_outbox(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, *_ = await _seed_parent_access(db)
        await emit_notifications(
            db, school_id=context.school_id, user_ids={context.user.id},
            event_type=DomainEventType.student_absent,
            title="Attendance", body="Open the protected portal",
        )
        await db.commit()
        assert (await db.execute(select(func.count(NotificationOutbox.id)))).scalar_one() == 1
