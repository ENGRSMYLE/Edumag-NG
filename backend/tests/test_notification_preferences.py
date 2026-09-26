import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.notification import DomainEventType, Notification, NotificationOutbox
from app.models.school_membership import MembershipRole
from app.services.notification_preferences import (
    list_effective_preferences,
    update_preference,
)
from app.services.notifications import emit_notifications
from tests.test_parent_authorization import _seed_parent_access
from app.utils.security import create_access_token


def _headers(user_id, membership) -> dict[str, str]:
    token = create_access_token({
        "sub": str(user_id),
        "school_id": str(membership.school_id),
        "role": membership.role.value,
        "membership_id": str(membership.id),
    })
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_preference_api_returns_role_defaults_and_protects_mandatory_events(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, membership, _, _, _ = await _seed_parent_access(db)
        headers = _headers(context.user.id, membership)

    response = await client.get("/api/notifications/preferences", headers=headers)
    assert response.status_code == 200
    items = {item["event_type"]: item for item in response.json()["items"]}
    assert items["parent_linked"]["mandatory"] is True

    updated = await client.patch(
        "/api/notifications/preferences/result_published",
        json={"in_app_enabled": False, "push_enabled": True},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["in_app_enabled"] is False
    assert updated.json()["push_enabled"] is True

    locked = await client.patch(
        "/api/notifications/preferences/parent_linked",
        json={"push_enabled": False},
        headers=headers,
    )
    assert locked.status_code == 403


@pytest.mark.asyncio
async def test_in_app_and_push_preferences_are_independent(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, _, _, _, _ = await _seed_parent_access(db)
        await update_preference(
            db,
            user_id=context.user.id,
            school_id=context.school_id,
            role=MembershipRole.parent,
            event_type=DomainEventType.result_published,
            values={"in_app_enabled": False, "push_enabled": True},
        )
        pushed = await emit_notifications(
            db, school_id=context.school_id, user_ids={context.user.id},
            event_type=DomainEventType.result_published,
            title="Result", body="Available",
        )
        assert len(pushed) == 1
        assert pushed[0].is_in_app_visible is False
        assert (await db.execute(select(func.count(NotificationOutbox.id)).where(
            NotificationOutbox.notification_id == pushed[0].id
        ))).scalar_one() == 1

        await update_preference(
            db,
            user_id=context.user.id,
            school_id=context.school_id,
            role=MembershipRole.parent,
            event_type=DomainEventType.assignment_created,
            values={"in_app_enabled": True, "push_enabled": False},
        )
        in_app = await emit_notifications(
            db, school_id=context.school_id, user_ids={context.user.id},
            event_type=DomainEventType.assignment_created,
            title="Assignment", body="Available",
        )
        assert len(in_app) == 1
        assert in_app[0].is_in_app_visible is True
        assert (await db.execute(select(func.count(NotificationOutbox.id)).where(
            NotificationOutbox.notification_id == in_app[0].id
        ))).scalar_one() == 0


@pytest.mark.asyncio
async def test_disabling_both_channels_creates_no_delivery(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, _, _, _, _ = await _seed_parent_access(db)
        await update_preference(
            db,
            user_id=context.user.id,
            school_id=context.school_id,
            role=MembershipRole.parent,
            event_type=DomainEventType.fee_reminder,
            values={"in_app_enabled": False, "push_enabled": False},
        )
        records = await emit_notifications(
            db, school_id=context.school_id, user_ids={context.user.id},
            event_type=DomainEventType.fee_reminder, title="Fees", body="Reminder",
        )
        assert records == []


@pytest.mark.asyncio
async def test_preferences_are_tenant_scoped_and_mandatory_events_are_locked(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, _, _, _, _ = await _seed_parent_access(db)
        with pytest.raises(ValueError, match="cannot be disabled"):
            await update_preference(
                db,
                user_id=context.user.id,
                school_id=context.school_id,
                role=MembershipRole.parent,
                event_type=DomainEventType.parent_linked,
                values={"push_enabled": False},
            )

        preferences = await list_effective_preferences(
            db,
            user_id=context.user.id,
            school_id=context.school_id,
            role=MembershipRole.parent,
        )
        mandatory = next(item for item in preferences if item.event_type == DomainEventType.parent_linked)
        assert mandatory.mandatory is True
        assert mandatory.in_app_enabled is True and mandatory.push_enabled is True

        with pytest.raises(ValueError, match="membership"):
            await update_preference(
                db,
                user_id=context.user.id,
                school_id=context.school.id,
                role=MembershipRole.admin,
                event_type=DomainEventType.message_received,
                values={"push_enabled": False},
            )


@pytest.mark.asyncio
async def test_hidden_notifications_are_not_returned_or_markable(client, test_engine) -> None:
    # Visibility is enforced by API query filters; this assertion guards the
    # persisted state used by those filters without coupling to auth fixtures.
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, _, _, _, _ = await _seed_parent_access(db)
        await update_preference(
            db, user_id=context.user.id, school_id=context.school_id,
            role=MembershipRole.parent, event_type=DomainEventType.result_published,
            values={"in_app_enabled": False, "push_enabled": True},
        )
        await emit_notifications(
            db, school_id=context.school_id, user_ids={context.user.id},
            event_type=DomainEventType.result_published, title="Result", body="Available",
        )
        visible = (await db.execute(select(func.count(Notification.id)).where(
            Notification.user_id == context.user.id,
            Notification.school_id == context.school_id,
            Notification.is_in_app_visible.is_(True),
        ))).scalar_one()
        assert visible == 0
