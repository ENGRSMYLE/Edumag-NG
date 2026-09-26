import asyncio
import json
import uuid

import pytest

from app.models.notification import DomainEventType, Notification
from app.models.push_subscription import PushSubscription
from app.models.school_membership import MembershipRole
from app.services.push_channel import DeliveryDisposition, PushNotificationChannel


class ProviderError(Exception):
    def __init__(self, status_code: int):
        self.response = type("Response", (), {"status_code": status_code})()
        super().__init__("provider failure")


def notification() -> Notification:
    return Notification(
        id=uuid.uuid4(), school_id=uuid.uuid4(), user_id=uuid.uuid4(),
        event_type=DomainEventType.result_published, title="Private score", body="Sensitive body",
    )


def subscription(endpoint: str) -> PushSubscription:
    return PushSubscription(
        id=uuid.uuid4(), user_id=uuid.uuid4(), school_id=uuid.uuid4(), endpoint=endpoint,
        p256dh_key="public-key", auth_key="auth-key", is_active=True, failure_count=0,
    )


@pytest.mark.asyncio
async def test_success_records_delivery_and_uses_safe_payload() -> None:
    sent = {}
    def sender(**kwargs): sent.update(kwargs)
    item = subscription("https://push.example/success")
    result = await PushNotificationChannel(sender=sender, private_key="secret").send(
        notification(), item, role=MembershipRole.parent,
    )
    payload = json.loads(sent["data"])
    assert result.disposition == DeliveryDisposition.success
    assert item.last_success_at is not None and item.failure_count == 0
    assert payload["title"] == "New academic result"
    assert "Private score" not in sent["data"] and "Sensitive body" not in sent["data"]


@pytest.mark.asyncio
@pytest.mark.parametrize("status_code", [404, 410])
async def test_expired_endpoint_is_disabled(status_code: int) -> None:
    def sender(**kwargs): raise ProviderError(status_code)
    item = subscription("https://push.example/expired")
    result = await PushNotificationChannel(sender=sender, private_key="secret").send(
        notification(), item, role=MembershipRole.parent,
    )
    assert result.disposition == DeliveryDisposition.permanent_failure
    assert item.is_active is False and item.failure_count == 1 and item.last_failure_at is not None


@pytest.mark.asyncio
async def test_temporary_failure_remains_active_and_retryable() -> None:
    def sender(**kwargs): raise ProviderError(503)
    item = subscription("https://push.example/temporary")
    result = await PushNotificationChannel(sender=sender, private_key="secret").send(
        notification(), item, role=MembershipRole.parent,
    )
    assert result.retryable is True
    assert item.is_active is True and item.failure_count == 1


@pytest.mark.asyncio
async def test_one_failed_device_does_not_stop_other_devices() -> None:
    delivered = []
    def sender(**kwargs):
        endpoint = kwargs["subscription_info"]["endpoint"]
        if endpoint.endswith("bad"): raise ProviderError(410)
        delivered.append(endpoint)
    good = subscription("https://push.example/good")
    bad = subscription("https://push.example/bad")
    results = await PushNotificationChannel(sender=sender, private_key="secret").send_many(
        notification(), [bad, good], role=MembershipRole.parent,
    )
    assert [result.disposition for result in results] == [DeliveryDisposition.permanent_failure, DeliveryDisposition.success]
    assert delivered == [good.endpoint]


@pytest.mark.asyncio
async def test_timeout_is_temporary_and_secret_is_not_exposed() -> None:
    def sender(**kwargs):
        import time
        time.sleep(0.1)
    item = subscription("https://push.example/slow")
    result = await PushNotificationChannel(
        sender=sender, private_key="do-not-log-this", timeout_seconds=0.01,
    ).send(notification(), item, role=MembershipRole.parent)
    assert result.disposition == DeliveryDisposition.temporary_failure
    assert result.error_type == "TimeoutError"
    assert "do-not-log-this" not in repr(result)
