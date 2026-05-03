import hashlib
import random
import secrets
import string
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


def _encode(payload: dict, expires_delta: timedelta) -> str:
    expire = datetime.now(timezone.utc) + expires_delta
    payload = {**payload, "exp": expire, "iat": datetime.now(timezone.utc)}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_access_token(data: dict) -> str:
    """
    data must contain: sub (user_id), school_id, role, membership_id
    """
    return _encode(
        {**data, "type": "access"},
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(data: dict) -> str:
    return _encode(
        {**data, "type": "refresh"},
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def create_invite_token(membership_id: str) -> str:
    return _encode(
        {"sub": membership_id, "type": "invite"},
        timedelta(hours=settings.INVITE_TOKEN_EXPIRE_HOURS),
    )


def create_temp_token(user_id: str) -> str:
    """
    Short-lived token (5 minutes) issued during login when user belongs to
    multiple schools. Contains only user_id. Used to safely identify the
    user during school selection without granting full dashboard access.
    """
    return _encode(
        {"sub": user_id, "type": "temp"},
        timedelta(minutes=5),
    )


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def hash_token(raw_token: str) -> str:
    """SHA-256 hash of a raw token string for safe DB storage."""
    return hashlib.sha256(raw_token.encode()).hexdigest()


def generate_temp_password() -> str:
    chars = string.ascii_letters + string.digits
    return "".join(random.SystemRandom().choice(chars) for _ in range(10))


def create_verification_token(email: str) -> str:
    """Short-lived JWT (15 min) proving email ownership. Sent back after OTP verified."""
    return _encode(
        {"email": email, "type": "email_verification"},
        timedelta(minutes=15),
    )


def generate_otp() -> str:
    """Cryptographically secure 6-digit OTP. Range 100000-999999, never starts with 0."""
    return str(secrets.randbelow(900000) + 100000)


def hash_otp(otp: str) -> str:
    """Hash OTP with bcrypt before storing."""
    return hash_password(otp)


def verify_otp(plain_otp: str, hashed_otp: str) -> bool:
    """Verify OTP against stored bcrypt hash."""
    return verify_password(plain_otp, hashed_otp)
