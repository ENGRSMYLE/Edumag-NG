"""
Tests for /api/classes/* endpoints.

Each test starts with a clean DB (conftest client fixture truncates all tables).
Schools and tokens are created via _register_school() which includes a valid
verification_token, matching the pattern established in test_students.py.
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.utils.security import create_verification_token

# ---------------------------------------------------------------------------
# Helpers (mirrors pattern from test_students.py)
# ---------------------------------------------------------------------------

_SCHOOL_PHONE = "08012345678"


def _school_payload(
    name: str = "Test Academy",
    email: str = "admin@testacademy.ng",
) -> dict:
    return {
        "school_name": name,
        "school_type": "secondary",
        "address": "1 Test Street, Ikeja",
        "lga": "Ikeja",
        "state": "Lagos",
        "phone": _SCHOOL_PHONE,
        "admin_name": "Super Admin",
        "email": email,
        "password": "Password1!",
        "verification_token": create_verification_token(email),
    }


async def _register_school(client: AsyncClient, **kwargs) -> dict:
    payload = _school_payload(**kwargs)
    resp = await client.post("/api/auth/register-school", json=payload)
    assert resp.status_code == 201, f"School registration failed: {resp.text}"
    return resp.json()


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


_CLASS_BASE = {
    "name": "JSS 1A",
    "level": "JSS 1",
    "arm": "A",
    "capacity": 40,
    "academic_session": "2024/2025",
    "term": "first",
}


# ---------------------------------------------------------------------------
# test_create_class_success
# ---------------------------------------------------------------------------

async def test_create_class_success(client: AsyncClient) -> None:
    school = await _register_school(client)
    token = school["access_token"]

    resp = await client.post(
        "/api/classes/",
        json=_CLASS_BASE,
        headers=_auth(token),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()

    assert body["name"] == "JSS 1A"
    assert body["level"] == "JSS 1"
    assert body["arm"] == "A"
    assert body["capacity"] == 40
    assert body["academic_session"] == "2024/2025"
    assert body["term"] == "first"
    assert body["is_active"] is True
    assert body["teacher_id"] is None
    assert body["teacher_name"] is None
    assert body["student_count"] == 0


# ---------------------------------------------------------------------------
# test_duplicate_class_rejected
# ---------------------------------------------------------------------------

async def test_duplicate_class_rejected(client: AsyncClient) -> None:
    school = await _register_school(client)
    token = school["access_token"]

    resp1 = await client.post("/api/classes/", json=_CLASS_BASE, headers=_auth(token))
    assert resp1.status_code == 201

    # Same name + session + term = conflict
    resp2 = await client.post("/api/classes/", json=_CLASS_BASE, headers=_auth(token))
    assert resp2.status_code == 409


# ---------------------------------------------------------------------------
# test_assign_teacher_wrong_school
# ---------------------------------------------------------------------------

async def test_assign_teacher_wrong_school(client: AsyncClient) -> None:
    """Assigning a teacher from a different school must return 404."""
    import uuid

    school_a = await _register_school(
        client, name="School Alpha", email="alpha@schoola.ng"
    )
    school_b = await _register_school(
        client, name="School Beta", email="beta@schoolb.ng"
    )
    token_a = school_a["access_token"]

    # Create a class in School A
    class_resp = await client.post(
        "/api/classes/", json=_CLASS_BASE, headers=_auth(token_a)
    )
    assert class_resp.status_code == 201
    class_id = class_resp.json()["id"]

    # Try to assign a random UUID (definitely not a teacher in School A)
    fake_teacher_id = str(uuid.uuid4())
    assign_resp = await client.post(
        f"/api/classes/{class_id}/assign-teacher",
        json={"teacher_id": fake_teacher_id},
        headers=_auth(token_a),
    )
    assert assign_resp.status_code == 404


# ---------------------------------------------------------------------------
# test_get_class_list_filtered_by_session
# ---------------------------------------------------------------------------

async def test_get_class_list_filtered_by_session(client: AsyncClient) -> None:
    school = await _register_school(client)
    token = school["access_token"]

    # Create 2 classes in session 2024/2025 and 1 in 2025/2026
    await client.post(
        "/api/classes/",
        json={**_CLASS_BASE, "name": "JSS 1A", "academic_session": "2024/2025"},
        headers=_auth(token),
    )
    await client.post(
        "/api/classes/",
        json={**_CLASS_BASE, "name": "JSS 2A", "level": "JSS 2", "academic_session": "2024/2025"},
        headers=_auth(token),
    )
    await client.post(
        "/api/classes/",
        json={**_CLASS_BASE, "name": "JSS 1A", "academic_session": "2025/2026"},
        headers=_auth(token),
    )

    # Filter by 2024/2025 → expect 2 results
    resp = await client.get(
        "/api/classes/",
        params={"academic_session": "2024/2025"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    assert len(body["items"]) == 2

    # Filter by 2025/2026 → expect 1 result
    resp2 = await client.get(
        "/api/classes/",
        params={"academic_session": "2025/2026"},
        headers=_auth(token),
    )
    assert resp2.status_code == 200
    assert resp2.json()["total"] == 1


# ---------------------------------------------------------------------------
# test_class_school_isolation
# ---------------------------------------------------------------------------

async def test_class_school_isolation(client: AsyncClient) -> None:
    """School B cannot access School A's class by ID."""
    school_a = await _register_school(
        client, name="School A", email="a@schoola.ng"
    )
    school_b = await _register_school(
        client, name="School B", email="b@schoolb.ng"
    )
    token_a = school_a["access_token"]
    token_b = school_b["access_token"]

    class_resp = await client.post(
        "/api/classes/", json=_CLASS_BASE, headers=_auth(token_a)
    )
    assert class_resp.status_code == 201
    class_id = class_resp.json()["id"]

    detail_resp = await client.get(
        f"/api/classes/{class_id}", headers=_auth(token_b)
    )
    assert detail_resp.status_code == 404
