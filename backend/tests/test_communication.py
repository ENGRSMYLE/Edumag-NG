"""
Tests for /api/communication/* endpoints.

Each test starts with a clean DB (conftest client fixture truncates all tables).
Uses _register_school() with verification_token to bypass the OTP email flow.
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.utils.security import create_verification_token

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _school_payload(name: str, email: str) -> dict:
    return {
        "school_name": name,
        "school_type": "secondary",
        "address": "1 Test Road, Lagos",
        "lga": "Ikeja",
        "state": "Lagos",
        "phone": "08055556666",
        "admin_name": "Test Admin",
        "email": email,
        "password": "Password1!",
        "verification_token": create_verification_token(email),
    }


async def _register_school(client: AsyncClient, name: str = "Comm School", email: str = "admin@comm.ng") -> dict:
    resp = await client.post("/api/auth/register-school", json=_school_payload(name, email))
    assert resp.status_code == 201, f"School registration failed: {resp.text}"
    return resp.json()


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _invite_user(
    client: AsyncClient,
    admin_token: str,
    email: str,
    role: str = "teacher",
    name: str = "Test User",
) -> tuple[str, str]:
    """Invite a user and set their password. Returns (access_token, user_id)."""
    invite = await client.post(
        "/api/users/invite",
        json={"name": name, "email": email, "role": role},
        headers=_auth(admin_token),
    )
    assert invite.status_code == 201, invite.text
    data = invite.json()

    set_pw = await client.post(
        "/api/auth/set-password",
        json={"invite_token": data["invite_token"], "new_password": "TestPass1!"},
    )
    assert set_pw.status_code == 200, set_pw.text
    return set_pw.json()["access_token"], data["user_id"]


# ---------------------------------------------------------------------------
# test_teacher_cannot_message_another_teacher
# ---------------------------------------------------------------------------

async def test_teacher_cannot_message_another_teacher(client: AsyncClient) -> None:
    """A teacher must not be able to send a direct message to another teacher."""
    school = await _register_school(client)
    admin_token = school["access_token"]

    teacher_a_token, teacher_a_id = await _invite_user(
        client, admin_token, email="teacher_a@comm.ng", role="teacher", name="Teacher A"
    )
    teacher_b_token, teacher_b_id = await _invite_user(
        client, admin_token, email="teacher_b@comm.ng", role="teacher", name="Teacher B"
    )

    # Teacher A tries to message Teacher B → 403
    resp = await client.post(
        "/api/communication/messages",
        json={"recipient_id": teacher_b_id, "body": "Hello colleague"},
        headers=_auth(teacher_a_token),
    )
    assert resp.status_code == 403, resp.text

    # Teacher A CAN message the admin (super_admin)
    admin_user_id = school["user"]["user_id"]
    ok_resp = await client.post(
        "/api/communication/messages",
        json={"recipient_id": admin_user_id, "body": "Hello admin", "subject": "Check-in"},
        headers=_auth(teacher_a_token),
    )
    assert ok_resp.status_code == 201, ok_resp.text
    body = ok_resp.json()
    assert body["recipient_id"] == admin_user_id
    assert body["is_read"] is False


# ---------------------------------------------------------------------------
# test_announcement_school_isolation
# ---------------------------------------------------------------------------

async def test_announcement_school_isolation(client: AsyncClient) -> None:
    """Announcements from School A must not be visible to School B."""
    school_a = await _register_school(client, name="School Alpha", email="alpha@school.ng")
    school_b = await _register_school(client, name="School Beta", email="beta@school.ng")
    token_a = school_a["access_token"]
    token_b = school_b["access_token"]

    # School A creates an announcement
    create_resp = await client.post(
        "/api/communication/announcements",
        json={"title": "Alpha Notice", "body": "For Alpha students only", "target_audience": "all"},
        headers=_auth(token_a),
    )
    assert create_resp.status_code == 201, create_resp.text

    # School A sees their own announcement
    list_a = await client.get("/api/communication/announcements", headers=_auth(token_a))
    assert list_a.status_code == 200, list_a.text
    assert list_a.json()["total"] == 1
    assert list_a.json()["items"][0]["title"] == "Alpha Notice"

    # School B sees zero announcements
    list_b = await client.get("/api/communication/announcements", headers=_auth(token_b))
    assert list_b.status_code == 200, list_b.text
    assert list_b.json()["total"] == 0


# ---------------------------------------------------------------------------
# test_unread_count_correct
# ---------------------------------------------------------------------------

async def test_unread_count_correct(client: AsyncClient) -> None:
    """Unread count reflects only unread messages for the current user."""
    school = await _register_school(client)
    admin_token = school["access_token"]
    admin_id = school["user"]["user_id"]

    teacher_token, teacher_id = await _invite_user(
        client, admin_token, email="teacher@comm.ng", role="teacher", name="The Teacher"
    )

    # Admin sends 3 messages to the teacher
    for i in range(3):
        resp = await client.post(
            "/api/communication/messages",
            json={"recipient_id": teacher_id, "body": f"Message {i}", "subject": f"Subj {i}"},
            headers=_auth(admin_token),
        )
        assert resp.status_code == 201, resp.text

    # Teacher checks unread count → should be 3
    count_resp = await client.get(
        "/api/communication/messages/unread-count",
        headers=_auth(teacher_token),
    )
    assert count_resp.status_code == 200, count_resp.text
    assert count_resp.json()["count"] == 3

    # Teacher reads inbox and gets first message id
    inbox_resp = await client.get(
        "/api/communication/messages/inbox",
        headers=_auth(teacher_token),
    )
    assert inbox_resp.status_code == 200, inbox_resp.text
    inbox = inbox_resp.json()
    assert inbox["unread_count"] == 3
    assert inbox["total"] == 3

    first_message_id = inbox["items"][0]["id"]

    # Teacher marks one message as read
    mark_resp = await client.patch(
        f"/api/communication/messages/{first_message_id}/read",
        headers=_auth(teacher_token),
    )
    assert mark_resp.status_code == 200, mark_resp.text
    assert mark_resp.json()["is_read"] is True

    # Unread count drops to 2
    count_resp2 = await client.get(
        "/api/communication/messages/unread-count",
        headers=_auth(teacher_token),
    )
    assert count_resp2.json()["count"] == 2

    # Admin's unread count remains 0 (they sent, not received)
    admin_count = await client.get(
        "/api/communication/messages/unread-count",
        headers=_auth(admin_token),
    )
    assert admin_count.json()["count"] == 0
