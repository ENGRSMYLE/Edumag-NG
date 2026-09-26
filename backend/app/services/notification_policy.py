"""Central notification delivery, privacy, and recipient policies.

This module deliberately contains no provider-specific push code. Delivery
adapters must build lock-screen payloads through :func:`build_push_payload`
instead of copying the richer in-app notification body or data.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.guardian import GuardianProfile, GuardianStatus, StudentGuardian
from app.models.notification import DomainEventType
from app.models.school_membership import MembershipRole, SchoolMembership
from app.models.student import Student
from app.models.user import User


ALL_ROLES = frozenset(MembershipRole)


@dataclass(frozen=True)
class NotificationPolicy:
    eligible_roles: frozenset[MembershipRole]
    relationship_permission: str | None
    push_title: str
    push_body: str
    destinations: dict[MembershipRole, str]
    default_enabled: bool = True


@dataclass(frozen=True)
class SafePushPayload:
    title: str
    body: str
    url: str
    event_type: str


_COMMUNICATION_ROUTES = {
    MembershipRole.super_admin: "/dashboard/super-admin/announcements",
    MembershipRole.admin: "/dashboard/admin/communication",
    MembershipRole.teacher: "/dashboard/staff/communication",
    MembershipRole.parent: "/dashboard/parent/communication",
}


NOTIFICATION_POLICIES: dict[DomainEventType, NotificationPolicy] = {
    DomainEventType.parent_linked: NotificationPolicy(
        eligible_roles=frozenset({MembershipRole.parent}),
        relationship_permission=None,
        push_title="Parent access updated",
        push_body="A child relationship is available in your school portal.",
        destinations={MembershipRole.parent: "/dashboard/parent/children"},
    ),
    DomainEventType.message_received: NotificationPolicy(
        eligible_roles=ALL_ROLES,
        relationship_permission="can_receive_messages",
        push_title="New school message",
        push_body="You have a new message in your school portal.",
        destinations=_COMMUNICATION_ROUTES,
    ),
    DomainEventType.result_published: NotificationPolicy(
        eligible_roles=frozenset({MembershipRole.parent}),
        relationship_permission="can_view_results",
        push_title="New academic result",
        push_body="A new approved result is available in the parent portal.",
        destinations={MembershipRole.parent: "/dashboard/parent/results"},
    ),
    DomainEventType.student_absent: NotificationPolicy(
        eligible_roles=frozenset({MembershipRole.parent}),
        relationship_permission="can_view_attendance",
        push_title="Attendance update",
        push_body="A new attendance update is available in the parent portal.",
        destinations={MembershipRole.parent: "/dashboard/parent/attendance"},
    ),
    DomainEventType.assignment_created: NotificationPolicy(
        eligible_roles=frozenset({MembershipRole.parent}),
        relationship_permission="can_view_assignments",
        push_title="New assignment",
        push_body="A new assignment is available in the parent portal.",
        destinations={MembershipRole.parent: "/dashboard/parent/assignments"},
    ),
    DomainEventType.fee_reminder: NotificationPolicy(
        eligible_roles=frozenset({MembershipRole.parent}),
        relationship_permission="can_view_finance",
        push_title="Finance update",
        push_body="A finance update is available in the parent portal.",
        destinations={MembershipRole.parent: "/dashboard/parent/finance"},
    ),
    DomainEventType.announcement_published: NotificationPolicy(
        eligible_roles=ALL_ROLES,
        relationship_permission=None,
        push_title="New school announcement",
        push_body="A new announcement is available in your school portal.",
        destinations={
            **_COMMUNICATION_ROUTES,
            MembershipRole.parent: "/dashboard/parent",
        },
    ),
}


def get_notification_policy(event_type: DomainEventType) -> NotificationPolicy:
    return NOTIFICATION_POLICIES[event_type]


def build_push_payload(event_type: DomainEventType, role: MembershipRole) -> SafePushPayload:
    """Return a fixed, privacy-safe payload for a role and event.

    Rich notification bodies, scores, balances, student names, and message
    excerpts are intentionally not accepted as arguments.
    """
    policy = get_notification_policy(event_type)
    if role not in policy.eligible_roles or role not in policy.destinations:
        raise ValueError(f"Role {role.value} is not eligible for {event_type.value}")
    return SafePushPayload(
        title=policy.push_title,
        body=policy.push_body,
        url=policy.destinations[role],
        event_type=event_type.value,
    )


async def resolve_guardian_recipients_for_student(
    db: AsyncSession,
    *,
    school_id: uuid.UUID,
    student_id: uuid.UUID,
    event_type: DomainEventType,
) -> set[uuid.UUID]:
    """Resolve active, authorized parent users for a student event."""
    policy = get_notification_policy(event_type)
    permission = policy.relationship_permission
    if MembershipRole.parent not in policy.eligible_roles or permission is None:
        raise ValueError(f"{event_type.value} is not a student relationship event")
    permission_column = getattr(StudentGuardian, permission, None)
    if permission_column is None:
        raise ValueError(f"Unsupported guardian permission: {permission}")

    now = datetime.now(timezone.utc)
    query = (
        select(User.id)
        .join(SchoolMembership, SchoolMembership.user_id == User.id)
        .join(
            GuardianProfile,
            (GuardianProfile.membership_id == SchoolMembership.id)
            & (GuardianProfile.school_id == SchoolMembership.school_id),
        )
        .join(
            StudentGuardian,
            (StudentGuardian.guardian_profile_id == GuardianProfile.id)
            & (StudentGuardian.school_id == GuardianProfile.school_id),
        )
        .join(
            Student,
            (Student.id == StudentGuardian.student_id)
            & (Student.school_id == StudentGuardian.school_id),
        )
        .where(
            Student.id == student_id,
            Student.school_id == school_id,
            Student.is_active.is_(True),
            StudentGuardian.school_id == school_id,
            StudentGuardian.is_active.is_(True),
            or_(StudentGuardian.starts_at.is_(None), StudentGuardian.starts_at <= now),
            or_(StudentGuardian.ends_at.is_(None), StudentGuardian.ends_at >= now),
            permission_column.is_(True),
            GuardianProfile.status == GuardianStatus.active,
            SchoolMembership.school_id == school_id,
            SchoolMembership.role == MembershipRole.parent,
            SchoolMembership.is_active.is_(True),
            User.is_active.is_(True),
        )
        .distinct()
    )
    return set((await db.execute(query)).scalars().all())
