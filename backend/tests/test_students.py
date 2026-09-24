"""
Tests for /api/students/* endpoints.

Each test starts with a clean DB (conftest client fixture truncates all tables).
We bypass the OTP flow by generating a verification token directly with
create_verification_token(), matching how the router validates it.
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
    """Register a school, return the full response body (includes access_token)."""
    payload = _school_payload(**kwargs)
    resp = await client.post("/api/auth/register-school", json=payload)
    assert resp.status_code == 201, f"School registration failed: {resp.text}"
    return resp.json()


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


_STUDENT_BASE = {
    "first_name": "Chukwuemeka",
    "last_name": "Okafor",
    "date_of_birth": "2012-03-15",
    "gender": "male",
    "admission_date": "2023-09-01",
}


# ---------------------------------------------------------------------------
# test_create_student_success
# ---------------------------------------------------------------------------

async def test_create_student_success(client: AsyncClient) -> None:
    school = await _register_school(client)
    token = school["access_token"]

    resp = await client.post(
        "/api/students/",
        json={**_STUDENT_BASE, "admission_number": "SCH-2025-0001"},
        headers=_auth(token),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()

    assert body["admission_number"] == "SCH-2025-0001"
    assert body["first_name"] == "Chukwuemeka"
    assert body["last_name"] == "Okafor"
    assert body["full_name"] == "Chukwuemeka Okafor"
    assert body["gender"] == "male"
    assert body["is_active"] is True
    assert body["parent_count"] == 0
    assert body["class_name"] is None


# ---------------------------------------------------------------------------
# test_create_student_auto_admission_number
# ---------------------------------------------------------------------------

async def test_create_student_auto_admission_number(client: AsyncClient) -> None:
    school = await _register_school(client)
    token = school["access_token"]

    # Create 3 students without specifying admission number
    created = []
    for i in range(3):
        resp = await client.post(
            "/api/students/",
            json={
                **_STUDENT_BASE,
                "last_name": f"Student{i}",
            },
            headers=_auth(token),
        )
        assert resp.status_code == 201, resp.text
        created.append(resp.json()["admission_number"])

    # All should be unique and follow SCH-YYYY-NNNN format
    assert len(set(created)) == 3
    for adm in created:
        assert adm.startswith("SCH-"), f"Bad format: {adm}"

    # Sequence should be ascending
    seqs = [int(a.split("-")[-1]) for a in created]
    assert seqs == sorted(seqs)


async def test_generate_admission_number_is_sequential_and_school_scoped(
    client: AsyncClient,
) -> None:
    school_a = await _register_school(
        client, name="School Alpha", email="alpha-admissions@school.ng"
    )
    school_b = await _register_school(
        client, name="School Beta", email="beta-admissions@school.ng"
    )

    first_a = await client.get(
        "/api/students/generate-admission-number",
        headers=_auth(school_a["access_token"]),
    )
    assert first_a.status_code == 200, first_a.text
    first_number = first_a.json()["admission_number"]
    assert first_number.startswith("SCH-")
    assert first_number.endswith("-0001")

    create_response = await client.post(
        "/api/students/",
        json={**_STUDENT_BASE, "admission_number": first_number},
        headers=_auth(school_a["access_token"]),
    )
    assert create_response.status_code == 201, create_response.text

    next_a = await client.get(
        "/api/students/generate-admission-number",
        headers=_auth(school_a["access_token"]),
    )
    assert next_a.status_code == 200, next_a.text
    assert next_a.json()["admission_number"].endswith("-0002")

    first_b = await client.get(
        "/api/students/generate-admission-number",
        headers=_auth(school_b["access_token"]),
    )
    assert first_b.status_code == 200, first_b.text
    assert first_b.json()["admission_number"].endswith("-0001")


# ---------------------------------------------------------------------------
# test_get_students_school_isolation
# ---------------------------------------------------------------------------

async def test_get_students_school_isolation(client: AsyncClient) -> None:
    """School A must never see School B's students."""
    school_a = await _register_school(
        client, name="School Alpha", email="alpha@schoola.ng"
    )
    school_b = await _register_school(
        client, name="School Beta", email="beta@schoolb.ng"
    )
    token_a = school_a["access_token"]
    token_b = school_b["access_token"]

    # Create a student in School A
    resp = await client.post(
        "/api/students/",
        json={**_STUDENT_BASE, "admission_number": "A-001"},
        headers=_auth(token_a),
    )
    assert resp.status_code == 201
    student_id_a = resp.json()["id"]

    # Create a student in School B
    resp = await client.post(
        "/api/students/",
        json={**_STUDENT_BASE, "admission_number": "B-001"},
        headers=_auth(token_b),
    )
    assert resp.status_code == 201

    # School A list should only see its own student
    list_resp = await client.get("/api/students/", headers=_auth(token_a))
    assert list_resp.status_code == 200
    items = list_resp.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == student_id_a

    # School B cannot fetch School A's student by ID
    detail_resp = await client.get(f"/api/students/{student_id_a}", headers=_auth(token_b))
    assert detail_resp.status_code == 404


# ---------------------------------------------------------------------------
# test_teacher_only_sees_own_class_students
# ---------------------------------------------------------------------------

async def test_teacher_only_sees_own_class_students(client: AsyncClient) -> None:
    """A teacher should only see students in their assigned class via /my-class."""
    school = await _register_school(client)
    token = school["access_token"]

    # Create a class via users router (super_admin creates class is not done yet,
    # so we create students without a class and then test the endpoint returns empty)
    # This test verifies the scoping logic without a full class setup

    # Create 2 students (no class assigned yet)
    for name in ("Alice", "Bob"):
        resp = await client.post(
            "/api/students/",
            json={**_STUDENT_BASE, "last_name": name},
            headers=_auth(token),
        )
        assert resp.status_code == 201

    # Invite a teacher (who has no class assigned)
    invite_resp = await client.post(
        "/api/users/invite",
        json={"name": "Mr Teacher", "email": "teacher@school.ng", "role": "teacher"},
        headers=_auth(token),
    )
    assert invite_resp.status_code == 201
    teacher_invite_token = invite_resp.json()["invite_token"]

    # Teacher sets their password
    set_pw_resp = await client.post(
        "/api/auth/set-password",
        json={"invite_token": teacher_invite_token, "new_password": "TeachPass1!"},
    )
    assert set_pw_resp.status_code == 200
    teacher_token = set_pw_resp.json()["access_token"]

    # Teacher with no class should get empty list
    my_class_resp = await client.get(
        "/api/students/my-class",
        headers=_auth(teacher_token),
    )
    assert my_class_resp.status_code == 200
    assert my_class_resp.json()["total"] == 0
    assert my_class_resp.json()["items"] == []


# ---------------------------------------------------------------------------
# test_bulk_upload_partial_success
# ---------------------------------------------------------------------------

async def test_bulk_upload_partial_success(client: AsyncClient) -> None:
    """Upload 5 rows — 2 invalid, 3 created. Verify partial success."""
    school = await _register_school(client)
    token = school["access_token"]

    rows = [
        {"first_name": "Tunde", "last_name": "Adeyemi", "date_of_birth": "2012-01-10", "gender": "male", "admission_date": "2023-09-01", "state_of_origin": "Lagos"},
        {"first_name": "Ngozi", "last_name": "Eze", "middle_name": "Chisom", "date_of_birth": "2013-05-20", "gender": "female", "admission_number": "BULK-002", "admission_date": "2023-09-01", "state_of_origin": "Anambra"},
        {"first_name": "Musa", "last_name": "Ibrahim", "date_of_birth": "2011-11-30", "gender": "male", "admission_date": "2023-09-01", "address": "Kano Road", "state_of_origin": "Kano"},
        {"first_name": "", "last_name": "NoName", "date_of_birth": "2012-01-01", "gender": "male", "admission_date": "2023-09-01"},
        {"first_name": "Valid", "last_name": "Name", "date_of_birth": "2012-01-01", "gender": "unknown_gender", "admission_date": "2023-09-01"},
    ]

    resp = await client.post(
        "/api/students/bulk-upload",
        json={"rows": rows},
        headers=_auth(token),
    )
    assert resp.status_code == 200, resp.text
    result = resp.json()

    assert result["success_count"] == 3
    assert len(result["error_rows"]) == 2
    assert len(result["created_students"]) == 3

    # Error rows should be rows 5 and 6 (1-indexed, row 1 = header)
    error_row_numbers = {e["row"] for e in result["error_rows"]}
    assert error_row_numbers == {5, 6}


# ---------------------------------------------------------------------------
# test_promote_students
# ---------------------------------------------------------------------------

async def test_promote_students(client: AsyncClient) -> None:
    school = await _register_school(client)
    token = school["access_token"]
    school_id = school["user"]["school_id"]

    # Create 2 students
    student_ids = []
    for name in ("Ade", "Bola"):
        resp = await client.post(
            "/api/students/",
            json={**_STUDENT_BASE, "last_name": name},
            headers=_auth(token),
        )
        assert resp.status_code == 201
        student_ids.append(resp.json()["id"])

    # Promote with action=repeat (no class required)
    resp = await client.post(
        "/api/students/promote",
        json={"student_ids": student_ids, "action": "repeat"},
        headers=_auth(token),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["updated_count"] == 2
    assert body["action"] == "repeat"

    # Confirm students have no class (repeat clears class_id)
    for sid in student_ids:
        detail_resp = await client.get(f"/api/students/{sid}", headers=_auth(token))
        assert detail_resp.status_code == 200
        assert detail_resp.json()["class_id"] is None


# ---------------------------------------------------------------------------
# test_transfer_student
# ---------------------------------------------------------------------------

async def test_transfer_student(client: AsyncClient) -> None:
    """Transfer requires a valid target class in the same school."""
    from app.models.class_ import Class, Term
    from app.database import get_db
    from app.main import app
    import uuid as _uuid

    school = await _register_school(client)
    token = school["access_token"]
    school_id_str = school["user"]["school_id"]
    school_id = _uuid.UUID(school_id_str)

    # Create a student
    resp = await client.post(
        "/api/students/",
        json={**_STUDENT_BASE},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    student_id = resp.json()["id"]

    # Directly insert a Class row (classes router not built yet)
    async for db in app.dependency_overrides.get(get_db, get_db)():
        target_class = Class(
            school_id=school_id,
            name="JSS 2A",
            level="JSS 2",
            arm="A",
            academic_session="2024/2025",
            term=Term.first,
            is_active=True,
        )
        db.add(target_class)
        await db.commit()
        await db.refresh(target_class)
        class_id = str(target_class.id)
        break

    # Transfer to the new class
    transfer_resp = await client.post(
        f"/api/students/{student_id}/transfer",
        json={"new_class_id": class_id},
        headers=_auth(token),
    )
    assert transfer_resp.status_code == 200, transfer_resp.text
    body = transfer_resp.json()
    assert body["class_id"] == class_id
    assert body["class_name"] == "JSS 2A"


# ---------------------------------------------------------------------------
# test_deactivate_student
# ---------------------------------------------------------------------------

async def test_deactivate_student(client: AsyncClient) -> None:
    school = await _register_school(client)
    token = school["access_token"]

    resp = await client.post(
        "/api/students/",
        json={**_STUDENT_BASE},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    student_id = resp.json()["id"]

    deact_resp = await client.delete(
        f"/api/students/{student_id}/deactivate",
        headers=_auth(token),
    )
    assert deact_resp.status_code == 200
    assert deact_resp.json()["is_active"] is False


# ---------------------------------------------------------------------------
# test_duplicate_admission_number_rejected
# ---------------------------------------------------------------------------

async def test_duplicate_admission_number_rejected(client: AsyncClient) -> None:
    school = await _register_school(client)
    token = school["access_token"]

    payload = {**_STUDENT_BASE, "admission_number": "DUP-001"}

    resp1 = await client.post("/api/students/", json=payload, headers=_auth(token))
    assert resp1.status_code == 201

    resp2 = await client.post("/api/students/", json=payload, headers=_auth(token))
    assert resp2.status_code == 409
