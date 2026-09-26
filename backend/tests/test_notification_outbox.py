import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.notification import DomainEventType, Notification, NotificationOutbox, OutboxStatus
from app.services.notification_outbox import claim_outbox_records, get_outbox_metrics, process_outbox_record, retry_delay
from app.services.notifications import emit_notifications
from app.services.push_channel import PushNotificationChannel
from app.services.push_subscriptions import upsert_push_subscription
from tests.test_parent_authorization import _seed_parent_access


def test_retry_delay_is_bounded_exponential() -> None:
    assert retry_delay(1, base_seconds=30, maximum_seconds=300) == timedelta(seconds=30)
    assert retry_delay(2, base_seconds=30, maximum_seconds=300) == timedelta(seconds=60)
    assert retry_delay(4, base_seconds=30, maximum_seconds=300) == timedelta(seconds=240)
    assert retry_delay(8, base_seconds=30, maximum_seconds=300) == timedelta(seconds=300)


@pytest.mark.asyncio
async def test_business_rollback_also_removes_notification_and_outbox(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, *_ = await _seed_parent_access(db)
        await emit_notifications(
            db, school_id=context.school_id, user_ids={context.user.id},
            event_type=DomainEventType.student_absent, title="Attendance", body="Update",
        )
        await db.rollback()
        assert (await db.execute(select(func.count(Notification.id)))).scalar_one() == 0
        assert (await db.execute(select(func.count(NotificationOutbox.id)))).scalar_one() == 0


@pytest.mark.asyncio
async def test_concurrent_claimers_cannot_claim_same_event(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, *_ = await _seed_parent_access(db)
        await emit_notifications(
            db, school_id=context.school_id, user_ids={context.user.id},
            event_type=DomainEventType.student_absent, title="Attendance", body="Update",
        )
        await db.commit()
    async with factory() as first, factory() as second:
        claim_time = datetime.now(timezone.utc) + timedelta(seconds=1)
        claimed = await asyncio.gather(
            claim_outbox_records(first, batch_size=1, now=claim_time),
            claim_outbox_records(second, batch_size=1, now=claim_time),
        )
    assert sum(len(items) for items in claimed) == 1
    assert len(set(claimed[0] + claimed[1])) == 1


@pytest.mark.asyncio
async def test_delivery_is_idempotent_and_stale_lease_is_recoverable(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, *_ = await _seed_parent_access(db)
        await upsert_push_subscription(
            db, user_id=context.user.id, school_id=context.school_id,
            endpoint="https://push.example/outbox", p256dh_key="key", auth_key="auth", commit=False,
        )
        await emit_notifications(
            db, school_id=context.school_id, user_ids={context.user.id},
            event_type=DomainEventType.student_absent, title="Attendance", body="Update",
        )
        await db.commit()
        school_id = context.school_id

    now = datetime.now(timezone.utc) + timedelta(seconds=1)
    async with factory() as db:
        first_claim = await claim_outbox_records(db, now=now)
        row = (await db.execute(select(NotificationOutbox))).scalar_one()
        row.locked_at = now - timedelta(minutes=10)
        await db.commit()
    async with factory() as db:
        recovered = await claim_outbox_records(db, now=now, lease_seconds=60)
    assert recovered == first_claim

    calls = 0
    def sender(**kwargs):
        nonlocal calls
        calls += 1
    channel = PushNotificationChannel(sender=sender, private_key="test-key")
    async with factory() as db:
        status = await process_outbox_record(db, recovered[0], channel=channel, now=now)
    async with factory() as db:
        duplicate = await process_outbox_record(db, recovered[0], channel=channel, now=now)
        row = (await db.execute(select(NotificationOutbox))).scalar_one()
        metrics = await get_outbox_metrics(db, school_id=school_id)
    assert status == OutboxStatus.delivered
    assert duplicate is None and calls == 1
    assert row.processed_at == now and row.attempt_count == 2
    assert metrics["pending_outbox_count"] == 0
    assert metrics["failed_delivery_count"] == 0
    assert metrics["active_subscription_count"] == 1
