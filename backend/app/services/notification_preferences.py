"""Tenant-scoped notification preference defaults and persistence."""

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import DomainEventType, NotificationPreference
from app.models.school_membership import MembershipRole, SchoolMembership
from app.services.notification_policy import get_notification_policy


MANDATORY_EVENTS = frozenset({DomainEventType.parent_linked})
# Push is relevant only after the user explicitly grants browser permission and
# subscribes a device. Preserve the existing event delivery defaults there;
# unimplemented external channels stay off.
DEFAULT_PUSH_EVENTS = frozenset(DomainEventType)


@dataclass(frozen=True)
class EffectiveNotificationPreference:
    event_type: DomainEventType
    in_app_enabled: bool
    push_enabled: bool
    email_enabled: bool
    sms_enabled: bool
    whatsapp_enabled: bool
    mandatory: bool


def default_preference(event_type: DomainEventType, role: MembershipRole) -> EffectiveNotificationPreference:
    policy = get_notification_policy(event_type)
    if role not in policy.eligible_roles:
        raise ValueError(f"Role {role.value} is not eligible for {event_type.value}")
    mandatory = event_type in MANDATORY_EVENTS
    return EffectiveNotificationPreference(
        event_type=event_type,
        in_app_enabled=True,
        push_enabled=mandatory or event_type in DEFAULT_PUSH_EVENTS,
        email_enabled=False,
        sms_enabled=False,
        whatsapp_enabled=False,
        mandatory=mandatory,
    )


def effective_preference(
    event_type: DomainEventType,
    role: MembershipRole,
    stored: NotificationPreference | None,
) -> EffectiveNotificationPreference:
    defaults = default_preference(event_type, role)
    if stored is None or defaults.mandatory:
        return defaults
    return EffectiveNotificationPreference(
        event_type=event_type,
        in_app_enabled=stored.in_app_enabled,
        push_enabled=stored.push_enabled,
        email_enabled=stored.email_enabled,
        sms_enabled=stored.sms_enabled,
        whatsapp_enabled=stored.whatsapp_enabled,
        mandatory=False,
    )


async def list_effective_preferences(
    db: AsyncSession, *, user_id: uuid.UUID, school_id: uuid.UUID, role: MembershipRole,
) -> list[EffectiveNotificationPreference]:
    stored = {
        row.event_type: row
        for row in (await db.execute(select(NotificationPreference).where(
            NotificationPreference.user_id == user_id,
            NotificationPreference.school_id == school_id,
        ))).scalars().all()
    }
    return [
        effective_preference(event_type, role, stored.get(event_type))
        for event_type in DomainEventType
        if role in get_notification_policy(event_type).eligible_roles
    ]


async def update_preference(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    school_id: uuid.UUID,
    role: MembershipRole,
    event_type: DomainEventType,
    values: dict[str, bool],
) -> EffectiveNotificationPreference:
    defaults = default_preference(event_type, role)
    if defaults.mandatory and any(values.get(field) is False for field in ("in_app_enabled", "push_enabled")):
        raise ValueError("Mandatory account notifications cannot be disabled")

    membership = (await db.execute(select(SchoolMembership.id).where(
        SchoolMembership.user_id == user_id,
        SchoolMembership.school_id == school_id,
        SchoolMembership.role == role,
        SchoolMembership.is_active.is_(True),
    ))).scalar_one_or_none()
    if membership is None:
        raise ValueError("Active school membership not found")

    stored = (await db.execute(select(NotificationPreference).where(
        NotificationPreference.user_id == user_id,
        NotificationPreference.school_id == school_id,
        NotificationPreference.event_type == event_type,
    ))).scalar_one_or_none()
    if stored is None:
        stored = NotificationPreference(
            user_id=user_id,
            school_id=school_id,
            event_type=event_type,
            in_app_enabled=defaults.in_app_enabled,
            push_enabled=defaults.push_enabled,
            email_enabled=defaults.email_enabled,
            sms_enabled=defaults.sms_enabled,
            whatsapp_enabled=defaults.whatsapp_enabled,
        )
        db.add(stored)
    for field, value in values.items():
        setattr(stored, field, value)
    await db.flush()
    return effective_preference(event_type, role, stored)
