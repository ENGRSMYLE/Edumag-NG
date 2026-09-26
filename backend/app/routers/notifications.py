import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.dependencies.auth import get_current_user
from app.config import settings
from app.models.notification import DomainEventType, Notification
from app.models.user import User
from app.schemas.notification import NotificationPage, NotificationResponse, NotificationUnreadCount
from app.schemas.push_subscription import (
    PushSubscriptionRequest,
    PushSubscriptionStatus,
    PushTestResponse,
    PushUnsubscribeRequest,
)
from app.services.notification_policy import build_push_payload
from app.services.notifications import emit_notifications
from app.services.push_subscriptions import (
    get_push_subscription_status,
    unsubscribe_push_subscription,
    upsert_push_subscription,
)
from app.utils.rate_limit import limiter

router = APIRouter(prefix="/notifications", tags=["notifications"])
def _scope(user: User): return (Notification.school_id == user.current_school_id, Notification.user_id == user.id)


@router.get("/push/status", response_model=PushSubscriptionStatus)
async def push_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PushSubscriptionStatus:
    subscribed, device_count = await get_push_subscription_status(
        db, user_id=user.id, school_id=user.current_school_id  # type: ignore[attr-defined]
    )
    return PushSubscriptionStatus(
        configured=settings.web_push_enabled,
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
    if not settings.web_push_enabled:
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
    return PushSubscriptionStatus(configured=True, subscribed=subscribed, device_count=device_count)


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
    return PushSubscriptionStatus(
        configured=settings.web_push_enabled,
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
    if not settings.web_push_enabled:
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
    )
    await db.commit()
    return PushTestResponse(message="Test notification queued", notification_id=str(notifications[0].id))

@router.get("", response_model=NotificationPage)
async def list_notifications(page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100), unread_only: bool = False, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    filters = list(_scope(user))
    if unread_only: filters.append(Notification.is_read.is_(False))
    total = (await db.execute(select(func.count(Notification.id)).where(*filters))).scalar_one()
    unread = (await db.execute(select(func.count(Notification.id)).where(*_scope(user), Notification.is_read.is_(False)))).scalar_one()
    items = list((await db.execute(select(Notification).where(*filters).order_by(Notification.created_at.desc()).offset((page - 1) * per_page).limit(per_page))).scalars().all())
    return NotificationPage(items=items, total=total, page=page, per_page=per_page, unread_count=unread)

@router.get("/unread-count", response_model=NotificationUnreadCount)
async def unread_count(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return NotificationUnreadCount(count=(await db.execute(select(func.count(Notification.id)).where(*_scope(user), Notification.is_read.is_(False)))).scalar_one())

@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_read(notification_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    item = (await db.execute(select(Notification).where(Notification.id == notification_id, *_scope(user)))).scalar_one_or_none()
    if item is None: raise HTTPException(status_code=404, detail="Notification not found")
    item.is_read = True; item.read_at = datetime.now(timezone.utc); await db.commit(); return item
