"""
Tests for /api/attendance/* endpoints.

Each test starts with a clean DB (conftest client fixture truncates all tables).
Uses _register_school() with verification_token to bypass the OTP email flow.
"""
from __future__ import annotations

from datetime import date

import pytest
from httpx import AsyncClient

from app.utils.security import create_verification_token

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_SCHOOL_PHONE = "08012345678"
_TODAY = date.today().isoformat()


def _school_payload(name: str = "Test Academy", email: str = "admin@testacademy.ng") -> dict:
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

_STUDENT_BASE = {
    "first_name": "Chukwuemeka",
    "last_name": "Okafor",
    "date_of_birth": "2012-03-15",
    "gender": "male",
    "admission_date": "2023-09-01",
}


async def _setup_class_with_students(
    client: AsyncClient, token: str, n: int = 3
) -> tuple[str, list[str]]:
    """Create a class and n students assigned to it. Returns (class_id, [student_ids])."""
    class_resp = await client.post("/api/classes/", json=_CLASS_BASE, headers=_auth(token))
    assert class_resp.status_code == 201, class_resp.text
    class_id = class_resp.json()["id"]

    student_ids = []
    for i in range(n):
        resp = await client.post(
            "/api/students/",
            json={**_STUDENT_BASE, "last_name": f"Student{i}", "class_id": class_id},
            headers=_auth(token),
        )
        assert resp.status_code == 201, resp.text
        student_ids.append(resp.json()["id"])

    return class_id, student_ids


async def _invite_and_activate_teacher(
    client: AsyncClient, admin_token: str, email: str = "teacher@school.ng"
) -> str:
    """Invite a teacher and set their password. Returns teacher access_token."""
    invite = await client.post(
        "/api/users/invite",
        json={"name": "Mr Teacher", "email": email, "role": "teacher"},
        headers=_auth(admin_token),
    )
    assert invite.status_code == 201, invite.text
    invite_token = invite.json()["invite_token"]

    set_pw = await client.post(
        "/api/auth/set-password",
        json={"invite_token": invite_token, "new_password": "TeachPass1!"},
    )
    assert set_pw.status_code == 200, set_pw.text
    return set_pw.json()["access_token"]


# ---------------------------------------------------------------------------
# test_mark_attendance_success
# ---------------------------------------------------------------------------

async def test_mark_attendance_success(client: AsyncClient) -> None:
    school = await _register_school(client)
    token = school["access_token"]

    class_id, student_ids = await _setup_class_with_students(client, token, n=3)

    records = [
        {"student_id": student_ids[0], "status": "present"},
        {"student_id": student_ids[1], "status": "absent", "note": "Sick"},
        {"student_id": student_ids[2], "status": "late"},
    ]
    resp = await client.post(
        "/api/attendance/mark",
        json={"class_id": class_id, "date": _TODAY, "records": records},
        headers=_auth(token),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["marked_count"] == 3
    assert body["date"] == _TODAY
    assert body["class_name"] == "JSS 1A"
    assert body["already_marked"] is False

    # Check endpoint should now show is_marked=True
    check = await client.get(
        f"/api/attendance/check/{class_id}",
        params={"date": _TODAY},
        headers=_auth(token),
    )
    assert check.status_code == 200
    assert check.json()["is_marked"] is True


# ---------------------------------------------------------------------------
# test_teacher_cannot_mark_other_class
# ---------------------------------------------------------------------------

async def test_teacher_cannot_mark_other_class(client: AsyncClient) -> None:
    """A teacher assigned to class A must not be able to mark attendance for class B."""
    school = await _register_school(client)
    admin_token = school["access_token"]

    # Create two classes
    class1_resp = await client.post("/api/classes/", json=_CLASS_BASE, headers=_auth(admin_token))
    assert class1_resp.status_code == 201
    class1_id = class1_resp.json()["id"]

    class2_resp = await client.post(
        "/api/classes/",
        json={**_CLASS_BASE, "name": "JSS 2A", "level": "JSS 2"},
        headers=_auth(admin_token),
    )
    assert class2_resp.status_code == 201
    class2_id = class2_resp.json()["id"]

    # Create a student in class2 (so the records list is valid if we get past the 403)
    student_resp = await client.post(
        "/api/students/",
        json={**_STUDENT_BASE, "class_id": class2_id},
        headers=_auth(admin_token),
    )
    assert student_resp.status_code == 201
    student_id = student_resp.json()["id"]

    # Invite teacher and get their user info
    invite = await client.post(
        "/api/users/invite",
        json={"name": "Mr Jones", "email": "jones@school.ng", "role": "teacher"},
        headers=_auth(admin_token),
    )
    assert invite.status_code == 201
    invite_token = invite.json()["invite_token"]
    teacher_user_id = invite.json()["user_id"]

    set_pw = await client.post(
        "/api/auth/set-password",
        json={"invite_token": invite_token, "new_password": "TeachPass1!"},
    )
    assert set_pw.status_code == 200
    teacher_token = set_pw.json()["access_token"]

    # Assign teacher to class1 (not class2)
    assign = await client.post(
        f"/api/classes/{class1_id}/assign-teacher",
        json={"teacher_id": teacher_user_id},
        headers=_auth(admin_token),
    )
    assert assign.status_code == 200

    # Teacher tries to mark attendance for class2 → must get 403
    mark_resp = await client.post(
        "/api/attendance/mark",
        json={
            "class_id": class2_id,
            "date": _TODAY,
            "records": [{"student_id": student_id, "status": "present"}],
        },
        headers=_auth(teacher_token),
    )
    assert mark_resp.status_code == 403, mark_resp.text


# ---------------------------------------------------------------------------
# test_mark_attendance_idempotent
# ---------------------------------------------------------------------------

async def test_mark_attendance_idempotent(client: AsyncClient) -> None:
    """Marking attendance twice on the same day upserts (no duplicate rows)."""
    school = await _register_school(client)
    token = school["access_token"]

    class_id, student_ids = await _setup_class_with_students(client, token, n=2)

    records = [
        {"student_id": student_ids[0], "status": "present"},
        {"student_id": student_ids[1], "status": "absent"},
    ]

    # First mark
    resp1 = await client.post(
        "/api/attendance/mark",
        json={"class_id": class_id, "date": _TODAY, "records": records},
        headers=_auth(token),
    )
    assert resp1.status_code == 200
    assert resp1.json()["already_marked"] is False

    # Second mark (change student 1 from present → late)
    records2 = [
        {"student_id": student_ids[0], "status": "late"},
        {"student_id": student_ids[1], "status": "absent"},
    ]
    resp2 = await client.post(
        "/api/attendance/mark",
        json={"class_id": class_id, "date": _TODAY, "records": records2},
        headers=_auth(token),
    )
    assert resp2.status_code == 200
    assert resp2.json()["already_marked"] is True
    assert resp2.json()["marked_count"] == 2

    # Verify the record for student 0 was updated to "late"
    class_records = await client.get(
        f"/api/attendance/class/{class_id}",
        params={"date": _TODAY},
        headers=_auth(token),
    )
    assert class_records.status_code == 200
    statuses = {r["student_id"]: r["status"] for r in class_records.json()}
    assert statuses[student_ids[0]] == "late"
    assert statuses[student_ids[1]] == "absent"


# ---------------------------------------------------------------------------
# test_attendance_summary_uses_sql_aggregates
# ---------------------------------------------------------------------------

async def test_attendance_summary_uses_sql_aggregates(client: AsyncClient) -> None:
    """
    Mark 5 students (3 present, 1 absent, 1 late) and verify the summary
    endpoint returns correct aggregate counts — proving SQL-level counting.
    """
    school = await _register_school(client)
    token = school["access_token"]

    class_id, student_ids = await _setup_class_with_students(client, token, n=5)

    records = [
        {"student_id": student_ids[0], "status": "present"},
        {"student_id": student_ids[1], "status": "present"},
        {"student_id": student_ids[2], "status": "present"},
        {"student_id": student_ids[3], "status": "absent"},
        {"student_id": student_ids[4], "status": "late"},
    ]
    mark_resp = await client.post(
        "/api/attendance/mark",
        json={"class_id": class_id, "date": _TODAY, "records": records},
        headers=_auth(token),
    )
    assert mark_resp.status_code == 200

    summary_resp = await client.get(
        f"/api/attendance/class/{class_id}/summary",
        params={"start_date": _TODAY, "end_date": _TODAY},
        headers=_auth(token),
    )
    assert summary_resp.status_code == 200, summary_resp.text
    summary = summary_resp.json()

    assert summary["total_students"] == 5
    assert summary["present"] == 3
    assert summary["absent"] == 1
    assert summary["late"] == 1
    assert summary["excused"] == 0
    assert summary["attendance_rate"] == 60.0


# ---------------------------------------------------------------------------
# test_school_attendance_isolation
# ---------------------------------------------------------------------------

async def test_school_attendance_isolation(client: AsyncClient) -> None:
    """School B's /attendance/school endpoint must not see School A's records."""
    school_a = await _register_school(
        client, name="School A", email="a@schoola.ng"
    )
    school_b = await _register_school(
        client, name="School B", email="b@schoolb.ng"
    )
    token_a = school_a["access_token"]
    token_b = school_b["access_token"]

    # School A marks attendance for some students
    class_id, student_ids = await _setup_class_with_students(client, token_a, n=2)
    await client.post(
        "/api/attendance/mark",
        json={
            "class_id": class_id,
            "date": _TODAY,
            "records": [
                {"student_id": student_ids[0], "status": "present"},
                {"student_id": student_ids[1], "status": "present"},
            ],
        },
        headers=_auth(token_a),
    )

    # School B checks school-wide summary — must show 0 students
    summary_b = await client.get(
        "/api/attendance/school",
        params={"date": _TODAY},
        headers=_auth(token_b),
    )
    assert summary_b.status_code == 200
    body = summary_b.json()
    assert body["total_students"] == 0
    assert body["present"] == 0
    assert body["by_class"] == []
