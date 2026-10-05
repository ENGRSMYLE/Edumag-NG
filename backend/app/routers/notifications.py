import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.dependencies.auth import get_current_user
from app.dependencies.rbac import require_role
from app.config import settings
from app.models.notification import DomainEventType, Notification, NotificationOutbox, OutboxStatus
from app.models.school import School
from app.models.user import User
from app.schemas.notification import (
    NotificationPage,
    NotificationPreferenceList,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
    NotificationResponse,
    NotificationUnreadCount,
)
from app.schemas.push_subscription import (
    PushSubscriptionRequest,
    PushSubscriptionStatus,
    PushTestResponse,
    PushUnsubscribeRequest,
)
from app.services.notification_policy import build_push_payload
from app.services.notifications import emit_notifications
from app.services.notification_outbox import get_outbox_metrics, process_outbox_record
from app.services.notification_preferences import list_effective_preferences, update_preference
from app.services.push_subscriptions import (
    get_push_subscription_status,
    unsubscribe_push_subscription,
    upsert_push_subscription,
)
from app.utils.rate_limit import limiter

router = APIRouter(prefix="/notifications", tags=["notifications"])
def _scope(user: User): return (Notification.school_id == user.current_school_id, Notification.user_id == user.id)


async def _push_rollout_enabled(db: AsyncSession, school_id: uuid.UUID) -> bool:
    return bool((await db.execute(
        select(School.push_notifications_enabled).where(
            School.id == school_id,
            School.is_active.is_(True),
        )
    )).scalar_one_or_none())


def _push_status_response(
    *, school_enabled: bool, subscribed: bool, device_count: int
) -> PushSubscriptionStatus:
    server_configured = settings.web_push_enabled
    configured = server_configured and school_enabled
    return PushSubscriptionStatus(
        configured=configured,
        server_configured=server_configured,
        school_enabled=school_enabled,
        public_key=settings.WEB_PUSH_VAPID_PUBLIC_KEY if configured else None,
        subscribed=subscribed,
        device_count=device_count,
    )


@router.get("/operations")
async def notification_operations(
    user: User = Depends(require_role("super_admin", "admin")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Tenant-scoped delivery health; contains no endpoints or recipient data."""
    metrics = await get_outbox_metrics(db, school_id=user.current_school_id)  # type: ignore[attr-defined]
    return {
        **metrics,
        "oldest_pending_event": (
            metrics["oldest_pending_event"].isoformat()
            if metrics["oldest_pending_event"] else None
        ),
    }


@router.get("/push/status", response_model=PushSubscriptionStatus)
async def push_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PushSubscriptionStatus:
    subscribed, device_count = await get_push_subscription_status(
        db, user_id=user.id, school_id=user.current_school_id  # type: ignore[attr-defined]
    )
    return _push_status_response(
        school_enabled=await _push_rollout_enabled(db, user.current_school_id),  # type: ignore[attr-defined]
        subscribed=subscribed,
        device_count=device_count,
    )


@router.post("/push/subscribe", response_model=PushSubscriptionStatus)
@limiter.limit("10/minute")
async def subscribe_push(
    request: Request,
    body: PushSubscriptionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PushSubscriptionStatus:
    if not settings.web_push_enabled or not await _push_rollout_enabled(db, user.current_school_id):  # type: ignore[attr-defined]
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Web Push is not configured")
    await upsert_push_subscription(
        db,
        user_id=user.id,
        school_id=user.current_school_id,  # type: ignore[attr-defined]
        endpoint=body.endpoint,
        p256dh_key=body.keys.p256dh,
        auth_key=body.keys.auth,
        user_agent=request.headers.get("user-agent"),
        device_name=body.device_name,
    )
    subscribed, device_count = await get_push_subscription_status(
        db, user_id=user.id, school_id=user.current_school_id  # type: ignore[attr-defined]
    )
    return _push_status_response(
        school_enabled=True,
        subscribed=subscribed,
        device_count=device_count,
    )


@router.delete("/push/unsubscribe", response_model=PushSubscriptionStatus)
@limiter.limit("10/minute")
async def unsubscribe_push(
    request: Request,
    body: PushUnsubscribeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PushSubscriptionStatus:
    await unsubscribe_push_subscription(
        db,
        user_id=user.id,
        school_id=user.current_school_id,  # type: ignore[attr-defined]
        endpoint=body.endpoint,
    )
    subscribed, device_count = await get_push_subscription_status(
        db, user_id=user.id, school_id=user.current_school_id  # type: ignore[attr-defined]
    )
    return _push_status_response(
        school_enabled=await _push_rollout_enabled(db, user.current_school_id),  # type: ignore[attr-defined]
        subscribed=subscribed,
        device_count=device_count,
    )


@router.post("/push/test", response_model=PushTestResponse)
@limiter.limit("3/minute")
async def test_push(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PushTestResponse:
    if not settings.web_push_enabled or not await _push_rollout_enabled(db, user.current_school_id):  # type: ignore[attr-defined]
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Web Push is not configured")
    subscribed, _ = await get_push_subscription_status(
        db, user_id=user.id, school_id=user.current_school_id  # type: ignore[attr-defined]
    )
    if not subscribed:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No active push subscription")
    payload = build_push_payload(DomainEventType.announcement_published, user.current_role)  # type: ignore[attr-defined]
    notifications = await emit_notifications(
        db,
        school_id=user.current_school_id,  # type: ignore[attr-defined]
        user_ids={user.id},
        event_type=DomainEventType.announcement_published,
        title=payload.title,
        body=payload.body,
        data={"url": payload.url, "test": True},
        respect_preferences=False,
    )
    await db.flush()
    outbox = (await db.execute(
        select(NotificationOutbox).where(
            NotificationOutbox.notification_id == notifications[0].id,
        )
    )).scalar_one_or_none()
    if outbox is None:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Test notification could not be queued",
        )

    # A test action should report actual delivery, not merely confirm that an
    # outbox row exists. Lease this row before committing so a worker cannot
    # race the request and send the same test twice.
    outbox.status = OutboxStatus.processing
    outbox.locked_at = datetime.now(timezone.utc)
    outbox.attempt_count += 1
    await db.commit()
    delivery_status = await process_outbox_record(db, str(outbox.id))
    if delivery_status != OutboxStatus.delivered:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The push provider did not accept the test notification. Check the worker/API VAPID keys and try enabling this device again.",
        )
    return PushTestResponse(
        message="Test notification sent",
        notification_id=str(notifications[0].id),
        delivery_status=delivery_status.value,
    )

@router.get("", response_model=NotificationPage)
async def list_notifications(page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100), unread_only: bool = False, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    filters = [*_scope(user), Notification.is_in_app_visible.is_(True)]
    if unread_only: filters.append(Notification.is_read.is_(False))
    total = (await db.execute(select(func.count(Notification.id)).where(*filters))).scalar_one()
    unread = (await db.execute(select(func.count(Notification.id)).where(*_scope(user), Notification.is_in_app_visible.is_(True), Notification.is_read.is_(False)))).scalar_one()
    items = list((await db.execute(select(Notification).where(*filters).order_by(Notification.created_at.desc()).offset((page - 1) * per_page).limit(per_page))).scalars().all())
    return NotificationPage(items=items, total=total, page=page, per_page=per_page, unread_count=unread)

@router.get("/unread-count", response_model=NotificationUnreadCount)
async def unread_count(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return NotificationUnreadCount(count=(await db.execute(select(func.count(Notification.id)).where(*_scope(user), Notification.is_in_app_visible.is_(True), Notification.is_read.is_(False)))).scalar_one())


@router.get("/preferences", response_model=NotificationPreferenceList)
async def get_preferences(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationPreferenceList:
    items = await list_effective_preferences(
        db,
        user_id=user.id,
        school_id=user.current_school_id,  # type: ignore[attr-defined]
        role=user.current_role,  # type: ignore[attr-defined]
    )
    return NotificationPreferenceList(items=[NotificationPreferenceResponse(**item.__dict__) for item in items])


@router.patch("/preferences/{event_type}", response_model=NotificationPreferenceResponse)
async def patch_preference(
    event_type: DomainEventType,
    body: NotificationPreferenceUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationPreferenceResponse:
    values = body.model_dump(exclude_none=True)
    if not values:
        raise HTTPException(status_code=422, detail="Provide at least one preference")
    try:
        item = await update_preference(
            db,
            user_id=user.id,
            school_id=user.current_school_id,  # type: ignore[attr-defined]
            role=user.current_role,  # type: ignore[attr-defined]
            event_type=event_type,
            values=values,
        )
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    await db.commit()
    return NotificationPreferenceResponse(**item.__dict__)

@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_read(notification_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    item = (await db.execute(select(Notification).where(Notification.id == notification_id, Notification.is_in_app_visible.is_(True), *_scope(user)))).scalar_one_or_none()
    if item is None: raise HTTPException(status_code=404, detail="Notification not found")
    item.is_read = True; item.read_at = datetime.now(timezone.utc); await db.commit(); return item
