"""
Tests for /api/assignments/* endpoints.

Each test starts with a clean DB (conftest client fixture truncates all tables).
Uses _register_school() with verification_token to bypass the OTP email flow.
"""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from httpx import AsyncClient

from app.utils.security import create_verification_token

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_SESSION = "2024/2025"
_TERM = "first"
_DUE_DATE = (date.today() + timedelta(days=7)).isoformat()


def _school_payload(name: str = "Assignment Academy", email: str = "admin@assignmentacademy.ng") -> dict:
    return {
        "school_name": name,
        "school_type": "secondary",
        "address": "10 Assignment Street, Abuja",
        "lga": "Garki",
        "state": "FCT",
        "phone": "08011223344",
        "admin_name": "Test Admin",
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
    "name": "JSS 3A",
    "level": "JSS 3",
    "arm": "A",
    "capacity": 35,
    "academic_session": _SESSION,
    "term": _TERM,
}

_STUDENT_BASE = {
    "first_name": "Amaka",
    "last_name": "Nwosu",
    "date_of_birth": "2011-06-10",
    "gender": "female",
    "admission_date": "2023-09-01",
}


async def _create_class(client: AsyncClient, token: str, **overrides) -> str:
    resp = await client.post("/api/classes/", json={**_CLASS_BASE, **overrides}, headers=_auth(token))
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _invite_teacher(
    client: AsyncClient, admin_token: str, email: str = "teacher@school.ng"
) -> tuple[str, str]:
    """Invite a teacher and set their password. Returns (teacher_token, teacher_user_id)."""
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


async def _create_student(client: AsyncClient, token: str, class_id: str) -> str:
    resp = await client.post(
        "/api/students/",
        json={**_STUDENT_BASE, "class_id": class_id},
        headers=_auth(token),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _assignment_payload(class_id: str) -> dict:
    return {
        "class_id": class_id,
        "title": "Chapter 5 Exercise",
        "subject": "Mathematics",
        "description": "Solve all problems on page 78",
        "due_date": _DUE_DATE,
        "max_score": 50.0,
    }


# ---------------------------------------------------------------------------
# test_create_assignment_success
# ---------------------------------------------------------------------------

async def test_create_assignment_success(client: AsyncClient) -> None:
    school = await _register_school(client)
    admin_token = school["access_token"]

    class_id = await _create_class(client, admin_token)

    # Invite a teacher and assign them to the class
    teacher_token, teacher_user_id = await _invite_teacher(client, admin_token)
    assign = await client.post(
        f"/api/classes/{class_id}/assign-teacher",
        json={"teacher_id": teacher_user_id},
        headers=_auth(admin_token),
    )
    assert assign.status_code == 200, assign.text

    # Teacher creates assignment for their class
    resp = await client.post(
        "/api/assignments/",
        json=_assignment_payload(class_id),
        headers=_auth(teacher_token),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["title"] == "Chapter 5 Exercise"
    assert body["subject"] == "Mathematics"
    assert body["max_score"] == 50.0
    assert body["class_id"] == class_id
    assert body["submission_count"] == 0
    assert body["graded_count"] == 0
    assert body["teacher_name"] == "Mr Teacher"

    # Admin can also see the assignment
    get_resp = await client.get(
        f"/api/assignments/{body['id']}",
        headers=_auth(admin_token),
    )
    assert get_resp.status_code == 200, get_resp.text
    assert get_resp.json()["id"] == body["id"]


# ---------------------------------------------------------------------------
# test_teacher_cannot_access_other_teacher_assignments
# ---------------------------------------------------------------------------

async def test_teacher_cannot_access_other_teacher_assignments(client: AsyncClient) -> None:
    """Teacher A cannot view or manage Teacher B's assignments."""
    school = await _register_school(client)
    admin_token = school["access_token"]

    class1_id = await _create_class(client, admin_token, name="JSS 3A")
    class2_id = await _create_class(client, admin_token, name="JSS 3B", arm="B")

    teacher_a_token, teacher_a_id = await _invite_teacher(
        client, admin_token, email="teacher_a@school.ng"
    )
    teacher_b_token, teacher_b_id = await _invite_teacher(
        client, admin_token, email="teacher_b@school.ng"
    )

    # Assign teachers to their classes
    await client.post(
        f"/api/classes/{class1_id}/assign-teacher",
        json={"teacher_id": teacher_a_id},
        headers=_auth(admin_token),
    )
    await client.post(
        f"/api/classes/{class2_id}/assign-teacher",
        json={"teacher_id": teacher_b_id},
        headers=_auth(admin_token),
    )

    # Teacher A creates an assignment for class1
    create_resp = await client.post(
        "/api/assignments/",
        json=_assignment_payload(class1_id),
        headers=_auth(teacher_a_token),
    )
    assert create_resp.status_code == 201, create_resp.text
    assignment_id = create_resp.json()["id"]

    # Teacher B tries to GET Teacher A's assignment — must be 403
    get_resp = await client.get(
        f"/api/assignments/{assignment_id}",
        headers=_auth(teacher_b_token),
    )
    assert get_resp.status_code == 403, get_resp.text

    # Teacher B's list should be empty (only their own assignments)
    list_resp = await client.get("/api/assignments/", headers=_auth(teacher_b_token))
    assert list_resp.status_code == 200, list_resp.text
    assert list_resp.json()["total"] == 0

    # Teacher B tries to create assignment for class1 (not their class) — must be 403
    bad_create = await client.post(
        "/api/assignments/",
        json=_assignment_payload(class1_id),
        headers=_auth(teacher_b_token),
    )
    assert bad_create.status_code == 403, bad_create.text


# ---------------------------------------------------------------------------
# test_grade_submission_validates_max_score
# ---------------------------------------------------------------------------

async def test_grade_submission_validates_max_score(client: AsyncClient) -> None:
    """Grading with score > max_score must be rejected with 422."""
    school = await _register_school(client)
    admin_token = school["access_token"]

    class_id = await _create_class(client, admin_token)
    student_id = await _create_student(client, admin_token, class_id)

    teacher_token, teacher_user_id = await _invite_teacher(client, admin_token)
    await client.post(
        f"/api/classes/{class_id}/assign-teacher",
        json={"teacher_id": teacher_user_id},
        headers=_auth(admin_token),
    )

    # Create assignment with max_score=50
    create_resp = await client.post(
        "/api/assignments/",
        json=_assignment_payload(class_id),
        headers=_auth(teacher_token),
    )
    assert create_resp.status_code == 201, create_resp.text
    assignment_id = create_resp.json()["id"]

    # Insert a submission directly via DB
    from app.models.assignment import AssignmentSubmission
    from app.database import get_db
    from app.main import app
    import uuid as _uuid

    async for db in app.dependency_overrides.get(get_db, get_db)():
        sub = AssignmentSubmission(
            assignment_id=_uuid.UUID(assignment_id),
            student_id=_uuid.UUID(student_id),
            file_url=None,
        )
        db.add(sub)
        await db.commit()
        submission_id = str(sub.id)
        break

    # Grade with score=40 (valid, <= 50) — should succeed
    grade_resp = await client.post(
        f"/api/assignments/{assignment_id}/submissions/{submission_id}/grade",
        json={"score": 40.0, "feedback": "Good work"},
        headers=_auth(teacher_token),
    )
    assert grade_resp.status_code == 200, grade_resp.text
    body = grade_resp.json()
    assert body["score"] == 40.0
    assert body["is_graded"] is True
    assert body["feedback"] == "Good work"

    # Grade with score=75 (invalid, > max_score of 50) — must be rejected
    bad_grade = await client.post(
        f"/api/assignments/{assignment_id}/submissions/{submission_id}/grade",
        json={"score": 75.0},
        headers=_auth(teacher_token),
    )
    assert bad_grade.status_code == 422, bad_grade.text
