"""
Tests for /api/finance/* endpoints.

Each test starts with a clean DB (conftest client fixture truncates all tables).
Uses _register_school() with verification_token to bypass the OTP email flow.
"""
from __future__ import annotations

import hashlib
import hmac
import json

import pytest
from httpx import AsyncClient

from app.utils.security import create_verification_token

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_SCHOOL_PHONE = "08099887766"
_SESSION = "2024/2025"
_TERM = "first"


def _school_payload(name: str = "Finance Academy", email: str = "admin@financeacademy.ng") -> dict:
    return {
        "school_name": name,
        "school_type": "secondary",
        "address": "5 Finance Street, Lagos",
        "lga": "Ikeja",
        "state": "Lagos",
        "phone": _SCHOOL_PHONE,
        "admin_name": "Finance Admin",
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


_STUDENT_BASE = {
    "first_name": "Chidi",
    "last_name": "Okonkwo",
    "date_of_birth": "2010-05-20",
    "gender": "male",
    "admission_date": "2022-09-01",
}

_CLASS_BASE = {
    "name": "SS 1A",
    "level": "SS 1",
    "arm": "A",
    "capacity": 40,
    "academic_session": _SESSION,
    "term": _TERM,
}


async def _create_student(client: AsyncClient, token: str, **overrides) -> str:
    """Create a student and return their id."""
    # Create a class first
    class_resp = await client.post("/api/classes/", json=_CLASS_BASE, headers=_auth(token))
    assert class_resp.status_code == 201, class_resp.text
    class_id = class_resp.json()["id"]

    payload = {**_STUDENT_BASE, "class_id": class_id, **overrides}
    resp = await client.post("/api/students/", json=payload, headers=_auth(token))
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _payment_payload(student_id: str) -> dict:
    return {
        "student_id": student_id,
        "amount_kobo": 5_000_00,  # ₦5,000
        "payment_type": "school_fees",
        "payment_method": "cash",
        "academic_session": _SESSION,
        "term": _TERM,
        "notes": "First instalment",
    }


# ---------------------------------------------------------------------------
# test_record_payment_success
# ---------------------------------------------------------------------------

async def test_record_payment_success(client: AsyncClient) -> None:
    school = await _register_school(client)
    token = school["access_token"]
    student_id = await _create_student(client, token)

    resp = await client.post(
        "/api/finance/payments",
        json=_payment_payload(student_id),
        headers=_auth(token),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["status"] == "pending"
    assert body["amount_kobo"] == 5_000_00
    assert body["amount_naira"] == 5000.0
    assert body["payment_type"] == "school_fees"
    assert body["payment_method"] == "cash"
    assert body["reference"].startswith("EDU-")
    assert body["confirmed_by_name"] is None
    assert body["student_id"] == student_id


# ---------------------------------------------------------------------------
# test_confirm_payment_success
# ---------------------------------------------------------------------------

async def test_confirm_payment_success(client: AsyncClient) -> None:
    school = await _register_school(client)
    token = school["access_token"]
    student_id = await _create_student(client, token)

    # Record a payment
    record_resp = await client.post(
        "/api/finance/payments",
        json=_payment_payload(student_id),
        headers=_auth(token),
    )
    assert record_resp.status_code == 201, record_resp.text
    payment_id = record_resp.json()["id"]

    # Confirm the payment
    confirm_resp = await client.post(
        f"/api/finance/payments/{payment_id}/confirm",
        json={"notes": "Verified at front desk"},
        headers=_auth(token),
    )
    assert confirm_resp.status_code == 200, confirm_resp.text
    body = confirm_resp.json()
    assert body["status"] == "confirmed"
    assert body["paid_at"] is not None
    assert body["confirmed_by_name"] is not None

    # Confirming again must return 409
    again = await client.post(
        f"/api/finance/payments/{payment_id}/confirm",
        json={},
        headers=_auth(token),
    )
    assert again.status_code == 409, again.text


# ---------------------------------------------------------------------------
# test_cannot_edit_confirmed_payment
# ---------------------------------------------------------------------------

async def test_cannot_edit_confirmed_payment(client: AsyncClient) -> None:
    school = await _register_school(client)
    token = school["access_token"]
    student_id = await _create_student(client, token)

    record_resp = await client.post(
        "/api/finance/payments",
        json=_payment_payload(student_id),
        headers=_auth(token),
    )
    assert record_resp.status_code == 201
    payment_id = record_resp.json()["id"]

    # Confirm it
    await client.post(
        f"/api/finance/payments/{payment_id}/confirm",
        json={},
        headers=_auth(token),
    )

    # Try to edit — must be rejected with 403
    edit_resp = await client.patch(
        f"/api/finance/payments/{payment_id}",
        json={"amount_kobo": 1_000_00},
        headers=_auth(token),
    )
    assert edit_resp.status_code == 403, edit_resp.text


# ---------------------------------------------------------------------------
# test_paystack_webhook_rejects_invalid_signature
# ---------------------------------------------------------------------------

async def test_paystack_webhook_rejects_invalid_signature(client: AsyncClient) -> None:
    payload = json.dumps({"event": "charge.success", "data": {"reference": "EDU-TEST-123-ABCD"}}).encode()

    resp = await client.post(
        "/api/finance/paystack/webhook",
        content=payload,
        headers={
            "Content-Type": "application/json",
            "x-paystack-signature": "invalidsignature",
        },
    )
    assert resp.status_code == 401, resp.text


# ---------------------------------------------------------------------------
# test_paystack_webhook_confirms_payment_on_charge_success
# ---------------------------------------------------------------------------

async def test_paystack_webhook_confirms_payment_on_charge_success(client: AsyncClient) -> None:
    school = await _register_school(client)
    token = school["access_token"]
    student_id = await _create_student(client, token)

    # Record a payment via API to get a reference
    record_resp = await client.post(
        "/api/finance/payments",
        json=_payment_payload(student_id),
        headers=_auth(token),
    )
    assert record_resp.status_code == 201
    reference = record_resp.json()["reference"]
    payment_id = record_resp.json()["id"]

    # Patch paystack_reference to match reference (normally set during initialize)
    # We set it directly via DB — simulate that it equals the reference
    # Instead, we manually set it via the DB override used in tests
    from app.models.finance import Payment
    from app.database import get_db
    from app.main import app
    from sqlalchemy import select, update as sa_update
    import uuid as _uuid

    async for db in app.dependency_overrides.get(get_db, get_db)():
        await db.execute(
            sa_update(Payment)
            .where(Payment.id == _uuid.UUID(payment_id))
            .values(paystack_reference=reference)
        )
        await db.commit()
        break

    # Build a valid Paystack webhook payload
    paystack_secret = "sk_test_placeholder"  # matches conftest env var
    event_data = json.dumps({"event": "charge.success", "data": {"reference": reference}}).encode()
    sig = hmac.new(
        paystack_secret.encode("utf-8"),
        msg=event_data,
        digestmod=hashlib.sha512,
    ).hexdigest()

    resp = await client.post(
        "/api/finance/paystack/webhook",
        content=event_data,
        headers={
            "Content-Type": "application/json",
            "x-paystack-signature": sig,
        },
    )
    assert resp.status_code == 200, resp.text

    # Verify payment status updated to confirmed
    get_resp = await client.get(
        f"/api/finance/payments/{payment_id}",
        headers=_auth(token),
    )
    assert get_resp.status_code == 200, get_resp.text
    assert get_resp.json()["status"] == "confirmed"


# ---------------------------------------------------------------------------
# test_financial_summary_uses_sql_aggregates
# ---------------------------------------------------------------------------

async def test_financial_summary_uses_sql_aggregates(client: AsyncClient) -> None:
    school = await _register_school(client)
    token = school["access_token"]
    student_id = await _create_student(client, token)

    # Record and confirm 2 payments
    for amount in [10_000_00, 5_000_00]:  # ₦10,000 + ₦5,000 = ₦15,000 total
        rec = await client.post(
            "/api/finance/payments",
            json={**_payment_payload(student_id), "amount_kobo": amount},
            headers=_auth(token),
        )
        assert rec.status_code == 201
        pid = rec.json()["id"]
        await client.post(
            f"/api/finance/payments/{pid}/confirm",
            json={},
            headers=_auth(token),
        )

    # Also record one pending payment (should not count in total_collected)
    pending_rec = await client.post(
        "/api/finance/payments",
        json={**_payment_payload(student_id), "amount_kobo": 2_000_00},
        headers=_auth(token),
    )
    assert pending_rec.status_code == 201

    summary_resp = await client.get(
        "/api/finance/summary",
        params={"academic_session": _SESSION, "term": _TERM},
        headers=_auth(token),
    )
    assert summary_resp.status_code == 200, summary_resp.text
    body = summary_resp.json()
    assert body["total_collected_kobo"] == 15_000_00
    assert body["confirmed_payments_count"] == 2
    assert body["pending_payments_count"] == 1
    assert isinstance(body["collection_rate"], float)


# ---------------------------------------------------------------------------
# test_debtor_list_school_isolation
# ---------------------------------------------------------------------------

async def test_debtor_list_school_isolation(client: AsyncClient) -> None:
    """School A debtors must not appear in School B's debtor list."""
    school_a = await _register_school(
        client, name="School Alpha", email="alpha@school.ng"
    )
    school_b = await _register_school(
        client, name="School Beta", email="beta@school.ng"
    )
    token_a = school_a["access_token"]
    token_b = school_b["access_token"]

    # Create a student in School A with no payments (will be a debtor)
    await _create_student(client, token_a, last_name="DebtorStudentA")

    # School B has no students/payments
    debtors_b = await client.get(
        "/api/finance/debtors",
        params={"academic_session": _SESSION, "term": _TERM},
        headers=_auth(token_b),
    )
    assert debtors_b.status_code == 200, debtors_b.text
    assert debtors_b.json()["total"] == 0, "School B should see no debtors"

    debtors_a = await client.get(
        "/api/finance/debtors",
        params={"academic_session": _SESSION, "term": _TERM},
        headers=_auth(token_a),
    )
    assert debtors_a.status_code == 200, debtors_a.text
    assert debtors_a.json()["total"] >= 1, "School A should see its debtor"
