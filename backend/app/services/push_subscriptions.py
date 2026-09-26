import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.push_subscription import PushSubscription
from app.models.school import School
from app.models.school_membership import SchoolMembership
from app.models.user import User


def _conflict(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


async def _require_active_membership(
    db: AsyncSession, *, user_id: uuid.UUID, school_id: uuid.UUID
) -> None:
    membership = (await db.execute(
        select(SchoolMembership.id)
        .join(User, User.id == SchoolMembership.user_id)
        .join(School, School.id == SchoolMembership.school_id)
        .where(
            SchoolMembership.user_id == user_id,
            SchoolMembership.school_id == school_id,
            SchoolMembership.is_active.is_(True),
            User.is_active.is_(True),
            School.is_active.is_(True),
        )
    )).scalar_one_or_none()
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Active school membership is required")


async def upsert_push_subscription(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    school_id: uuid.UUID,
    endpoint: str,
    p256dh_key: str,
    auth_key: str,
    user_agent: str | None = None,
    device_name: str | None = None,
    commit: bool = True,
) -> PushSubscription:
    await _require_active_membership(db, user_id=user_id, school_id=school_id)
    existing = (await db.execute(
        select(PushSubscription)
        .where(PushSubscription.endpoint == endpoint)
        .with_for_update()
    )).scalar_one_or_none()

    if existing is not None:
        if existing.user_id != user_id:
            raise _conflict("This push subscription belongs to another user")
        if existing.school_id != school_id:
            raise _conflict("This push subscription belongs to another school context")
        existing.p256dh_key = p256dh_key
        existing.auth_key = auth_key
        existing.user_agent = user_agent
        existing.device_name = device_name
        existing.is_active = True
        existing.failure_count = 0
        subscription = existing
    else:
        subscription = PushSubscription(
            user_id=user_id,
            school_id=school_id,
            endpoint=endpoint,
            p256dh_key=p256dh_key,
            auth_key=auth_key,
            user_agent=user_agent,
            device_name=device_name,
        )
        db.add(subscription)

    if commit:
        await db.commit()
        await db.refresh(subscription)
    else:
        await db.flush()
    return subscription
