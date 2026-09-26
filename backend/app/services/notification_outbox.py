"""Transactional notification outbox claiming and processing."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.notification import Notification, NotificationChannel, NotificationOutbox, OutboxStatus
from app.models.push_subscription import PushSubscription
from app.services.push_channel import DeliveryDisposition, PushDeliveryResult, PushNotificationChannel, deliver_notification_push


def retry_delay(attempt_count: int, *, base_seconds: int, maximum_seconds: int) -> timedelta:
    exponent = max(attempt_count - 1, 0)
    return timedelta(seconds=min(base_seconds * (2 ** exponent), maximum_seconds))


async def get_outbox_metrics(db: AsyncSession, *, school_id=None) -> dict:
    notification_scope = []
    subscription_scope = []
    if school_id is not None:
        notification_scope.append(Notification.school_id == school_id)
        subscription_scope.append(PushSubscription.school_id == school_id)

    pending_filter = NotificationOutbox.status.in_([
        OutboxStatus.pending, OutboxStatus.retry, OutboxStatus.processing,
    ])
    pending_query = select(func.count(NotificationOutbox.id), func.min(NotificationOutbox.created_at)).join(
        Notification, Notification.id == NotificationOutbox.notification_id,
    ).where(pending_filter, *notification_scope)
    pending_count, oldest_pending = (await db.execute(pending_query)).one()
    failed_count = (await db.execute(
        select(func.count(NotificationOutbox.id)).join(
            Notification, Notification.id == NotificationOutbox.notification_id,
        ).where(NotificationOutbox.status == OutboxStatus.failed, *notification_scope)
    )).scalar_one()
    active_subscriptions = (await db.execute(
        select(func.count(PushSubscription.id)).where(
            PushSubscription.is_active.is_(True), *subscription_scope,
        )
    )).scalar_one()
    total_subscriptions = (await db.execute(
        select(func.count(PushSubscription.id)).where(*subscription_scope)
    )).scalar_one()
    expired_subscriptions = (await db.execute(
        select(func.count(PushSubscription.id)).where(
            PushSubscription.is_active.is_(False),
            PushSubscription.last_failure_at.is_not(None),
            *subscription_scope,
        )
    )).scalar_one()
    terminal_rows = (await db.execute(
        select(NotificationOutbox.status, NotificationOutbox.created_at, NotificationOutbox.processed_at)
        .join(Notification, Notification.id == NotificationOutbox.notification_id)
        .where(
            NotificationOutbox.status.in_([OutboxStatus.delivered, OutboxStatus.failed]),
            *notification_scope,
        )
    )).all()
    delivered_count = sum(row.status == OutboxStatus.delivered for row in terminal_rows)
    terminal_count = len(terminal_rows)
    latencies = [
        (row.processed_at - row.created_at).total_seconds()
        for row in terminal_rows
        if row.processed_at is not None
    ]
    return {
        "pending_outbox_count": pending_count,
        "failed_delivery_count": failed_count,
        "oldest_pending_event": oldest_pending,
        "active_subscription_count": active_subscriptions,
        "total_subscription_count": total_subscriptions,
        "subscription_active_rate": round(active_subscriptions / total_subscriptions, 4) if total_subscriptions else None,
        "expired_subscription_count": expired_subscriptions,
        "expired_subscription_rate": round(expired_subscriptions / total_subscriptions, 4) if total_subscriptions else None,
        "delivered_outbox_count": delivered_count,
        "delivery_success_rate": round(delivered_count / terminal_count, 4) if terminal_count else None,
        "average_worker_latency_seconds": round(sum(latencies) / len(latencies), 3) if latencies else None,
        # These require explicit, consent-aware browser analytics and are not
        # inferred from delivery data.
        "permission_denied_rate": None,
        "notification_click_through_rate": None,
    }


async def claim_outbox_records(
    db: AsyncSession,
    *,
    batch_size: int | None = None,
    lease_seconds: int | None = None,
    max_attempts: int | None = None,
    now: datetime | None = None,
) -> list[str]:
    """Atomically lease claimable rows using PostgreSQL SKIP LOCKED."""
    current = now or datetime.now(timezone.utc)
    lease_cutoff = current - timedelta(seconds=lease_seconds or settings.PUSH_OUTBOX_LEASE_SECONDS)
    maximum = max_attempts or settings.PUSH_OUTBOX_MAX_ATTEMPTS
    claimable = or_(
        and_(
            NotificationOutbox.status.in_([OutboxStatus.pending, OutboxStatus.retry]),
            NotificationOutbox.available_at <= current,
        ),
        and_(
            NotificationOutbox.status == OutboxStatus.processing,
            NotificationOutbox.locked_at < lease_cutoff,
        ),
    )
    rows = list((await db.execute(
        select(NotificationOutbox)
        .where(
            NotificationOutbox.channel == NotificationChannel.push,
            NotificationOutbox.attempt_count < maximum,
            claimable,
        )
        .order_by(NotificationOutbox.available_at, NotificationOutbox.created_at)
        .with_for_update(skip_locked=True)
        .limit(batch_size or settings.PUSH_OUTBOX_BATCH_SIZE)
    )).scalars().all())
    for row in rows:
        row.status = OutboxStatus.processing
        row.locked_at = current
        row.attempt_count += 1
        row.last_error = None
    await db.commit()
    return [str(row.id) for row in rows]


def _summarize_failure(results: list[PushDeliveryResult]) -> str:
    failures = [result for result in results if result.disposition != DeliveryDisposition.success]
    if not failures:
        return ""
    # Store only bounded classifications, never provider text, endpoints, or secrets.
    summary = ",".join(
        f"{result.disposition.value}:{result.status_code or result.error_type or 'unknown'}"
        for result in failures[:10]
    )
    return summary[:1000]


async def process_outbox_record(
    db: AsyncSession,
    outbox_id: str,
    *,
    channel: PushNotificationChannel | None = None,
    now: datetime | None = None,
    max_attempts: int | None = None,
    base_retry_seconds: int | None = None,
    max_retry_seconds: int | None = None,
) -> OutboxStatus | None:
    current = now or datetime.now(timezone.utc)
    row = (await db.execute(
        select(NotificationOutbox).where(NotificationOutbox.id == outbox_id).with_for_update()
    )).scalar_one_or_none()
    if row is None or row.status != OutboxStatus.processing:
        return None
    notification = (await db.execute(
        select(Notification).where(Notification.id == row.notification_id)
    )).scalar_one_or_none()
    if notification is None:
        row.status = OutboxStatus.failed
        row.last_error = "notification_missing"
        row.locked_at = None
        await db.commit()
        return row.status

    try:
        results = await deliver_notification_push(db, notification, channel=channel, commit=False)
        retryable = any(result.retryable for result in results)
        non_expiry_permanent = any(
            result.disposition == DeliveryDisposition.permanent_failure
            and result.status_code not in {404, 410}
            for result in results
        )
        maximum = max_attempts or settings.PUSH_OUTBOX_MAX_ATTEMPTS
        if retryable and row.attempt_count < maximum:
            row.status = OutboxStatus.retry
            row.available_at = current + retry_delay(
                row.attempt_count,
                base_seconds=base_retry_seconds or settings.PUSH_OUTBOX_BASE_RETRY_SECONDS,
                maximum_seconds=max_retry_seconds or settings.PUSH_OUTBOX_MAX_RETRY_SECONDS,
            )
            row.last_error = _summarize_failure(results)
        elif retryable or non_expiry_permanent:
            row.status = OutboxStatus.failed
            row.last_error = _summarize_failure(results)
        else:
            # No devices and expired devices are terminal successful processing:
            # there is nothing retryable left to deliver.
            row.status = OutboxStatus.delivered
            row.processed_at = current
            row.last_error = _summarize_failure(results) or None
    except Exception as error:
        maximum = max_attempts or settings.PUSH_OUTBOX_MAX_ATTEMPTS
        row.last_error = type(error).__name__[:1000]
        if row.attempt_count >= maximum:
            row.status = OutboxStatus.failed
        else:
            row.status = OutboxStatus.retry
            row.available_at = current + retry_delay(
                row.attempt_count,
                base_seconds=base_retry_seconds or settings.PUSH_OUTBOX_BASE_RETRY_SECONDS,
                maximum_seconds=max_retry_seconds or settings.PUSH_OUTBOX_MAX_RETRY_SECONDS,
            )
    finally:
        row.locked_at = None
        await db.commit()
    return row.status


async def run_outbox_batch(
    *,
    session_factory: async_sessionmaker[AsyncSession] = AsyncSessionLocal,
    channel: PushNotificationChannel | None = None,
) -> int:
    async with session_factory() as claim_session:
        claimed = await claim_outbox_records(claim_session)
    for outbox_id in claimed:
        # A separate transaction per record prevents one provider/device issue
        # from rolling back other outbox state.
        async with session_factory() as record_session:
            await process_outbox_record(record_session, outbox_id, channel=channel)
    return len(claimed)
