import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.communication import TargetAudience
from app.models.notification import DomainEventType, Notification, NotificationOutbox
from app.models.school_membership import MembershipRole, SchoolMembership
from app.models.user import User
from app.services.notifications import (
    notify_announcement_published,
    notify_message_received,
    notify_student_event,
)
from app.utils.security import hash_password
from tests.test_parent_authorization import _seed_parent_access


@pytest.mark.asyncio
async def test_each_domain_event_stages_notification_and_outbox_for_authorized_recipient(
    client, test_engine,
) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, _, _, students, relationship = await _seed_parent_access(db)
        relationship.can_view_finance = True

        admin = User(
            name="Notification Admin",
            email="notification-admin@test.local",
            password_hash=hash_password("Password1!"),
        )
        db.add(admin)
        await db.flush()
        db.add(SchoolMembership(
            user_id=admin.id,
            school_id=context.school_id,
            role=MembershipRole.admin,
            is_active=True,
        ))
        await db.flush()

        await notify_message_received(
            db, school_id=context.school_id, recipient_ids={context.user.id},
            title="Message", body="Open the portal", data={"message_id": "m1"},
        )
        await notify_announcement_published(
            db, school_id=context.school_id, audience=TargetAudience.all,
            sender_id=admin.id, title="Announcement", body="School update",
            data={"announcement_id": "a1"},
        )
        for event_type in (
            DomainEventType.student_absent,
            DomainEventType.assignment_created,
            DomainEventType.result_published,
            DomainEventType.fee_reminder,
        ):
            await notify_student_event(
                db, school_id=context.school_id, student_ids={students[0].id},
                event_type=event_type, title=event_type.value, body="Portal update", data={},
            )
        await db.commit()

        rows = list((await db.execute(select(Notification).where(
            Notification.school_id == context.school_id,
            Notification.user_id == context.user.id,
        ))).scalars().all())
        assert {row.event_type for row in rows} == {
            DomainEventType.message_received,
            DomainEventType.announcement_published,
            DomainEventType.student_absent,
            DomainEventType.assignment_created,
            DomainEventType.result_published,
            DomainEventType.fee_reminder,
        }
        notification_ids = {row.id for row in rows}
        outbox_count = (await db.execute(select(func.count(NotificationOutbox.id)).where(
            NotificationOutbox.notification_id.in_(notification_ids)
        ))).scalar_one()
        assert outbox_count == len(notification_ids)


@pytest.mark.asyncio
async def test_domain_events_exclude_inactive_or_unauthorized_guardian_relationships(
    client, test_engine,
) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, membership, _, students, relationship = await _seed_parent_access(db)

        relationship.can_receive_messages = False
        relationship.can_view_attendance = False
        await db.flush()
        assert await notify_message_received(
            db, school_id=context.school_id, recipient_ids={context.user.id},
            title="Message", body="Body", data={},
        ) == []
        assert await notify_student_event(
            db, school_id=context.school_id, student_ids={students[0].id},
            event_type=DomainEventType.student_absent,
            title="Attendance", body="Body", data={},
        ) == []

        relationship.can_receive_messages = True
        relationship.can_view_attendance = True
        relationship.is_active = False
        await db.flush()
        assert await notify_student_event(
            db, school_id=context.school_id, student_ids={students[0].id},
            event_type=DomainEventType.student_absent,
            title="Attendance", body="Body", data={},
        ) == []

        relationship.is_active = True
        membership.is_active = False
        await db.flush()
        assert await notify_student_event(
            db, school_id=context.school_id, student_ids={students[0].id},
            event_type=DomainEventType.result_published,
            title="Results", body="Body", data={},
        ) == []

        assert (await db.execute(select(func.count(Notification.id)))).scalar_one() == 0
        assert (await db.execute(select(func.count(NotificationOutbox.id)))).scalar_one() == 0


@pytest.mark.asyncio
async def test_student_event_rejects_cross_school_student_ids(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, _, _, students, _ = await _seed_parent_access(db)
        records = await notify_student_event(
            db, school_id=context.school_id, student_ids={students[2].id},
            event_type=DomainEventType.result_published,
            title="Results", body="Body", data={},
        )
        assert records == []
