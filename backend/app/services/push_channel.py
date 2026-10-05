"""Web Push delivery adapter.

Provider details live here so domain services only emit notification events.
The adapter accepts already-authorized notification/subscription records and
builds its lock-screen payload through the central privacy policy.
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Callable, Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.notification import Notification
from app.models.push_subscription import PushSubscription
from app.models.school_membership import MembershipRole, SchoolMembership
from app.services.notification_policy import build_push_payload

logger = logging.getLogger(__name__)

class DeliveryDisposition(str, Enum):
    success = "success"
    temporary_failure = "temporary_failure"
    permanent_failure = "permanent_failure"


@dataclass(frozen=True)
class PushDeliveryResult:
    subscription_id: str
    disposition: DeliveryDisposition
    status_code: int | None = None
    error_type: str | None = None

    @property
    def retryable(self) -> bool:
        return self.disposition == DeliveryDisposition.temporary_failure


PushSender = Callable[..., object]


def _provider_status_code(error: BaseException) -> int | None:
    response = getattr(error, "response", None)
    value = getattr(response, "status_code", None)
    return value if isinstance(value, int) else None


def _disposition(status_code: int | None) -> DeliveryDisposition:
    if status_code is None or status_code in {408, 425, 429} or status_code >= 500:
        return DeliveryDisposition.temporary_failure
    return DeliveryDisposition.permanent_failure


def _default_sender(**kwargs: object) -> object:
    # Import lazily so development can run with Web Push disabled while still
    # producing an explicit configuration result if delivery is attempted.
    from pywebpush import webpush

    return webpush(**kwargs)


class PushNotificationChannel:
    def __init__(
        self,
        *,
        sender: PushSender | None = None,
        private_key: str | None = None,
        subject: str | None = None,
        timeout_seconds: float = 10.0,
        ttl_seconds: int | None = None,
    ) -> None:
        self._sender = sender or _default_sender
        self._private_key = private_key if private_key is not None else settings.WEB_PUSH_VAPID_PRIVATE_KEY
        self._subject = subject or settings.WEB_PUSH_SUBJECT
        self._timeout_seconds = timeout_seconds
        self._ttl_seconds = ttl_seconds if ttl_seconds is not None else settings.WEB_PUSH_TTL_SECONDS

    async def send(
        self,
        notification: Notification,
        subscription: PushSubscription,
        *,
        role: MembershipRole,
    ) -> PushDeliveryResult:
        now = datetime.now(timezone.utc)
        if not subscription.is_active:
            return PushDeliveryResult(
                subscription_id=str(subscription.id),
                disposition=DeliveryDisposition.permanent_failure,
                error_type="inactive_subscription",
            )
        if subscription.expires_at is not None and subscription.expires_at <= now:
            subscription.is_active = False
            subscription.failure_count += 1
            subscription.last_failure_at = now
            logger.warning(
                "[Push] Failed: subscription expired subscription_id=%s",
                subscription.id,
            )
            return PushDeliveryResult(
                subscription_id=str(subscription.id),
                disposition=DeliveryDisposition.permanent_failure,
                error_type="subscription_expired",
            )
        if not self._private_key:
            subscription.failure_count += 1
            subscription.last_failure_at = now
            return PushDeliveryResult(
                subscription_id=str(subscription.id),
                disposition=DeliveryDisposition.temporary_failure,
                error_type="push_not_configured",
            )

        safe = build_push_payload(notification.event_type, role)
        payload = json.dumps(
            {
                "title": safe.title,
                "body": safe.body,
                "url": safe.url,
                "event_type": safe.event_type,
                "notification_id": str(notification.id),
            },
            separators=(",", ":"),
        )
        provider_subscription = {
            "endpoint": subscription.endpoint,
            "keys": {"p256dh": subscription.p256dh_key, "auth": subscription.auth_key},
        }

        logger.info(
            "[Push] Sending notification notification_id=%s subscription_id=%s ttl_seconds=%s",
            notification.id,
            subscription.id,
            self._ttl_seconds,
        )
        logger.info("[Push] Subscription found subscription_id=%s", subscription.id)

        try:
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    self._sender,
                    subscription_info=provider_subscription,
                    data=payload,
                    vapid_private_key=self._private_key,
                    vapid_claims={"sub": self._subject},
                    ttl=self._ttl_seconds,
                    timeout=self._timeout_seconds,
                ),
                timeout=self._timeout_seconds,
            )
        except Exception as error:
            status_code = _provider_status_code(error)
            disposition = _disposition(status_code)
            subscription.failure_count += 1
            subscription.last_failure_at = now
            if status_code in {404, 410}:
                subscription.is_active = False
            # Deliberately retain only the exception class. Provider exception
            # text can include endpoints or request details and is never logged.
            logger.warning(
                "[Push] Failed status=%s error_type=%s subscription_id=%s expired=%s",
                status_code if status_code is not None else "unavailable",
                type(error).__name__,
                subscription.id,
                status_code in {404, 410},
            )
            return PushDeliveryResult(
                subscription_id=str(subscription.id),
                disposition=disposition,
                status_code=status_code,
                error_type=type(error).__name__,
            )

        subscription.failure_count = 0
        subscription.last_success_at = now
        status_code = getattr(response, "status_code", None)
        logger.info(
            "[Push] Push service accepted notification notification_id=%s subscription_id=%s status=%s",
            notification.id,
            subscription.id,
            status_code if isinstance(status_code, int) else "accepted",
        )
        return PushDeliveryResult(
            subscription_id=str(subscription.id),
            disposition=DeliveryDisposition.success,
            status_code=status_code if isinstance(status_code, int) else None,
        )

    async def send_many(
        self,
        notification: Notification,
        subscriptions: Iterable[PushSubscription],
        *,
        role: MembershipRole,
    ) -> list[PushDeliveryResult]:
        # send() absorbs device-level failures, so one endpoint cannot cancel
        # delivery to the remaining devices.
        return list(await asyncio.gather(*(
            self.send(notification, subscription, role=role)
            for subscription in subscriptions
        )))


async def deliver_notification_push(
    db: AsyncSession,
    notification: Notification,
    *,
    channel: PushNotificationChannel | None = None,
    commit: bool = True,
) -> list[PushDeliveryResult]:
    """Deliver one notification to every active device for its tenant/user."""
    role = (await db.execute(
        select(SchoolMembership.role).where(
            SchoolMembership.user_id == notification.user_id,
            SchoolMembership.school_id == notification.school_id,
            SchoolMembership.is_active.is_(True),
        )
    )).scalar_one_or_none()
    if role is None:
        return []

    subscriptions = list((await db.execute(
        select(PushSubscription).where(
            PushSubscription.user_id == notification.user_id,
            PushSubscription.school_id == notification.school_id,
            PushSubscription.is_active.is_(True),
        )
    )).scalars().all())
    if not subscriptions:
        return []

    results = await (channel or PushNotificationChannel()).send_many(
        notification,
        subscriptions,
        role=role,
    )
    if commit:
        await db.commit()
    else:
        await db.flush()
    return results
