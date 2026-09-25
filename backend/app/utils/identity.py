import re

from fastapi import HTTPException, status


def normalize_email(value: str) -> str:
    return value.strip().casefold()


def normalize_phone(value: str | None) -> str | None:
    """Normalize a phone number to E.164, using Nigeria for local numbers."""
    if value is None or not value.strip():
        return None
    raw = value.strip()
    digits = re.sub(r"\D", "", raw)
    if raw.startswith("+"):
        normalized = f"+{digits}"
    elif digits.startswith("234"):
        normalized = f"+{digits}"
    elif digits.startswith("0") and len(digits) == 11:
        normalized = f"+234{digits[1:]}"
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Phone must be a valid E.164 or Nigerian local number",
        )
    if not 8 <= len(normalized[1:]) <= 15:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Phone must be a valid E.164 number",
        )
    return normalized
