"""Integration tests for school logo upload."""
from __future__ import annotations

from unittest.mock import AsyncMock

from httpx import AsyncClient

from app.utils.security import create_verification_token


async def _register_school(client: AsyncClient) -> dict:
    email = "logo-admin@school.ng"
    response = await client.post(
        "/api/auth/register-school",
        json={
            "school_name": "Logo Academy",
            "school_type": "secondary",
            "address": "1 Logo Road",
            "lga": "Ikeja",
            "state": "Lagos",
            "phone": "08012345678",
            "admin_name": "Logo Admin",
            "email": email,
            "password": "Password1!",
            "verification_token": create_verification_token(email),
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_upload_logo_persists_url(client: AsyncClient, monkeypatch) -> None:
    registration = await _register_school(client)
    headers = {"Authorization": f"Bearer {registration['access_token']}"}
    expected_url = "https://res.cloudinary.com/test/image/upload/school-logo.png"
    upload_mock = AsyncMock(return_value=expected_url)
    monkeypatch.setattr("app.routers.settings.upload_school_logo", upload_mock)

    response = await client.post(
        "/api/settings/logo",
        files={"file": ("logo.png", b"fake-png-content", "image/png")},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"url": expected_url}
    upload_mock.assert_awaited_once()

    settings_response = await client.get("/api/settings/school", headers=headers)
    assert settings_response.status_code == 200, settings_response.text
    assert settings_response.json()["logo_url"] == expected_url


async def test_upload_logo_rejects_non_image(client: AsyncClient) -> None:
    registration = await _register_school(client)
    headers = {"Authorization": f"Bearer {registration['access_token']}"}

    response = await client.post(
        "/api/settings/logo",
        files={"file": ("notes.txt", b"not an image", "text/plain")},
        headers=headers,
    )
    assert response.status_code == 415, response.text
