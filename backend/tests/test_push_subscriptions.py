import pytest
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.push_subscription import PushSubscription
from app.models.school_membership import SchoolMembership
from app.services.push_subscriptions import upsert_push_subscription
from tests.test_parent_authorization import _seed_parent_access


@pytest.mark.asyncio
async def test_subscription_upsert_is_idempotent(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, _, _, _, _ = await _seed_parent_access(db)
        first = await upsert_push_subscription(
            db,
            user_id=context.user.id,
            school_id=context.school_id,
            endpoint="https://push.example/subscription-1",
            p256dh_key="first-p256dh",
            auth_key="first-auth",
            user_agent="Test Browser",
            device_name="Laptop",
        )
        second = await upsert_push_subscription(
            db,
            user_id=context.user.id,
            school_id=context.school_id,
            endpoint="https://push.example/subscription-1",
            p256dh_key="updated-p256dh",
            auth_key="updated-auth",
            device_name="Updated Laptop",
        )
        assert second.id == first.id
        assert second.p256dh_key == "updated-p256dh"
        assert second.device_name == "Updated Laptop"
        assert (await db.execute(select(func.count(PushSubscription.id)))).scalar_one() == 1


@pytest.mark.asyncio
async def test_subscription_endpoint_cannot_be_taken_over(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, _, _, _, _ = await _seed_parent_access(db)
        await upsert_push_subscription(
            db, user_id=context.user.id, school_id=context.school_id,
            endpoint="https://push.example/owned", p256dh_key="key-a", auth_key="auth-a",
        )
        other_user_id = (await db.execute(
            select(PushSubscription.user_id).where(PushSubscription.endpoint == "https://push.example/owned")
        )).scalar_one()
        second_parent_id = (await db.execute(
            select(SchoolMembership.user_id).where(
                SchoolMembership.school_id == context.school_id,
                SchoolMembership.user_id != other_user_id,
            )
        )).scalar_one()
        with pytest.raises(HTTPException) as exc:
            await upsert_push_subscription(
                db, user_id=second_parent_id, school_id=context.school_id,
                endpoint="https://push.example/owned", p256dh_key="key-b", auth_key="auth-b",
            )
        assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_subscription_requires_active_membership_in_tenant(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, membership, _, students, _ = await _seed_parent_access(db)
        with pytest.raises(HTTPException) as cross_school:
            await upsert_push_subscription(
                db, user_id=context.user.id, school_id=students[2].school_id,
                endpoint="https://push.example/cross-school", p256dh_key="key", auth_key="auth",
            )
        assert cross_school.value.status_code == 403

        membership.is_active = False
        await db.commit()
        with pytest.raises(HTTPException) as inactive:
            await upsert_push_subscription(
                db, user_id=context.user.id, school_id=context.school_id,
                endpoint="https://push.example/inactive", p256dh_key="key", auth_key="auth",
            )
        assert inactive.value.status_code == 403
