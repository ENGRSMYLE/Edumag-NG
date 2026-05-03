import uuid

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.school_membership import SchoolMembership
from app.models.user import User
from app.utils.security import decode_token


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    # Cookie takes priority, then Authorization: Bearer header
    raw_token: str | None = request.cookies.get("access_token")
    if not raw_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            raw_token = auth_header.removeprefix("Bearer ")

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(raw_token)

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_raw = payload.get("sub")
    school_id_raw = payload.get("school_id")
    membership_id_raw = payload.get("membership_id")

    if not user_id_raw or not school_id_raw or not membership_id_raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token",
        )

    try:
        user_id = uuid.UUID(str(user_id_raw))
        school_id = uuid.UUID(str(school_id_raw))
        membership_id = uuid.UUID(str(membership_id_raw))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token",
        )

    # Single query — load user and verify membership in one round-trip
    result = await db.execute(
        select(User, SchoolMembership)
        .join(
            SchoolMembership,
            (SchoolMembership.user_id == User.id)
            & (SchoolMembership.id == membership_id)
            & (SchoolMembership.school_id == school_id),
        )
        .where(
            User.id == user_id,
            User.is_active.is_(True),
            SchoolMembership.is_active.is_(True),
        )
    )
    row = result.first()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session",
        )

    user, membership = row

    # Attach membership context as dynamic attributes for use in all routers
    user.current_school_id = membership.school_id      # type: ignore[attr-defined]
    user.current_role = membership.role                # type: ignore[attr-defined]
    user.current_membership_id = membership.id         # type: ignore[attr-defined]
    user.current_class_id = membership.class_id        # type: ignore[attr-defined]

    return user
