"""
Settings router — school profile, grade scales, academic terms.
Mounted at /api/settings.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.rbac import get_current_user, require_role
from app.models.grading_system import GradingSystem
from app.models.school import School
from app.models.school_term import SchoolTerm, SchoolTermEnum
from app.models.user import User

router = APIRouter(prefix="/settings", tags=["settings"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class SchoolSettingsOut(BaseModel):
    id: str
    name: str
    school_type: str
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    logo_url: str | None = None
    motto: str | None = None
    report_header: str | None = None
    report_logo_position: str | None = None

    class Config:
        from_attributes = True


class SchoolSettingsUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    logo_url: str | None = None
    motto: str | None = None
    report_header: str | None = None
    report_logo_position: str | None = None


class GradeScaleOut(BaseModel):
    id: str
    grade: str
    min_score: float
    max_score: float
    remark: str


class GradeScaleIn(BaseModel):
    id: str | None = None
    grade: str
    min_score: float
    max_score: float
    remark: str


class AcademicTermOut(BaseModel):
    id: str
    session: str
    term: str
    start_date: str
    end_date: str
    is_current: bool


class AcademicTermIn(BaseModel):
    session: str
    term: str
    start_date: str
    end_date: str


# ---------------------------------------------------------------------------
# GET /settings/school
# ---------------------------------------------------------------------------

@router.get("/school", response_model=SchoolSettingsOut)
async def get_school_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SchoolSettingsOut:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]
    school = (await db.execute(
        select(School).where(School.id == school_id)
    )).scalar_one_or_none()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    return SchoolSettingsOut(
        id=str(school.id),
        name=school.name,
        school_type=school.school_type.value,
        address=school.address,
        phone=school.phone,
        email=school.email,
        logo_url=school.logo_url,
    )


# ---------------------------------------------------------------------------
# PATCH /settings/school
# ---------------------------------------------------------------------------

@router.patch("/school", response_model=SchoolSettingsOut)
async def update_school_settings(
    body: SchoolSettingsUpdate,
    current_user: User = Depends(require_role("super_admin", "admin")),
    db: AsyncSession = Depends(get_db),
) -> SchoolSettingsOut:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]
    school = (await db.execute(
        select(School).where(School.id == school_id)
    )).scalar_one_or_none()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    update_data = body.model_dump(exclude_none=True)
    for field, value in update_data.items():
        if hasattr(school, field):
            setattr(school, field, value)

    await db.commit()
    await db.refresh(school)

    return SchoolSettingsOut(
        id=str(school.id),
        name=school.name,
        school_type=school.school_type.value,
        address=school.address,
        phone=school.phone,
        email=school.email,
        logo_url=school.logo_url,
    )


# ---------------------------------------------------------------------------
# GET /settings/grade-scales
# ---------------------------------------------------------------------------

_DEFAULT_GRADES = [
    {"grade": "A", "min_score": 70.0, "max_score": 100.0, "remark": "Excellent"},
    {"grade": "B", "min_score": 60.0, "max_score": 69.9, "remark": "Very Good"},
    {"grade": "C", "min_score": 50.0, "max_score": 59.9, "remark": "Good"},
    {"grade": "D", "min_score": 45.0, "max_score": 49.9, "remark": "Pass"},
    {"grade": "E", "min_score": 40.0, "max_score": 44.9, "remark": "Weak Pass"},
    {"grade": "F", "min_score": 0.0,  "max_score": 39.9, "remark": "Fail"},
]


@router.get("/grade-scales", response_model=list[GradeScaleOut])
async def get_grade_scales(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[GradeScaleOut]:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]
    rows = (await db.execute(
        select(GradingSystem)
        .where(GradingSystem.school_id == school_id)
        .order_by(GradingSystem.min_score.desc())
    )).scalars().all()

    if not rows:
        return [GradeScaleOut(id=str(uuid.uuid4()), **g) for g in _DEFAULT_GRADES]  # type: ignore[arg-type]

    return [
        GradeScaleOut(
            id=str(r.id),
            grade=r.grade,
            min_score=r.min_score,
            max_score=r.max_score,
            remark=r.remark,
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# PUT /settings/grade-scales
# ---------------------------------------------------------------------------

@router.put("/grade-scales", response_model=list[GradeScaleOut])
async def update_grade_scales(
    body: list[GradeScaleIn],
    current_user: User = Depends(require_role("super_admin", "admin")),
    db: AsyncSession = Depends(get_db),
) -> list[GradeScaleOut]:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]

    # Delete existing
    existing = (await db.execute(
        select(GradingSystem).where(GradingSystem.school_id == school_id)
    )).scalars().all()
    for row in existing:
        await db.delete(row)

    # Insert new
    new_rows = []
    for g in body:
        row = GradingSystem(
            school_id=school_id,
            grade=g.grade,
            min_score=g.min_score,
            max_score=g.max_score,
            remark=g.remark,
        )
        db.add(row)
        new_rows.append(row)

    await db.commit()
    for row in new_rows:
        await db.refresh(row)

    return [
        GradeScaleOut(id=str(r.id), grade=r.grade, min_score=r.min_score, max_score=r.max_score, remark=r.remark)
        for r in new_rows
    ]


# ---------------------------------------------------------------------------
# GET /settings/terms
# ---------------------------------------------------------------------------

@router.get("/terms", response_model=list[AcademicTermOut])
async def get_terms(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AcademicTermOut]:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]
    rows = (await db.execute(
        select(SchoolTerm)
        .where(SchoolTerm.school_id == school_id)
        .order_by(SchoolTerm.academic_session.desc(), SchoolTerm.term)
    )).scalars().all()

    return [
        AcademicTermOut(
            id=str(r.id),
            session=r.academic_session,
            term=r.term.value,
            start_date=r.start_date.isoformat(),
            end_date=r.end_date.isoformat(),
            is_current=r.is_current,
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# POST /settings/terms
# ---------------------------------------------------------------------------

@router.post("/terms", response_model=AcademicTermOut, status_code=status.HTTP_201_CREATED)
async def create_term(
    body: AcademicTermIn,
    current_user: User = Depends(require_role("super_admin", "admin")),
    db: AsyncSession = Depends(get_db),
) -> AcademicTermOut:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]

    try:
        term_enum = SchoolTermEnum(body.term)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid term: {body.term}")

    from datetime import date
    row = SchoolTerm(
        school_id=school_id,
        academic_session=body.session,
        term=term_enum,
        start_date=date.fromisoformat(body.start_date),
        end_date=date.fromisoformat(body.end_date),
        is_current=False,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)

    return AcademicTermOut(
        id=str(row.id),
        session=row.academic_session,
        term=row.term.value,
        start_date=row.start_date.isoformat(),
        end_date=row.end_date.isoformat(),
        is_current=row.is_current,
    )


# ---------------------------------------------------------------------------
# PATCH /settings/terms/{id}/set-current
# ---------------------------------------------------------------------------

@router.patch("/terms/{term_id}/set-current", response_model=AcademicTermOut)
async def set_current_term(
    term_id: uuid.UUID,
    current_user: User = Depends(require_role("super_admin", "admin")),
    db: AsyncSession = Depends(get_db),
) -> AcademicTermOut:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]

    # Unset all current
    all_terms = (await db.execute(
        select(SchoolTerm).where(SchoolTerm.school_id == school_id, SchoolTerm.is_current == True)
    )).scalars().all()
    for t in all_terms:
        t.is_current = False

    # Set target as current
    target = (await db.execute(
        select(SchoolTerm).where(SchoolTerm.id == term_id, SchoolTerm.school_id == school_id)
    )).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Term not found")

    target.is_current = True
    await db.commit()
    await db.refresh(target)

    return AcademicTermOut(
        id=str(target.id),
        session=target.academic_session,
        term=target.term.value,
        start_date=target.start_date.isoformat(),
        end_date=target.end_date.isoformat(),
        is_current=target.is_current,
    )


# ---------------------------------------------------------------------------
# GET /settings/logs  (stub — audit logs not yet implemented)
# ---------------------------------------------------------------------------

@router.get("/logs")
async def get_audit_logs(
    current_user: User = Depends(require_role("super_admin", "admin")),
) -> dict[str, Any]:
    return {"items": [], "total": 0, "page": 1, "per_page": 20}
