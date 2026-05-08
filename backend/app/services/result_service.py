"""
Result service — grade computation, position ranking, upsert helper.
"""
from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.grading_system import GradingSystem
from app.models.result import Result

# ---------------------------------------------------------------------------
# Default grading scale (used when school has no custom grading system)
# ---------------------------------------------------------------------------

_DEFAULT_GRADING = [
    {"grade": "A", "min": 75.0, "max": 100.0, "remark": "Excellent"},
    {"grade": "B", "min": 65.0, "max": 74.9, "remark": "Very Good"},
    {"grade": "C", "min": 55.0, "max": 64.9, "remark": "Good"},
    {"grade": "D", "min": 45.0, "max": 54.9, "remark": "Pass"},
    {"grade": "E", "min": 35.0, "max": 44.9, "remark": "Below Average"},
    {"grade": "F", "min": 0.0,  "max": 34.9, "remark": "Fail"},
]


def compute_grade(
    total_score: float,
    grading_system: list[GradingSystem],
) -> tuple[str, str]:
    """
    Return (grade_letter, remark) for a given total score.
    Uses the school's custom grading system if provided; falls back to defaults.
    """
    for gs in sorted(grading_system, key=lambda g: g.min_score, reverse=True):
        if gs.min_score <= total_score <= gs.max_score:
            return gs.grade, gs.remark

    # Fallback to built-in defaults
    for row in _DEFAULT_GRADING:
        if row["min"] <= total_score <= row["max"]:
            return row["grade"], row["remark"]

    return "F", "Fail"


def grade_to_remark(
    grade: Optional[str],
    grading_system: list[GradingSystem],
) -> Optional[str]:
    """
    Reverse-lookup: given a stored grade letter, find its remark.
    Used when building ResultResponse from stored Result rows.
    """
    if grade is None:
        return None
    for gs in grading_system:
        if gs.grade == grade:
            return gs.remark
    for row in _DEFAULT_GRADING:
        if row["grade"] == grade:
            return row["remark"]
    return None


async def get_grading_system(db: AsyncSession, school_id: uuid.UUID) -> list[GradingSystem]:
    """Fetch school's custom grading scale. Returns empty list if none defined."""
    result = await db.execute(
        select(GradingSystem)
        .where(GradingSystem.school_id == school_id)
        .order_by(GradingSystem.min_score.desc())
    )
    return list(result.scalars().all())


async def compute_position(
    db: AsyncSession,
    class_id: uuid.UUID,
    academic_session: str,
    term: str,
    school_id: uuid.UUID,
) -> dict[uuid.UUID, int]:
    """
    Rank students in a class by their average total_score across all subjects.
    Returns {student_id: position} with standard competition ranking (ties share rank).
    """
    result = await db.execute(
        select(
            Result.student_id,
            func.avg(Result.total_score).label("avg_score"),
        )
        .where(
            Result.school_id == school_id,
            Result.class_id == class_id,
            Result.academic_session == academic_session,
            Result.term == term,
            Result.total_score.is_not(None),
        )
        .group_by(Result.student_id)
        .order_by(func.avg(Result.total_score).desc())
    )
    rows = result.all()

    positions: dict[uuid.UUID, int] = {}
    prev_score: Optional[float] = None
    rank = 0
    for i, row in enumerate(rows):
        if row.avg_score != prev_score:
            rank = i + 1  # standard competition rank
        positions[row.student_id] = rank
        prev_score = row.avg_score

    return positions


async def get_or_create_result(
    db: AsyncSession,
    school_id: uuid.UUID,
    student_id: uuid.UUID,
    class_id: uuid.UUID,
    subject: str,
    academic_session: str,
    term: str,
    entered_by: uuid.UUID,
) -> Result:
    """
    Fetch existing result for student+subject+session+term, or create a new one.
    Used for single-record operations (e.g. adding a comment).
    For bulk score entry, use pg_insert upsert in the router instead.
    """
    existing = await db.execute(
        select(Result).where(
            Result.school_id == school_id,
            Result.student_id == student_id,
            Result.subject == subject,
            Result.academic_session == academic_session,
            Result.term == term,
        )
    )
    rec = existing.scalar_one_or_none()
    if rec is None:
        rec = Result(
            school_id=school_id,
            student_id=student_id,
            class_id=class_id,
            subject=subject,
            academic_session=academic_session,
            term=term,
            entered_by=entered_by,
        )
        db.add(rec)
        await db.flush()
    return rec
