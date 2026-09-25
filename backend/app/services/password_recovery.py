import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.audit_event import AuditEvent
from app.models.password_reset import PasswordResetAttempt, PasswordResetToken
from app.models.refresh_token import RefreshToken
from app.models.school_membership import SchoolMembership
from app.models.user import User
from app.utils.identity import normalize_email
from app.utils.security import hash_password, hash_token


@dataclass(frozen=True)
class PasswordResetEmailTask:
    to_email: str
    to_name: str
    reset_link: str


async def _audit_for_memberships(
    db: AsyncSession, user_id, event_type: str, **event_data
) -> None:
    memberships = list((await db.execute(
        select(SchoolMembership).where(SchoolMembership.user_id == user_id)
    )).scalars().all())
    for membership in memberships:
        db.add(AuditEvent(
            school_id=membership.school_id,
            actor_user_id=user_id,
            event_type=event_type,
            target_type="user",
            target_id=user_id,
            event_data=event_data,
        ))


async def request_password_reset(
    db: AsyncSession, *, email: str, requester_ip: str
) -> PasswordResetEmailTask | None:
    normalized_email = normalize_email(email)
    identity_hash = hash_token(normalized_email)
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(hours=1)

    identity_count = (await db.execute(
        select(func.count(PasswordResetAttempt.id)).where(
            PasswordResetAttempt.identity_hash == identity_hash,
            PasswordResetAttempt.created_at >= window_start,
        )
    )).scalar_one()
    ip_count = (await db.execute(
        select(func.count(PasswordResetAttempt.id)).where(
            PasswordResetAttempt.requester_ip == requester_ip,
            PasswordResetAttempt.created_at >= window_start,
        )
    )).scalar_one()
    if identity_count >= 3 or ip_count >= 10:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many requests")

    db.add(PasswordResetAttempt(identity_hash=identity_hash, requester_ip=requester_ip))
    user = (await db.execute(
        select(User).where(func.lower(func.trim(User.email)) == normalized_email)
    )).scalar_one_or_none()

    email_task = None
    if user is not None and user.is_active:
        # Only the newest reset link remains usable.
        await db.execute(
            update(PasswordResetToken)
            .where(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None))
            .values(used_at=now)
        )
        raw_token = secrets.token_urlsafe(48)
        db.add(PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            expires_at=now + timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES),
        ))
        await _audit_for_memberships(db, user.id, "password_reset_requested", requester_ip=requester_ip)
        email_task = PasswordResetEmailTask(
            to_email=user.email,
            to_name=user.name,
            reset_link=f"{settings.FRONTEND_URL}/reset-password?token={raw_token}",
        )

    await db.commit()
    return email_task


async def reset_password(
    db: AsyncSession, *, raw_token: str, new_password: str
) -> None:
    now = datetime.now(timezone.utc)
    token = (await db.execute(
        select(PasswordResetToken)
        .where(PasswordResetToken.token_hash == hash_token(raw_token))
        .with_for_update()
    )).scalar_one_or_none()
    if token is None or token.used_at is not None or token.expires_at.replace(tzinfo=timezone.utc) <= now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token",
        )

    user = (await db.execute(select(User).where(User.id == token.user_id))).scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    user.password_hash = hash_password(new_password)
    user.is_first_login = False
    token.used_at = now
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked.is_(False))
        .values(revoked=True)
    )
    await _audit_for_memberships(db, user.id, "password_reset_completed", sessions_revoked=True)
    await db.commit()
