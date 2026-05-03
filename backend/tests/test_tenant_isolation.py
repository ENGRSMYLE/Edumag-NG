"""Tests proving that School A cannot see or modify School B's data."""
import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers — register two distinct schools
# ---------------------------------------------------------------------------

async def _register_school(client: AsyncClient, suffix: str) -> dict:
    resp = await client.post(
        "/api/auth/register-school",
        json={
            "school_name": f"School {suffix}",
            "school_type": "primary",
            "address": f"{suffix} Example Road",
            "lga": "Eti-Osa",
            "state": "Lagos",
            "phone": "08011223344",
            "admin_name": f"Admin {suffix}",
            "email": f"admin{suffix}@isolation.com",
            "password": "Password1",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _login(client: AsyncClient, email: str, password: str = "Password1") -> str:
    resp = await client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


# ---------------------------------------------------------------------------
# test_school_a_cannot_see_school_b_users
# ---------------------------------------------------------------------------

async def test_school_a_cannot_see_school_b_users(client: AsyncClient) -> None:
    """
    School A's super_admin calling GET /api/users/ must only receive
    School A users — School B's users must never appear.
    """
    # Register both schools (each creates a super_admin user)
    school_a_data = await _register_school(client, "AlphaIso")
    school_b_data = await _register_school(client, "BetaIso")

    school_a_token = await _login(client, "adminAlphaIso@isolation.com")
    school_b_user_id = school_b_data["user"]["id"]
    school_b_email = school_b_data["user"]["email"]

    # School A queries its user list
    resp = await client.get(
        "/api/users/",
        headers={"Authorization": f"Bearer {school_a_token}"},
    )
    assert resp.status_code == 200
    body = resp.json()

    returned_ids = {u["user_id"] for u in body["items"]}
    returned_emails = {u["email"] for u in body["items"]}

    # School B's super_admin must NOT appear in School A's list
    assert str(school_b_user_id) not in {str(i) for i in returned_ids}, (
        "School A can see School B's user — tenant isolation is broken!"
    )
    assert school_b_email not in returned_emails, (
        "School A can see School B's user email — tenant isolation is broken!"
    )

    # School A's own super_admin SHOULD appear
    school_a_email = school_a_data["user"]["email"]
    assert school_a_email in returned_emails


# ---------------------------------------------------------------------------
# test_cannot_deactivate_other_school_user
# ---------------------------------------------------------------------------

async def test_cannot_deactivate_other_school_user(client: AsyncClient) -> None:
    """
    School A's super_admin trying to PATCH /api/users/{school_b_user_id}/deactivate
    must receive 404 — the user does not exist *within School A's tenant*.
    """
    await _register_school(client, "GammaIso")
    school_b_data = await _register_school(client, "DeltaIso")

    school_a_token = await _login(client, "adminGammaIso@isolation.com")
    school_b_user_id = school_b_data["user"]["id"]

    resp = await client.patch(
        f"/api/users/{school_b_user_id}/deactivate",
        headers={"Authorization": f"Bearer {school_a_token}"},
        json={},
    )
    # Must be 404 — the target user is invisible across tenant boundaries
    assert resp.status_code == 404, (
        f"Expected 404 but got {resp.status_code}: {resp.text}\n"
        "Cross-tenant deactivation should be impossible — user must not be found."
    )
