"""
Parents router — /api/parents
Every query filters by school_id via student join; no cross-tenant data ever returned.
"""
from __future__ import annotations

import math
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.dependencies.rbac import require_permission
from app.models.parent import Parent
from app.models.student import Student
from app.models.user import User
from app.schemas.parent import (
    PaginatedParentResponse,
    ParentCreate,
    ParentListItem,
    ParentResponse,
    ParentUpdate,
)

router = APIRouter(prefix="/parents", tags=["parents"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _student_full_name(student: Student) -> str:
    return f"{student.first_name} {student.last_name}"


def _to_response(parent: Parent, student_name: str) -> ParentResponse:
    return ParentResponse(
        id=parent.id,
        school_id=parent.school_id,
        student_id=parent.student_id,
        student_name=student_name,
        name=parent.name,
        relationship=parent.relation_type,
        phone=parent.phone,
        email=parent.email,
        address=parent.address,
        occupation=parent.occupation,
        is_primary=parent.is_primary,
        created_at=parent.created_at,
        updated_at=parent.updated_at,
    )


def _to_list_item(parent: Parent, student_name: str) -> ParentListItem:
    return ParentListItem(
        id=parent.id,
        name=parent.name,
        relationship=parent.relation_type,
        phone=parent.phone,
        email=parent.email,
        student_name=student_name,
        is_primary=parent.is_primary,
    )


async def _get_student_or_404(
    student_id: uuid.UUID, school_id: uuid.UUID, db: AsyncSession
) -> Student:
    result = await db.execute(
        select(Student).where(
            Student.id == student_id,
            Student.school_id == school_id,
        )
    )
    student = result.scalar_one_or_none()
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    return student


async def _get_parent_or_404(
    parent_id: uuid.UUID, school_id: uuid.UUID, db: AsyncSession
) -> tuple[Parent, Student]:
    """Fetch parent + its student, verifying school_id via the student join."""
    result = await db.execute(
        select(Parent)
        .where(Parent.id == parent_id, Parent.school_id == school_id)
        .options(selectinload(Parent.student))
    )
    parent = result.scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent not found")
    return parent, parent.student


# ---------------------------------------------------------------------------
# POST /api/parents/
# ---------------------------------------------------------------------------

@router.post("/", status_code=status.HTTP_201_CREATED, response_model=ParentResponse)
async def create_parent(
    payload: ParentCreate,
    current_user: User = Depends(require_permission("add_parent")),
    db: AsyncSession = Depends(get_db),
) -> ParentResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[attr-defined]

    student = await _get_student_or_404(payload.student_id, school_id, db)

    # If this parent is primary, demote all existing primary parents for student
    if payload.is_primary:
        await db.execute(
            update(Parent)
            .where(
                Parent.student_id == payload.student_id,
                Parent.school_id == school_id,
                Parent.is_primary.is_(True),
            )
            .values(is_primary=False)
        )

    parent = Parent(
        school_id=school_id,
        student_id=payload.student_id,
        name=payload.name,
        relation_type=payload.relationship,
        phone=payload.phone,
        email=payload.email,
        address=payload.address,
        occupation=payload.occupation,
        is_primary=payload.is_primary,
    )
    db.add(parent)
    await db.commit()
    await db.refresh(parent)

    return _to_response(parent, _student_full_name(student))


# ---------------------------------------------------------------------------
# GET /api/parents/
# ---------------------------------------------------------------------------

@router.get("/", response_model=PaginatedParentResponse)
async def list_parents(
    student_id: Optional[uuid.UUID] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_permission("view_parent_contact")),
    db: AsyncSession = Depends(get_db),
) -> PaginatedParentResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[attr-defined]

    stmt = (
        select(Parent)
        .where(Parent.school_id == school_id)
        .options(selectinload(Parent.student))
    )

    if student_id:
        stmt = stmt.where(Parent.student_id == student_id)
    if search:
        stmt = stmt.where(
            Parent.name.ilike(f"%{search}%") | Parent.phone.ilike(f"%{search}%")
        )

    total_result = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = total_result.scalar_one()

    result = await db.execute(stmt.offset((page - 1) * per_page).limit(per_page))
    parents = result.scalars().all()

    items = [_to_list_item(p, _student_full_name(p.student)) for p in parents]

    return PaginatedParentResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 1,
    )


# ---------------------------------------------------------------------------
# GET /api/parents/{parent_id}
# ---------------------------------------------------------------------------

@router.get("/{parent_id}", response_model=ParentResponse)
async def get_parent(
    parent_id: uuid.UUID,
    current_user: User = Depends(require_permission("view_parent_contact")),
    db: AsyncSession = Depends(get_db),
) -> ParentResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[attr-defined]
    parent, student = await _get_parent_or_404(parent_id, school_id, db)
    return _to_response(parent, _student_full_name(student))


# ---------------------------------------------------------------------------
# PATCH /api/parents/{parent_id}
# ---------------------------------------------------------------------------

@router.patch("/{parent_id}", response_model=ParentResponse)
async def update_parent(
    parent_id: uuid.UUID,
    payload: ParentUpdate,
    current_user: User = Depends(require_permission("edit_parent")),
    db: AsyncSession = Depends(get_db),
) -> ParentResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[attr-defined]
    parent, student = await _get_parent_or_404(parent_id, school_id, db)

    # If being promoted to primary, demote existing primary parent(s) first
    if payload.is_primary is True:
        await db.execute(
            update(Parent)
            .where(
                Parent.student_id == parent.student_id,
                Parent.school_id == school_id,
                Parent.is_primary.is_(True),
                Parent.id != parent_id,
            )
            .values(is_primary=False)
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        # Schema field 'relationship' maps to model field 'relation_type'
        if field == "relationship":
            parent.relation_type = value
        else:
            setattr(parent, field, value)

    await db.commit()
    await db.refresh(parent)
    return _to_response(parent, _student_full_name(student))


# ---------------------------------------------------------------------------
# DELETE /api/parents/{parent_id}
# ---------------------------------------------------------------------------

@router.delete("/{parent_id}")
async def delete_parent(
    parent_id: uuid.UUID,
    current_user: User = Depends(require_permission("edit_parent")),
    db: AsyncSession = Depends(get_db),
) -> Response:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[attr-defined]
    parent, _ = await _get_parent_or_404(parent_id, school_id, db)
    await db.delete(parent)
    await db.commit()
    return Response(status_code=204)
