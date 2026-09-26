import uuid
from datetime import datetime, timezone

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.communication import TargetAudience
from app.models.guardian import GuardianProfile, GuardianStatus, StudentGuardian
from app.models.notification import DomainEventType, Notification, NotificationChannel, NotificationOutbox, NotificationPreference, OutboxStatus
from app.models.school_membership import MembershipRole, SchoolMembership
from app.models.school import School
from app.models.user import User
from app.services.notification_policy import (
    resolve_guardian_recipients_for_students,
)
from app.services.notification_preferences import effective_preference

async def emit_notifications(db: AsyncSession, *, school_id: uuid.UUID, user_ids: set[uuid.UUID], event_type: DomainEventType, title: str, body: str, data: dict | None = None, respect_preferences: bool = True) -> list[Notification]:
    """Stage in-app notifications and durable delivery events in the caller's transaction."""
    records = []
    if not user_ids:
        return records
    push_rollout_enabled = bool((await db.execute(
        select(School.push_notifications_enabled).where(School.id == school_id)
    )).scalar_one_or_none())
    memberships = {
        row.user_id: row.role
        for row in (await db.execute(select(SchoolMembership).where(
            SchoolMembership.school_id == school_id,
            SchoolMembership.user_id.in_(user_ids),
            SchoolMembership.is_active.is_(True),
        ))).scalars().all()
    }
    preferences = {
        row.user_id: row
        for row in (await db.execute(select(NotificationPreference).where(
            NotificationPreference.school_id == school_id,
            NotificationPreference.user_id.in_(user_ids),
            NotificationPreference.event_type == event_type,
        ))).scalars().all()
    } if respect_preferences else {}
    for user_id in user_ids:
        role = memberships.get(user_id)
        if role is None:
            continue
        preference = effective_preference(event_type, role, preferences.get(user_id))
        in_app_enabled = preference.in_app_enabled if respect_preferences else True
        push_enabled = (preference.push_enabled if respect_preferences else True) and push_rollout_enabled
        if not in_app_enabled and not push_enabled:
            continue
        notification = Notification(school_id=school_id, user_id=user_id, event_type=event_type, title=title, body=body, data=data or {}, is_in_app_visible=in_app_enabled)
        db.add(notification)
        await db.flush()
        if push_enabled:
            db.add(NotificationOutbox(
                notification_id=notification.id,
                channel=NotificationChannel.push,
                status=OutboxStatus.pending,
                event_type=event_type,
                payload={"notification_id": str(notification.id), "user_id": str(user_id), **(data or {})},
            ))
        records.append(notification)
    return records


async def _active_school_users(
    db: AsyncSession,
    *,
    school_id: uuid.UUID,
    user_ids: set[uuid.UUID] | None = None,
    roles: set[MembershipRole] | None = None,
) -> set[uuid.UUID]:
    filters = [
        SchoolMembership.school_id == school_id,
        SchoolMembership.is_active.is_(True),
        User.is_active.is_(True),
    ]
    if user_ids is not None:
        if not user_ids:
            return set()
        filters.append(User.id.in_(user_ids))
    if roles is not None:
        filters.append(SchoolMembership.role.in_(roles))
    query = select(User.id).join(SchoolMembership, SchoolMembership.user_id == User.id).where(*filters).distinct()
    return set((await db.execute(query)).scalars().all())


async def _active_parent_users_with_relationship(
    db: AsyncSession,
    *,
    school_id: uuid.UUID,
    permission: str | None = None,
    user_ids: set[uuid.UUID] | None = None,
) -> set[uuid.UUID]:
    now = datetime.now(timezone.utc)
    filters = [
        SchoolMembership.school_id == school_id,
        SchoolMembership.role == MembershipRole.parent,
        SchoolMembership.is_active.is_(True),
        User.is_active.is_(True),
        GuardianProfile.school_id == school_id,
        GuardianProfile.status == GuardianStatus.active,
        StudentGuardian.school_id == school_id,
        StudentGuardian.is_active.is_(True),
        or_(StudentGuardian.starts_at.is_(None), StudentGuardian.starts_at <= now),
        or_(StudentGuardian.ends_at.is_(None), StudentGuardian.ends_at >= now),
    ]
    if permission:
        column = getattr(StudentGuardian, permission, None)
        if column is None:
            raise ValueError(f"Unsupported guardian permission: {permission}")
        filters.append(column.is_(True))
    if user_ids is not None:
        if not user_ids:
            return set()
        filters.append(User.id.in_(user_ids))
    query = (
        select(User.id)
        .join(SchoolMembership, SchoolMembership.user_id == User.id)
        .join(GuardianProfile, GuardianProfile.membership_id == SchoolMembership.id)
        .join(StudentGuardian, StudentGuardian.guardian_profile_id == GuardianProfile.id)
        .where(*filters)
        .distinct()
    )
    return set((await db.execute(query)).scalars().all())


async def notify_message_received(
    db: AsyncSession, *, school_id: uuid.UUID, recipient_ids: set[uuid.UUID],
    title: str, body: str, data: dict,
) -> list[Notification]:
    active = await _active_school_users(db, school_id=school_id, user_ids=recipient_ids)
    parent_candidates = set((await db.execute(select(SchoolMembership.user_id).where(
        SchoolMembership.school_id == school_id,
        SchoolMembership.user_id.in_(active),
        SchoolMembership.role == MembershipRole.parent,
    ))).scalars().all()) if active else set()
    eligible_parents = await _active_parent_users_with_relationship(
        db, school_id=school_id, permission="can_receive_messages", user_ids=parent_candidates,
    )
    eligible = (active - parent_candidates) | eligible_parents
    return await emit_notifications(
        db, school_id=school_id, user_ids=eligible,
        event_type=DomainEventType.message_received, title=title, body=body, data=data,
    )


async def notify_announcement_published(
    db: AsyncSession, *, school_id: uuid.UUID, audience: TargetAudience,
    sender_id: uuid.UUID, title: str, body: str, data: dict,
) -> list[Notification]:
    roles = {
        TargetAudience.all: set(MembershipRole),
        TargetAudience.admin: {MembershipRole.admin, MembershipRole.super_admin},
        TargetAudience.teacher: {MembershipRole.teacher},
    }[audience]
    recipients = await _active_school_users(db, school_id=school_id, roles=roles)
    if MembershipRole.parent in roles:
        parent_ids = await _active_parent_users_with_relationship(db, school_id=school_id)
        parent_candidates = set((await db.execute(select(SchoolMembership.user_id).where(
            SchoolMembership.school_id == school_id,
            SchoolMembership.user_id.in_(recipients),
            SchoolMembership.role == MembershipRole.parent,
        ))).scalars().all()) if recipients else set()
        recipients = (recipients - parent_candidates) | parent_ids
    recipients.discard(sender_id)
    return await emit_notifications(
        db, school_id=school_id, user_ids=recipients,
        event_type=DomainEventType.announcement_published, title=title, body=body, data=data,
    )


async def notify_student_event(
    db: AsyncSession, *, school_id: uuid.UUID, student_ids: set[uuid.UUID],
    event_type: DomainEventType, title: str, body: str, data: dict,
) -> list[Notification]:
    if event_type not in {
        DomainEventType.student_absent, DomainEventType.assignment_created,
        DomainEventType.result_published, DomainEventType.fee_reminder,
    }:
        raise ValueError(f"{event_type.value} is not a supported student event")
    recipients = await resolve_guardian_recipients_for_students(
        db, school_id=school_id, student_ids=student_ids, event_type=event_type,
    )
    return await emit_notifications(
        db, school_id=school_id, user_ids=recipients,
        event_type=event_type, title=title, body=body, data=data,
    )
