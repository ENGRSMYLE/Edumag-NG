"""
Tests for /api/results/* endpoints.

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

_SCHOOL_PHONE = "08012345678"
_SESSION = "2024/2025"
_TERM = "first"


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
    "academic_session": _SESSION,
    "term": _TERM,
}

_STUDENT_BASE = {
    "first_name": "Emeka",
    "last_name": "Okafor",
    "date_of_birth": "2012-03-15",
    "gender": "male",
    "admission_date": "2023-09-01",
}


async def _setup_class_and_students(
    client: AsyncClient, token: str, n: int = 3
) -> tuple[str, list[str]]:
    """Create a class and n students assigned to it."""
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


async def _invite_teacher(
    client: AsyncClient, admin_token: str, email: str = "teacher@school.ng"
) -> tuple[str, str]:
    """Invite a teacher, set their password. Returns (teacher_token, teacher_user_id)."""
    invite = await client.post(
        "/api/users/invite",
        json={"name": "Mr Teacher", "email": email, "role": "teacher"},
        headers=_auth(admin_token),
    )
    assert invite.status_code == 201, invite.text
    data = invite.json()
    invite_token = data["invite_token"]
    teacher_user_id = data["user_id"]

    set_pw = await client.post(
        "/api/auth/set-password",
        json={"invite_token": invite_token, "new_password": "TeachPass1!"},
    )
    assert set_pw.status_code == 200, set_pw.text
    return set_pw.json()["access_token"], teacher_user_id


def _score_payload(class_id: str, student_ids: list[str], subject: str = "Mathematics") -> dict:
    return {
        "class_id": class_id,
        "academic_session": _SESSION,
        "term": _TERM,
        "subject": subject,
        "entries": [
            {"student_id": sid, "ca_score": 30, "exam_score": 50}
            for sid in student_ids
        ],
    }


# ---------------------------------------------------------------------------
# test_enter_scores_success
# ---------------------------------------------------------------------------

async def test_enter_scores_success(client: AsyncClient) -> None:
    school = await _register_school(client)
    token = school["access_token"]

    class_id, student_ids = await _setup_class_and_students(client, token, n=3)

    resp = await client.post(
        "/api/results/scores",
        json=_score_payload(class_id, student_ids),
        headers=_auth(token),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["updated_count"] == 3
    assert body["subject"] == "Mathematics"

    # Verify results exist in the class endpoint
    class_results = await client.get(
        f"/api/results/class/{class_id}",
        params={"academic_session": _SESSION, "term": _TERM, "subject": "Mathematics"},
        headers=_auth(token),
    )
    assert class_results.status_code == 200, class_results.text
    results = class_results.json()
    assert len(results) == 3
    for r in results:
        assert r["total_score"] == 80.0       # 30 + 50
        assert r["grade"] is not None
        assert r["remark"] is not None
        assert r["is_approved"] is False


# ---------------------------------------------------------------------------
# test_cannot_edit_approved_results
# ---------------------------------------------------------------------------

async def test_cannot_edit_approved_results(client: AsyncClient) -> None:
    school = await _register_school(client)
    token = school["access_token"]

    class_id, student_ids = await _setup_class_and_students(client, token, n=2)

    # Enter scores
    await client.post(
        "/api/results/scores",
        json=_score_payload(class_id, student_ids),
        headers=_auth(token),
    )

    # Approve results (super_admin has wildcard)
    approve_resp = await client.post(
        "/api/results/approve",
        json={"class_id": class_id, "academic_session": _SESSION, "term": _TERM},
        headers=_auth(token),
    )
    assert approve_resp.status_code == 200, approve_resp.text
    assert approve_resp.json()["approved_count"] == 2

    # Try to re-enter scores for same students → must be rejected with 403
    edit_resp = await client.post(
        "/api/results/scores",
        json=_score_payload(class_id, student_ids),
        headers=_auth(token),
    )
    assert edit_resp.status_code == 403, edit_resp.text


# ---------------------------------------------------------------------------
# test_teacher_cannot_enter_scores_for_other_class
# ---------------------------------------------------------------------------

async def test_teacher_cannot_enter_scores_for_other_class(client: AsyncClient) -> None:
    """Teacher assigned to class A cannot enter scores for class B."""
    school = await _register_school(client)
    admin_token = school["access_token"]

    class1_resp = await client.post(
        "/api/classes/", json=_CLASS_BASE, headers=_auth(admin_token)
    )
    assert class1_resp.status_code == 201
    class1_id = class1_resp.json()["id"]

    class2_resp = await client.post(
        "/api/classes/",
        json={**_CLASS_BASE, "name": "JSS 2A", "level": "JSS 2"},
        headers=_auth(admin_token),
    )
    assert class2_resp.status_code == 201
    class2_id = class2_resp.json()["id"]

    # Create a student in class2
    stu = await client.post(
        "/api/students/",
        json={**_STUDENT_BASE, "class_id": class2_id},
        headers=_auth(admin_token),
    )
    assert stu.status_code == 201
    student_id = stu.json()["id"]

    # Invite teacher and assign to class1
    teacher_token, teacher_user_id = await _invite_teacher(client, admin_token)
    await client.post(
        f"/api/classes/{class1_id}/assign-teacher",
        json={"teacher_id": teacher_user_id},
        headers=_auth(admin_token),
    )

    # Teacher tries to enter scores for class2 → 403
    resp = await client.post(
        "/api/results/scores",
        json={
            "class_id": class2_id,
            "academic_session": _SESSION,
            "term": _TERM,
            "subject": "English",
            "entries": [{"student_id": student_id, "ca_score": 20, "exam_score": 40}],
        },
        headers=_auth(teacher_token),
    )
    assert resp.status_code == 403, resp.text


# ---------------------------------------------------------------------------
# test_grade_computation_uses_school_grading_system
# ---------------------------------------------------------------------------

async def test_grade_computation_uses_school_grading_system(client: AsyncClient) -> None:
    """
    When a school has a custom grading system, grades should use it.
    We create a custom grade scale where 80+ = 'A1' and verify.
    """
    from app.models.grading_system import GradingSystem
    from app.database import get_db
    from app.main import app
    import uuid as _uuid

    school = await _register_school(client)
    token = school["access_token"]
    school_id = _uuid.UUID(school["user"]["school_id"])

    class_id, student_ids = await _setup_class_and_students(client, token, n=1)

    # Insert a custom grading system directly via DB
    async for db in app.dependency_overrides.get(get_db, get_db)():
        db.add(GradingSystem(school_id=school_id, grade="A1", min_score=75.0, max_score=100.0, remark="Distinction"))
        db.add(GradingSystem(school_id=school_id, grade="B2", min_score=65.0, max_score=74.9, remark="Credit"))
        db.add(GradingSystem(school_id=school_id, grade="F9", min_score=0.0,  max_score=44.9, remark="Fail"))
        await db.commit()
        break

    # Enter score that gives total=80 (ca=30+exam=50) → should map to A1
    resp = await client.post(
        "/api/results/scores",
        json={
            "class_id": class_id,
            "academic_session": _SESSION,
            "term": _TERM,
            "subject": "Biology",
            "entries": [{"student_id": student_ids[0], "ca_score": 30, "exam_score": 50}],
        },
        headers=_auth(token),
    )
    assert resp.status_code == 200, resp.text

    # Fetch the result and verify grade = A1
    results_resp = await client.get(
        f"/api/results/class/{class_id}",
        params={"academic_session": _SESSION, "term": _TERM, "subject": "Biology"},
        headers=_auth(token),
    )
    assert results_resp.status_code == 200
    results = results_resp.json()
    assert len(results) == 1
    assert results[0]["grade"] == "A1"
    assert results[0]["remark"] == "Distinction"


# ---------------------------------------------------------------------------
# test_approve_results_sets_approved_by
# ---------------------------------------------------------------------------

async def test_approve_results_sets_approved_by(client: AsyncClient) -> None:
    """After approve, is_approved=True and results cannot be re-entered."""
    school = await _register_school(client)
    token = school["access_token"]
    approver_id = school["user"]["user_id"]

    class_id, student_ids = await _setup_class_and_students(client, token, n=3)

    # Enter scores for 2 subjects
    for subject in ("Maths", "English"):
        await client.post(
            "/api/results/scores",
            json=_score_payload(class_id, student_ids, subject=subject),
            headers=_auth(token),
        )

    # Approve all results for this class/session/term
    approve = await client.post(
        "/api/results/approve",
        json={"class_id": class_id, "academic_session": _SESSION, "term": _TERM},
        headers=_auth(token),
    )
    assert approve.status_code == 200, approve.text
    body = approve.json()
    # 3 students × 2 subjects = 6 results approved
    assert body["approved_count"] == 6

    # Verify results show is_approved=True
    class_results = await client.get(
        f"/api/results/class/{class_id}",
        params={"academic_session": _SESSION, "term": _TERM},
        headers=_auth(token),
    )
    assert class_results.status_code == 200
    for r in class_results.json():
        assert r["is_approved"] is True

    # Second approve call should return 0 (already approved, WHERE is_approved=False filters them out)
    approve2 = await client.post(
        "/api/results/approve",
        json={"class_id": class_id, "academic_session": _SESSION, "term": _TERM},
        headers=_auth(token),
    )
    assert approve2.status_code == 200
    assert approve2.json()["approved_count"] == 0
