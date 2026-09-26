import base64

import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from pydantic import ValidationError

from app.config import Settings


def _encoded_pair() -> tuple[str, str]:
    private_key = ec.generate_private_key(ec.SECP256R1())
    private_number = private_key.private_numbers().private_value.to_bytes(32, "big")
    public = private_key.public_key().public_numbers()
    point = b"\x04" + public.x.to_bytes(32, "big") + public.y.to_bytes(32, "big")
    encode = lambda value: base64.urlsafe_b64encode(value).rstrip(b"=").decode()
    return encode(point), encode(private_number)


def _settings(**changes) -> Settings:
    values = {
        "DATABASE_URL": "postgresql+asyncpg://user:password@localhost/test",
        "SECRET_KEY": "test-secret-key-that-is-long-enough",
        "RESEND_API_KEY": "re_test",
        "PAYSTACK_SECRET_KEY": "sk_test",
        "PAYSTACK_PUBLIC_KEY": "pk_test",
        "CLOUDINARY_CLOUD_NAME": "test",
        "CLOUDINARY_API_KEY": "test",
        "CLOUDINARY_API_SECRET": "test",
    }
    values.update(changes)
    return Settings(_env_file=None, **values)


def test_development_can_start_with_push_disabled() -> None:
    assert _settings().web_push_enabled is False


def test_backend_accepts_a_valid_vapid_pair() -> None:
    public_key, private_key = _encoded_pair()
    settings = _settings(
        WEB_PUSH_VAPID_PUBLIC_KEY=public_key,
        WEB_PUSH_VAPID_PRIVATE_KEY=private_key,
        WEB_PUSH_SUBJECT="mailto:push@example.com",
    )
    assert settings.web_push_enabled is True


def test_backend_rejects_partial_or_malformed_vapid_configuration() -> None:
    public_key, _ = _encoded_pair()
    with pytest.raises(ValidationError):
        _settings(WEB_PUSH_VAPID_PUBLIC_KEY=public_key)
    with pytest.raises(ValidationError):
        _settings(WEB_PUSH_VAPID_PUBLIC_KEY="not-a-key", WEB_PUSH_VAPID_PRIVATE_KEY="not-a-key")
