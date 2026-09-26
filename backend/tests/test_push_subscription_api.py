from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import settings
from app.models.notification import Notification, NotificationOutbox
from app.models.push_subscription import PushSubscription
from app.models.school_membership import SchoolMembership
from app.utils.security import create_access_token
from tests.test_parent_authorization import _seed_parent_access


def _token(user_id, membership: SchoolMembership) -> str:
    return create_access_token({
        "sub": str(user_id),
        "school_id": str(membership.school_id),
        "role": membership.role.value,
        "membership_id": str(membership.id),
    })


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _body(endpoint: str, device_name: str = "Test Device") -> dict:
    return {
        "endpoint": endpoint,
        "keys": {"p256dh": "p" * 65, "auth": "a" * 24},
        "device_name": device_name,
    }


async def _seed_api_users(db: AsyncSession):
    context, first_membership, _, _, _ = await _seed_parent_access(db)
    second_membership = (await db.execute(
        select(SchoolMembership).where(
            SchoolMembership.school_id == context.school_id,
            SchoolMembership.user_id != context.user.id,
        )
    )).scalar_one()
    return context, first_membership, second_membership


async def test_subscribe_status_duplicate_multiple_devices_and_unsubscribe(client, test_engine, monkeypatch) -> None:
    monkeypatch.setattr(settings, "WEB_PUSH_VAPID_PUBLIC_KEY", "configured")
    monkeypatch.setattr(settings, "WEB_PUSH_VAPID_PRIVATE_KEY", "configured")
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, membership, _ = await _seed_api_users(db)
        token = _token(context.user.id, membership)
    headers = _headers(token)

    empty = await client.get("/api/notifications/push/status", headers=headers)
    assert empty.status_code == 200
    assert empty.json() == {"supported": True, "configured": True, "subscribed": False, "device_count": 0}

    endpoint_one = "https://push.example/device-one"
    first = await client.post("/api/notifications/push/subscribe", json=_body(endpoint_one), headers=headers)
    duplicate = await client.post(
        "/api/notifications/push/subscribe",
        json=_body(endpoint_one, "Renamed Device"),
        headers=headers,
    )
    second = await client.post(
        "/api/notifications/push/subscribe",
        json=_body("https://push.example/device-two"),
        headers=headers,
    )
    assert first.status_code == duplicate.status_code == second.status_code == 200
    assert first.json()["device_count"] == 1
    assert duplicate.json()["device_count"] == 1
    assert second.json()["device_count"] == 2

    removed = await client.request(
        "DELETE", "/api/notifications/push/unsubscribe",
        json={"endpoint": endpoint_one}, headers=headers,
    )
    repeated = await client.request(
        "DELETE", "/api/notifications/push/unsubscribe",
        json={"endpoint": endpoint_one}, headers=headers,
    )
    assert removed.status_code == repeated.status_code == 200
    assert removed.json()["device_count"] == repeated.json()["device_count"] == 1


async def test_cross_user_takeover_and_cross_school_identity_are_blocked(client, test_engine, monkeypatch) -> None:
    monkeypatch.setattr(settings, "WEB_PUSH_VAPID_PUBLIC_KEY", "configured")
    monkeypatch.setattr(settings, "WEB_PUSH_VAPID_PRIVATE_KEY", "configured")
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, first_membership, second_membership = await _seed_api_users(db)
        first_token = _token(context.user.id, first_membership)
        second_token = _token(second_membership.user_id, second_membership)

    endpoint = "https://push.example/owned-endpoint"
    created = await client.post(
        "/api/notifications/push/subscribe", json=_body(endpoint), headers=_headers(first_token)
    )
    takeover = await client.post(
        "/api/notifications/push/subscribe", json=_body(endpoint), headers=_headers(second_token)
    )
    assert created.status_code == 200
    assert takeover.status_code == 409

    # Identity fields are forbidden and the tenant always comes from the JWT.
    malformed_identity = _body("https://push.example/forged") | {
        "user_id": str(second_membership.user_id),
        "school_id": "00000000-0000-0000-0000-000000000000",
    }
    forged = await client.post(
        "/api/notifications/push/subscribe", json=malformed_identity, headers=_headers(first_token)
    )
    assert forged.status_code == 422


async def test_subscription_auth_disabled_membership_and_malformed_payload(client, test_engine, monkeypatch) -> None:
    monkeypatch.setattr(settings, "WEB_PUSH_VAPID_PUBLIC_KEY", "configured")
    monkeypatch.setattr(settings, "WEB_PUSH_VAPID_PRIVATE_KEY", "configured")
    unauthenticated = await client.get("/api/notifications/push/status")
    malformed = await client.post(
        "/api/notifications/push/subscribe",
        json={"endpoint": "http://insecure.example", "keys": {"p256dh": "short", "auth": "x"}},
    )
    assert unauthenticated.status_code == malformed.status_code == 401

    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, membership, _ = await _seed_api_users(db)
        token = _token(context.user.id, membership)
        membership.is_active = False
        await db.commit()
    disabled = await client.get("/api/notifications/push/status", headers=_headers(token))
    assert disabled.status_code == 401

    # Use a new active fixture through the next test transaction to validate schema errors.


async def test_malformed_subscription_is_rejected_for_authenticated_user(client, test_engine, monkeypatch) -> None:
    monkeypatch.setattr(settings, "WEB_PUSH_VAPID_PUBLIC_KEY", "configured")
    monkeypatch.setattr(settings, "WEB_PUSH_VAPID_PRIVATE_KEY", "configured")
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, membership, _ = await _seed_api_users(db)
        token = _token(context.user.id, membership)
    response = await client.post(
        "/api/notifications/push/subscribe",
        json={"endpoint": "http://insecure.example", "keys": {"p256dh": "short", "auth": "x"}},
        headers=_headers(token),
    )
    assert response.status_code == 422


async def test_push_test_queues_only_the_current_users_notification(client, test_engine, monkeypatch) -> None:
    monkeypatch.setattr(settings, "WEB_PUSH_VAPID_PUBLIC_KEY", "configured")
    monkeypatch.setattr(settings, "WEB_PUSH_VAPID_PRIVATE_KEY", "configured")
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, membership, _ = await _seed_api_users(db)
        token = _token(context.user.id, membership)
    headers = _headers(token)
    await client.post(
        "/api/notifications/push/subscribe",
        json=_body("https://push.example/test-device"),
        headers=headers,
    )
    response = await client.post("/api/notifications/push/test", headers=headers)
    assert response.status_code == 200
    assert response.json()["message"] == "Test notification queued"

    async with factory() as db:
        notifications = list((await db.execute(select(Notification))).scalars().all())
        assert len(notifications) == 1
        assert notifications[0].user_id == context.user.id
        assert notifications[0].school_id == context.school_id
        assert (await db.execute(select(func.count(NotificationOutbox.id)))).scalar_one() == 1
        assert (await db.execute(select(func.count(PushSubscription.id)))).scalar_one() == 1
