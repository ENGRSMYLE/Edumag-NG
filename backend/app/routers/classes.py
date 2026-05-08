"""
Classes router — /api/classes
Every query filters by school_id; no cross-tenant data ever returned.
"""
from __future__ import annotations

import math
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.dependencies.rbac import require_permission
from app.models.class_ import Class
from app.models.school_membership import SchoolMembership
from app.models.student import Student
from app.models.user import User
from app.schemas.class_ import (
    AssignTeacherRequest,
    ClassCreate,
    ClassListItem,
    ClassResponse,
    ClassUpdate,
    PaginatedClassResponse,
)
from app.schemas.student import PaginatedStudentResponse, StudentListItem
from app.models.school_membership import SchoolMembership

router = APIRouter(prefix="/classes", tags=["classes"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _student_count_subquery(class_id_col):
    """Return a scalar subquery: number of active students in a class."""
    return (
        select(func.count(Student.id))
        .where(Student.class_id == class_id_col, Student.is_active.is_(True))
        .correlate_except(Student)
        .scalar_subquery()
    )


def _teacher_name(class_obj: Class) -> Optional[str]:
    if class_obj.class_teacher:
        return class_obj.class_teacher.name
    return None


def _to_class_response(class_obj: Class, student_count: int) -> ClassResponse:
    return ClassResponse(
        id=class_obj.id,
        school_id=class_obj.school_id,
        name=class_obj.name,
        level=class_obj.level,
        arm=class_obj.arm,
        teacher_id=class_obj.teacher_id,
        teacher_name=_teacher_name(class_obj),
        capacity=class_obj.capacity,
        academic_session=class_obj.academic_session,
        term=class_obj.term,
        is_active=class_obj.is_active,
        student_count=student_count,
        created_at=class_obj.created_at,
        updated_at=class_obj.updated_at,
    )


def _to_list_item(class_obj: Class, student_count: int) -> ClassListItem:
    return ClassListItem(
        id=class_obj.id,
        name=class_obj.name,
        level=class_obj.level,
        arm=class_obj.arm,
        teacher_name=_teacher_name(class_obj),
        student_count=student_count,
        academic_session=class_obj.academic_session,
        term=class_obj.term,
        is_active=class_obj.is_active,
    )


async def _sync_teacher_membership(
    teacher_id: Optional[uuid.UUID],
    class_id: Optional[uuid.UUID],
    school_id: uuid.UUID,
    db: AsyncSession,
) -> None:
    """Update SchoolMembership.class_id so the teacher's JWT reflects the new assignment."""
    if teacher_id is None:
        return
    result = await db.execute(
        select(SchoolMembership).where(
            SchoolMembership.user_id == teacher_id,
            SchoolMembership.school_id == school_id,
        )
    )
    membership = result.scalar_one_or_none()
    if membership:
        membership.class_id = class_id


async def _get_class_or_404(
    class_id: uuid.UUID, school_id: uuid.UUID, db: AsyncSession
) -> Class:
    result = await db.execute(
        select(Class)
        .where(Class.id == class_id, Class.school_id == school_id)
        .options(selectinload(Class.class_teacher))
    )
    obj = result.scalar_one_or_none()
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    return obj


async def _count_students(class_id: uuid.UUID, db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count(Student.id)).where(
            Student.class_id == class_id, Student.is_active.is_(True)
        )
    )
    return result.scalar_one()


async def _verify_teacher_in_school(
    teacher_id: uuid.UUID, school_id: uuid.UUID, db: AsyncSession
) -> SchoolMembership:
    """Raise 404 if the teacher does not belong to this school with role=teacher."""
    result = await db.execute(
        select(SchoolMembership).where(
            SchoolMembership.user_id == teacher_id,
            SchoolMembership.school_id == school_id,
            SchoolMembership.role == "teacher",
            SchoolMembership.is_active.is_(True),
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found in this school",
        )
    return membership


# ---------------------------------------------------------------------------
# POST /api/classes/
# ---------------------------------------------------------------------------

@router.post("/", status_code=status.HTTP_201_CREATED, response_model=ClassResponse)
async def create_class(
    payload: ClassCreate,
    current_user: User = Depends(require_permission("create_class")),
    db: AsyncSession = Depends(get_db),
) -> ClassResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[attr-defined]

    # Verify teacher belongs to school (if provided)
    if payload.teacher_id:
        await _verify_teacher_in_school(payload.teacher_id, school_id, db)

    # Duplicate check: same name + session + term within the same school
    dup = await db.execute(
        select(Class).where(
            Class.school_id == school_id,
            Class.name == payload.name,
            Class.academic_session == payload.academic_session,
            Class.term == payload.term,
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A class with this name, session, and term already exists",
        )

    class_obj = Class(
        school_id=school_id,
        name=payload.name,
        level=payload.level,
        arm=payload.arm,
        teacher_id=payload.teacher_id,
        capacity=payload.capacity,
        academic_session=payload.academic_session,
        term=payload.term,
    )
    db.add(class_obj)
    await db.flush()

    # Sync teacher's membership so their JWT reflects the class assignment
    await _sync_teacher_membership(payload.teacher_id, class_obj.id, school_id, db)

    await db.commit()
    await db.refresh(class_obj)

    # Reload with teacher relationship
    class_obj = await _get_class_or_404(class_obj.id, school_id, db)
    count = await _count_students(class_obj.id, db)
    return _to_class_response(class_obj, count)


# ---------------------------------------------------------------------------
# GET /api/classes/
# ---------------------------------------------------------------------------

@router.get("/", response_model=PaginatedClassResponse)
async def list_classes(
    academic_session: Optional[str] = Query(None),
    term: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_permission("view_class_list")),
    db: AsyncSession = Depends(get_db),
) -> PaginatedClassResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[attr-defined]

    stmt = (
        select(Class)
        .where(Class.school_id == school_id)
        .options(selectinload(Class.class_teacher))
    )

    if academic_session:
        stmt = stmt.where(Class.academic_session == academic_session)
    if term:
        stmt = stmt.where(Class.term == term)
    if is_active is not None:
        stmt = stmt.where(Class.is_active.is_(is_active))
    if search:
        stmt = stmt.where(Class.name.ilike(f"%{search}%"))

    total_result = await db.execute(
        select(func.count()).select_from(stmt.subquery())
    )
    total = total_result.scalar_one()

    stmt = stmt.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(stmt)
    classes = result.scalars().all()

    # Gather student counts in one query
    class_ids = [c.id for c in classes]
    count_rows: dict[uuid.UUID, int] = {}
    if class_ids:
        counts = await db.execute(
            select(Student.class_id, func.count(Student.id))
            .where(
                Student.class_id.in_(class_ids),
                Student.is_active.is_(True),
            )
            .group_by(Student.class_id)
        )
        count_rows = {row[0]: row[1] for row in counts}

    items = [_to_list_item(c, count_rows.get(c.id, 0)) for c in classes]

    return PaginatedClassResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 1,
    )


# ---------------------------------------------------------------------------
# GET /api/classes/{class_id}
# ---------------------------------------------------------------------------

@router.get("/{class_id}", response_model=ClassResponse)
async def get_class(
    class_id: uuid.UUID,
    current_user: User = Depends(require_permission("view_class_list")),
    db: AsyncSession = Depends(get_db),
) -> ClassResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[attr-defined]
    class_obj = await _get_class_or_404(class_id, school_id, db)
    count = await _count_students(class_obj.id, db)
    return _to_class_response(class_obj, count)


# ---------------------------------------------------------------------------
# PATCH /api/classes/{class_id}
# ---------------------------------------------------------------------------

@router.patch("/{class_id}", response_model=ClassResponse)
async def update_class(
    class_id: uuid.UUID,
    payload: ClassUpdate,
    current_user: User = Depends(require_permission("edit_class")),
    db: AsyncSession = Depends(get_db),
) -> ClassResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[attr-defined]
    class_obj = await _get_class_or_404(class_id, school_id, db)

    old_teacher_id = class_obj.teacher_id

    if payload.teacher_id is not None:
        await _verify_teacher_in_school(payload.teacher_id, school_id, db)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(class_obj, field, value)

    # Sync memberships when teacher assignment changes
    new_teacher_id = update_data.get("teacher_id", old_teacher_id)
    if "teacher_id" in update_data:
        # Clear old teacher's class assignment
        if old_teacher_id and old_teacher_id != new_teacher_id:
            await _sync_teacher_membership(old_teacher_id, None, school_id, db)
        # Set new teacher's class assignment
        await _sync_teacher_membership(new_teacher_id, class_obj.id, school_id, db)

    await db.commit()
    await db.refresh(class_obj)
    class_obj = await _get_class_or_404(class_obj.id, school_id, db)
    count = await _count_students(class_obj.id, db)
    return _to_class_response(class_obj, count)


# ---------------------------------------------------------------------------
# POST /api/classes/{class_id}/assign-teacher
# ---------------------------------------------------------------------------

@router.post("/{class_id}/assign-teacher", response_model=ClassResponse)
async def assign_teacher(
    class_id: uuid.UUID,
    payload: AssignTeacherRequest,
    current_user: User = Depends(require_permission("assign_teacher_to_class")),
    db: AsyncSession = Depends(get_db),
) -> ClassResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[attr-defined]
    class_obj = await _get_class_or_404(class_id, school_id, db)

    membership = await _verify_teacher_in_school(payload.teacher_id, school_id, db)

    # Warn if teacher is already assigned to another class in this school
    existing_assignment = await db.execute(
        select(Class).where(
            Class.school_id == school_id,
            Class.teacher_id == payload.teacher_id,
            Class.id != class_id,
            Class.is_active.is_(True),
        )
    )
    other_class = existing_assignment.scalar_one_or_none()
    if other_class:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Teacher is already assigned to class '{other_class.name}'. Remove them first.",
        )

    old_teacher_id = class_obj.teacher_id
    class_obj.teacher_id = payload.teacher_id

    # Clear old teacher's membership and assign new teacher
    if old_teacher_id and old_teacher_id != payload.teacher_id:
        await _sync_teacher_membership(old_teacher_id, None, school_id, db)
    await _sync_teacher_membership(payload.teacher_id, class_obj.id, school_id, db)

    await db.commit()
    await db.refresh(class_obj)
    class_obj = await _get_class_or_404(class_obj.id, school_id, db)
    count = await _count_students(class_obj.id, db)
    return _to_class_response(class_obj, count)


# ---------------------------------------------------------------------------
# DELETE /api/classes/{class_id}/remove-teacher
# ---------------------------------------------------------------------------

@router.delete("/{class_id}/remove-teacher", response_model=ClassResponse)
async def remove_teacher(
    class_id: uuid.UUID,
    current_user: User = Depends(require_permission("assign_teacher_to_class")),
    db: AsyncSession = Depends(get_db),
) -> ClassResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[attr-defined]
    class_obj = await _get_class_or_404(class_id, school_id, db)

    old_teacher_id = class_obj.teacher_id
    class_obj.teacher_id = None

    await _sync_teacher_membership(old_teacher_id, None, school_id, db)

    await db.commit()
    await db.refresh(class_obj)
    class_obj = await _get_class_or_404(class_obj.id, school_id, db)
    count = await _count_students(class_obj.id, db)
    return _to_class_response(class_obj, count)


# ---------------------------------------------------------------------------
# GET /api/classes/{class_id}/students
# ---------------------------------------------------------------------------

@router.get("/{class_id}/students", response_model=PaginatedStudentResponse)
async def get_class_students(
    class_id: uuid.UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_permission("view_class_list")),
    db: AsyncSession = Depends(get_db),
) -> PaginatedStudentResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[attr-defined]

    # Confirm class belongs to this school
    await _get_class_or_404(class_id, school_id, db)

    stmt = select(Student).where(
        Student.school_id == school_id,
        Student.class_id == class_id,
        Student.is_active.is_(True),
    )

    total_result = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = total_result.scalar_one()

    result = await db.execute(stmt.offset((page - 1) * per_page).limit(per_page))
    students = result.scalars().all()

    items = [
        StudentListItem(
            id=s.id,
            full_name=f"{s.first_name} {s.last_name}",
            admission_number=s.admission_number,
            class_name=None,
            gender=s.gender,
            is_active=s.is_active,
            admission_date=s.admission_date,
            photo_url=s.photo_url,
        )
        for s in students
    ]

    return PaginatedStudentResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 1,
    )
