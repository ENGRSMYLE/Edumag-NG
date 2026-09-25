import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationPage, NotificationResponse, NotificationUnreadCount

router = APIRouter(prefix="/notifications", tags=["notifications"])
def _scope(user: User): return (Notification.school_id == user.current_school_id, Notification.user_id == user.id)

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
