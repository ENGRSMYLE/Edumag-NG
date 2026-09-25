from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.audit_event import AuditEvent
from tests.test_parent_authorization import _seed_parent_access


async def _seed_and_login(client, test_engine):
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, membership, _, students, _ = await _seed_parent_access(db)
        context.user.email = "parent-a@example.com"
        await db.commit()
        other_parent_id = (await db.execute(select(membership.__class__.user_id).where(membership.__class__.school_id == context.school_id, membership.__class__.id != membership.id))).scalars().first()
        student_id = students[0].id
    response = await client.post("/api/auth/login", json={"email": "parent-a@example.com", "password": "Password1!"})
    assert response.status_code == 200, response.text
    return response.json()["access_token"], context.user.id, membership.id, student_id, other_parent_id


async def test_login_logout_and_sensitive_view_are_audited(client, test_engine):
    token, user_id, membership_id, student_id, _ = await _seed_and_login(client, test_engine)
    headers = {"Authorization": f"Bearer {token}"}
    result = await client.get(f"/api/parents/me/children/{student_id}/results", headers=headers)
    assert result.status_code == 200, result.text
    logout = await client.post("/api/auth/logout", headers=headers)
    assert logout.status_code == 200
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        events = list((await db.execute(select(AuditEvent).where(AuditEvent.actor_user_id == user_id))).scalars().all())
        assert {event.event_type for event in events}.issuperset({"login_succeeded", "sensitive_child_data_viewed", "logout"})
        assert next(event for event in events if event.event_type == "login_succeeded").target_id == membership_id


async def test_parent_cannot_message_another_parent(client, test_engine):
    token, _, _, _, other_parent_id = await _seed_and_login(client, test_engine)
    response = await client.post("/api/communication/messages", headers={"Authorization": f"Bearer {token}"}, json={"recipient_id": str(other_parent_id), "subject": "No", "body": "Blocked"})
    assert response.status_code == 403


async def test_cross_site_cookie_mutation_is_rejected_before_auth(client):
    client.cookies.set("access_token", "forged")
    response = await client.post("/api/auth/logout", headers={"Origin": "https://evil.example"})
    assert response.status_code == 403
    assert response.json()["detail"] == "Cross-site request rejected"


async def test_known_user_failed_login_is_audited_without_password_data(client, test_engine):
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, *_ = await _seed_parent_access(db)
        context.user.email = "audit-login@example.com"
        user_id = context.user.id
        await db.commit()
    response = await client.post("/api/auth/login", json={"email": "audit-login@example.com", "password": "WrongPassword1!"})
    assert response.status_code == 401
    async with factory() as db:
        event = (await db.execute(select(AuditEvent).where(AuditEvent.actor_user_id == user_id, AuditEvent.event_type == "login_failed"))).scalar_one()
        assert event.event_data["reason"] == "invalid_credentials"
        assert "password" not in event.event_data
