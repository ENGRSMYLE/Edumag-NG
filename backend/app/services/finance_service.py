"""
Finance service — payment reference generation, Paystack signature verification,
debtor balance calculation.
"""
from __future__ import annotations

import hashlib
import hmac
import random
import string
import time
import uuid
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import Payment, PaymentStatus


def _random_suffix(n: int = 4) -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=n))


async def generate_payment_reference(
    db: AsyncSession,
    school_id: uuid.UUID,
) -> str:
    """
    Generate a unique payment reference in the format:
    EDU-{SCHOOL_SHORT}-{TIMESTAMP}-{RANDOM4}
    Retries until uniqueness confirmed.
    """
    school_short = str(school_id).split("-")[0].upper()
    for _ in range(10):
        ts = int(time.time())
        candidate = f"EDU-{school_short}-{ts}-{_random_suffix()}"
        existing = await db.execute(
            select(Payment.id).where(Payment.reference == candidate).limit(1)
        )
        if existing.scalar_one_or_none() is None:
            return candidate
    raise RuntimeError("Could not generate a unique payment reference after 10 attempts")


def verify_paystack_signature(payload: bytes, signature: str, secret: str) -> bool:
    """HMAC SHA512 verification of Paystack webhook payload."""
    computed = hmac.new(
        secret.encode("utf-8"),
        msg=payload,
        digestmod=hashlib.sha512,
    ).hexdigest()
    return hmac.compare_digest(computed, signature)


async def get_confirmed_paid_kobo(
    db: AsyncSession,
    school_id: uuid.UUID,
    student_id: uuid.UUID,
    academic_session: str,
    term: str,
) -> tuple[int, Optional[object]]:
    """
    Returns (total_confirmed_kobo, last_paid_at) for a student in a term.
    Uses SQL aggregates — no Python loops.
    """
    row = await db.execute(
        select(
            func.coalesce(func.sum(Payment.amount_kobo), 0).label("total"),
            func.max(Payment.paid_at).label("last_paid"),
        ).where(
            Payment.school_id == school_id,
            Payment.student_id == student_id,
            Payment.academic_session == academic_session,
            Payment.term == term,
            Payment.status == PaymentStatus.confirmed,
        )
    )
    r = row.one()
    return int(r.total), r.last_paid
