import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.notification import DomainEventType
from app.models.school_membership import MembershipRole
from app.services.notification_policy import (
    NOTIFICATION_POLICIES,
    build_push_payload,
    resolve_guardian_recipients_for_student,
)
from tests.test_parent_authorization import _seed_parent_access


def test_every_event_has_a_complete_privacy_policy() -> None:
    assert set(NOTIFICATION_POLICIES) == set(DomainEventType)
    for event_type, policy in NOTIFICATION_POLICIES.items():
        assert policy.eligible_roles
        assert policy.push_title.strip()
        assert policy.push_body.strip()
        assert set(policy.destinations) == set(policy.eligible_roles)
        for route in policy.destinations.values():
            assert route.startswith("/dashboard/")
            assert ":" not in route and "//" not in route
        payload = build_push_payload(event_type, next(iter(policy.eligible_roles)))
        assert payload.event_type == event_type.value
        assert payload.url.startswith("/dashboard/")


def test_push_payloads_are_generic_and_do_not_accept_sensitive_content() -> None:
    payloads = [
        build_push_payload(event_type, role)
        for event_type, policy in NOTIFICATION_POLICIES.items()
        for role in policy.eligible_roles
    ]
    combined = " ".join(f"{item.title} {item.body}" for item in payloads).lower()
    for sensitive_term in ("score", "balance", "amount", "message body", "student name"):
        assert sensitive_term not in combined

    with pytest.raises(TypeError):
        build_push_payload(  # type: ignore[call-arg]
            DomainEventType.message_received,
            MembershipRole.parent,
            body="Private message contents",
        )


@pytest.mark.asyncio
async def test_guardian_recipient_resolution_enforces_tenant_status_and_permission(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, membership, _, students, relationship = await _seed_parent_access(db)

        allowed = await resolve_guardian_recipients_for_student(
            db,
            school_id=context.school_id,
            student_id=students[0].id,
            event_type=DomainEventType.result_published,
        )
        assert allowed == {context.user.id}

        denied_finance = await resolve_guardian_recipients_for_student(
            db,
            school_id=context.school_id,
            student_id=students[0].id,
            event_type=DomainEventType.fee_reminder,
        )
        assert denied_finance == set()

        cross_school = await resolve_guardian_recipients_for_student(
            db,
            school_id=context.school_id,
            student_id=students[2].id,
            event_type=DomainEventType.result_published,
        )
        assert cross_school == set()

        relationship.is_active = False
        await db.commit()
        assert await resolve_guardian_recipients_for_student(
            db,
            school_id=context.school_id,
            student_id=students[0].id,
            event_type=DomainEventType.result_published,
        ) == set()

        relationship.is_active = True
        membership.is_active = False
        await db.commit()
        assert await resolve_guardian_recipients_for_student(
            db,
            school_id=context.school_id,
            student_id=students[0].id,
            event_type=DomainEventType.result_published,
        ) == set()
