from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.guardian import GuardianStatus
from app.models.guardian import GuardianProfile
from app.models.password_reset import PasswordResetToken
from app.models.refresh_token import RefreshToken
from app.models.school_membership import SchoolMembership
from app.services.guardian_accounts import (
    create_or_link_guardian,
    disable_guardian_account,
    reactivate_guardian_account,
    resend_guardian_invitation,
)
from app.services.password_recovery import request_password_reset, reset_password
from app.utils.security import create_refresh_token, hash_token, verify_password
from tests.test_guardian_accounts import _payload, _seed_school


@pytest.mark.asyncio
async def test_parent_activation_issues_tokens_and_rejects_replay(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        school, admin, students = await _seed_school(db)
        invited = await create_or_link_guardian(
            db, school_id=school.id, actor_user_id=admin.id, payload=_payload(students[0].id)
        )
        token = invited.membership.invite_token

    response = await client.post(
        "/api/auth/set-password",
        json={"invite_token": token, "new_password": "ParentPass1!"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["user"]["role"] == "parent"
    assert client.cookies.get("refresh_token")

    replay = await client.post(
        "/api/auth/set-password",
        json={"invite_token": token, "new_password": "ParentPass2!"},
    )
    assert replay.status_code == 401

    async with factory() as db:
        membership = await db.get(SchoolMembership, invited.membership.id)
        profile = await db.get(GuardianProfile, invited.guardian_profile.id)
        assert membership is not None and membership.is_active is True
        assert membership.invite_token is None
        assert profile is not None and profile.status == GuardianStatus.active


@pytest.mark.asyncio
async def test_invite_activation_login_and_parent_portal_data_are_connected(client, test_engine) -> None:
    """Exercise the real HTTP flow from invitation through parent APIs."""
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        school, admin, students = await _seed_school(db)
        invited = await create_or_link_guardian(
            db, school_id=school.id, actor_user_id=admin.id, payload=_payload(students[0].id)
        )
        token = invited.membership.invite_token
        parent_email = invited.user.email
        student_id = students[0].id
        assert school.parent_portal_enabled is True

    activated = await client.post(
        "/api/auth/set-password",
        json={"invite_token": token, "new_password": "ParentPass1!"},
    )
    assert activated.status_code == 200, activated.text

    profile = await client.get("/api/parents/me")
    children = await client.get("/api/parents/me/children")
    assert profile.status_code == 200, profile.text
    assert profile.json()["email"] == parent_email
    assert children.status_code == 200, children.text
    assert children.json()["total"] == 1
    assert children.json()["items"][0]["id"] == str(student_id)

    await client.post("/api/auth/logout")
    logged_in = await client.post(
        "/api/auth/login",
        json={"email": parent_email, "password": "ParentPass1!"},
    )
    assert logged_in.status_code == 200, logged_in.text
    after_login = await client.get("/api/parents/me/children")
    assert after_login.status_code == 200
    assert after_login.json()["items"][0]["id"] == str(student_id)


@pytest.mark.asyncio
async def test_parent_activation_rejects_an_incomplete_student_relationship(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        school, admin, students = await _seed_school(db)
        invited = await create_or_link_guardian(
            db, school_id=school.id, actor_user_id=admin.id, payload=_payload(students[0].id)
        )
        token = invited.membership.invite_token
        membership_id = invited.membership.id
        await db.delete(invited.relationship)
        await db.commit()

    response = await client.post(
        "/api/auth/set-password",
        json={"invite_token": token, "new_password": "ParentPass1!"},
    )
    assert response.status_code == 409
    assert "not linked" in response.json()["detail"]

    async with factory() as db:
        membership = await db.get(SchoolMembership, membership_id)
        assert membership is not None
        assert membership.is_active is False
        assert membership.invite_token == token


@pytest.mark.asyncio
async def test_expired_invite_and_resend_invalidates_old_token(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        school, admin, students = await _seed_school(db)
        invited = await create_or_link_guardian(
            db, school_id=school.id, actor_user_id=admin.id, payload=_payload(students[0].id)
        )
        old_token = invited.membership.invite_token
        invited.membership.invite_token_expires = datetime.now(timezone.utc) - timedelta(minutes=1)
        await db.commit()

    expired = await client.post(
        "/api/auth/set-password",
        json={"invite_token": old_token, "new_password": "ParentPass1!"},
    )
    assert expired.status_code == 401
    assert "expired" in expired.json()["detail"].lower()

    async with factory() as db:
        task = await resend_guardian_invitation(
            db,
            school_id=school.id,
            actor_user_id=admin.id,
            profile_id=invited.guardian_profile.id,
        )
        new_token = parse_qs(urlparse(task.invite_link).query)["token"][0]
        assert new_token != old_token

    old_response = await client.post(
        "/api/auth/set-password",
        json={"invite_token": old_token, "new_password": "ParentPass1!"},
    )
    assert old_response.status_code == 401
    activated = await client.post(
        "/api/auth/set-password",
        json={"invite_token": new_token, "new_password": "ParentPass1!"},
    )
    assert activated.status_code == 200


@pytest.mark.asyncio
async def test_forgot_password_response_is_uniform(client, test_engine, monkeypatch) -> None:
    async def no_email(**kwargs):
        return None

    monkeypatch.setattr("app.routers.auth.send_password_reset_email", no_email)
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        _, admin, _ = await _seed_school(db)
        admin.email = "guardian-admin@example.com"
        await db.commit()

    known = await client.post(
        "/api/auth/forgot-password", json={"email": "guardian-admin@example.com"}
    )
    unknown = await client.post(
        "/api/auth/forgot-password", json={"email": "unknown@example.com"}
    )
    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()


@pytest.mark.asyncio
async def test_password_reset_is_single_use_and_revokes_all_sessions(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        school, admin, _ = await _seed_school(db)
        membership = (await db.execute(
            select(SchoolMembership).where(SchoolMembership.user_id == admin.id)
        )).scalar_one()
        raw_refresh = create_refresh_token({
            "sub": str(admin.id), "school_id": str(school.id),
            "role": "admin", "membership_id": str(membership.id),
        })
        db.add(RefreshToken(
            user_id=admin.id,
            membership_id=membership.id,
            token_hash=hash_token(raw_refresh),
            expires_at=datetime.now(timezone.utc) + timedelta(days=1),
        ))
        await db.commit()
        task = await request_password_reset(
            db, email=admin.email, requester_ip="127.0.0.20"
        )
        assert task is not None
        raw_reset = parse_qs(urlparse(task.reset_link).query)["token"][0]
        stored_reset = (await db.execute(select(PasswordResetToken))).scalar_one()
        assert stored_reset.token_hash != raw_reset

        await reset_password(db, raw_token=raw_reset, new_password="ChangedPass1!")
        await db.refresh(admin)
        assert verify_password("ChangedPass1!", admin.password_hash)
        stored_refresh = (await db.execute(select(RefreshToken))).scalar_one()
        assert stored_refresh.revoked is True

        with pytest.raises(Exception) as exc:
            await reset_password(db, raw_token=raw_reset, new_password="AnotherPass1!")
        assert getattr(exc.value, "status_code", None) == 400


@pytest.mark.asyncio
async def test_disable_reactivate_parent_and_revoke_refresh(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        school, admin, students = await _seed_school(db)
        invited = await create_or_link_guardian(
            db, school_id=school.id, actor_user_id=admin.id, payload=_payload(students[0].id)
        )
        invited.membership.is_active = True
        invited.guardian_profile.status = GuardianStatus.active
        raw_refresh = create_refresh_token({
            "sub": str(invited.user.id), "school_id": str(school.id),
            "role": "parent", "membership_id": str(invited.membership.id),
        })
        refresh = RefreshToken(
            user_id=invited.user.id,
            membership_id=invited.membership.id,
            token_hash=hash_token(raw_refresh),
            expires_at=datetime.now(timezone.utc) + timedelta(days=1),
        )
        db.add(refresh)
        await db.commit()

        await disable_guardian_account(
            db,
            school_id=school.id,
            actor_user_id=admin.id,
            profile_id=invited.guardian_profile.id,
        )
        await db.refresh(refresh)
        assert refresh.revoked is True
        assert invited.membership.is_active is False
        assert invited.guardian_profile.status == GuardianStatus.disabled

        await reactivate_guardian_account(
            db,
            school_id=school.id,
            actor_user_id=admin.id,
            profile_id=invited.guardian_profile.id,
        )
        assert invited.membership.is_active is True
        assert invited.guardian_profile.status == GuardianStatus.active
