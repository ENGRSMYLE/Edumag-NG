"""Integration tests for persistent school settings."""
from __future__ import annotations

from httpx import AsyncClient

from app.utils.security import create_verification_token


async def _register_school(client: AsyncClient) -> dict:
    email = "settings-admin@school.ng"
    response = await client.post(
        "/api/auth/register-school",
        json={
            "school_name": "Settings Academy",
            "school_type": "secondary",
            "address": "1 Settings Road",
            "lga": "Ikeja",
            "state": "Lagos",
            "phone": "08012345678",
            "admin_name": "Settings Admin",
            "email": email,
            "password": "Password1!",
            "verification_token": create_verification_token(email),
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_report_settings_are_persisted(client: AsyncClient) -> None:
    registration = await _register_school(client)
    headers = {"Authorization": f"Bearer {registration['access_token']}"}

    update = await client.patch(
        "/api/settings/school",
        json={
            "motto": "Knowledge and Character",
            "report_header": "Settings Academy Report Card",
            "report_logo_position": "left",
        },
        headers=headers,
    )
    assert update.status_code == 200, update.text
    assert update.json()["motto"] == "Knowledge and Character"
    assert update.json()["report_header"] == "Settings Academy Report Card"
    assert update.json()["report_logo_position"] == "left"

    read = await client.get("/api/settings/school", headers=headers)
    assert read.status_code == 200, read.text
    assert read.json()["motto"] == "Knowledge and Character"
    assert read.json()["report_header"] == "Settings Academy Report Card"
    assert read.json()["report_logo_position"] == "left"


async def test_report_logo_position_is_validated(client: AsyncClient) -> None:
    registration = await _register_school(client)
    headers = {"Authorization": f"Bearer {registration['access_token']}"}

    response = await client.patch(
        "/api/settings/school",
        json={"report_logo_position": "top"},
        headers=headers,
    )
    assert response.status_code == 422, response.text
