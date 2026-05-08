"""
Assignments router — create, list, grade, manage assignment submissions.
"""
from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.rbac import require_permission
from app.models.assignment import Assignment, AssignmentSubmission
from app.models.class_ import Class
from app.models.student import Student
from app.models.user import User
from app.schemas.assignment import (
    AssignmentCreate,
    AssignmentResponse,
    AssignmentUpdate,
    GradeSubmissionRequest,
    PaginatedAssignmentResponse,
    SubmissionResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/assignments", tags=["assignments"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _submission_response(sub: AssignmentSubmission) -> SubmissionResponse:
    return SubmissionResponse(
        id=sub.id,
        assignment_id=sub.assignment_id,
        assignment_title=sub.assignment.title,
        student_id=sub.student_id,
        student_name=f"{sub.student.first_name} {sub.student.last_name}",
        score=sub.score,
        feedback=sub.feedback,
        file_url=sub.file_url,
        submitted_at=sub.submitted_at,
        graded_at=sub.graded_at,
        is_graded=sub.score is not None,
    )


async def _build_assignment_response(
    db: AsyncSession, a: Assignment
) -> AssignmentResponse:
    counts = await db.execute(
        select(
            func.count(AssignmentSubmission.id).label("total"),
            func.count(AssignmentSubmission.score).label("graded"),
        ).where(AssignmentSubmission.assignment_id == a.id)
    )
    row = counts.one()
    return AssignmentResponse(
        id=a.id,
        class_id=a.class_id,
        class_name=a.class_.name,
        teacher_name=a.teacher.name,
        title=a.title,
        subject=a.subject,
        description=a.description,
        due_date=a.due_date,
        max_score=a.max_score,
        file_url=a.file_url,
        submission_count=row.total,
        graded_count=row.graded,
        created_at=a.created_at,
    )


_ASSIGNMENT_OPTIONS = [
    selectinload(Assignment.class_),
    selectinload(Assignment.teacher),
]


async def _get_assignment_or_404(
    db: AsyncSession,
    assignment_id: uuid.UUID,
    school_id: uuid.UUID,
) -> Assignment:
    result = await db.execute(
        select(Assignment)
        .where(Assignment.id == assignment_id, Assignment.school_id == school_id)
        .options(*_ASSIGNMENT_OPTIONS)
    )
    a = result.scalar_one_or_none()
    if a is None:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return a


def _assert_teacher_owns(a: Assignment, current_user: User) -> None:
    role = current_user.current_role.value  # type: ignore[attr-defined]
    if role == "teacher" and a.teacher_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own assignments",
        )


# ---------------------------------------------------------------------------
# POST / — create assignment
# ---------------------------------------------------------------------------

@router.post("/", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
async def create_assignment(
    body: AssignmentCreate,
    current_user: User = Depends(require_permission("create_assignment")),
    db: AsyncSession = Depends(get_db),
) -> AssignmentResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]

    class_result = await db.execute(
        select(Class).where(Class.id == body.class_id, Class.school_id == school_id)
    )
    class_obj = class_result.scalar_one_or_none()
    if class_obj is None:
        raise HTTPException(status_code=404, detail="Class not found")

    role = current_user.current_role.value  # type: ignore[attr-defined]
    if role == "teacher" and class_obj.teacher_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not assigned to this class",
        )

    assignment = Assignment(
        school_id=school_id,
        class_id=body.class_id,
        teacher_id=current_user.id,
        title=body.title,
        subject=body.subject,
        description=body.description,
        due_date=body.due_date,
        max_score=body.max_score,
        file_url=body.file_url,
    )
    db.add(assignment)
    await db.flush()

    a = await _get_assignment_or_404(db, assignment.id, school_id)
    await db.commit()
    return await _build_assignment_response(db, a)


# ---------------------------------------------------------------------------
# GET / — list assignments
# ---------------------------------------------------------------------------

@router.get("/", response_model=PaginatedAssignmentResponse)
async def list_assignments(
    class_id: Optional[uuid.UUID] = None,
    subject: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_permission("view_own_class_assignments")),
    db: AsyncSession = Depends(get_db),
) -> PaginatedAssignmentResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]
    role = current_user.current_role.value  # type: ignore[attr-defined]

    q = (
        select(Assignment)
        .where(Assignment.school_id == school_id)
        .options(*_ASSIGNMENT_OPTIONS)
        .order_by(Assignment.created_at.desc())
    )

    if role == "teacher":
        q = q.where(Assignment.teacher_id == current_user.id)
    if class_id:
        q = q.where(Assignment.class_id == class_id)
    if subject:
        q = q.where(Assignment.subject == subject)

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar_one()

    offset = (page - 1) * per_page
    assignments = (await db.execute(q.offset(offset).limit(per_page))).scalars().all()

    items = [await _build_assignment_response(db, a) for a in assignments]
    return PaginatedAssignmentResponse(total=total, page=page, per_page=per_page, items=items)


# ---------------------------------------------------------------------------
# GET /{assignment_id}
# ---------------------------------------------------------------------------

@router.get("/{assignment_id}", response_model=AssignmentResponse)
async def get_assignment(
    assignment_id: uuid.UUID,
    current_user: User = Depends(require_permission("view_own_class_assignments")),
    db: AsyncSession = Depends(get_db),
) -> AssignmentResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]
    a = await _get_assignment_or_404(db, assignment_id, school_id)
    _assert_teacher_owns(a, current_user)
    return await _build_assignment_response(db, a)


# ---------------------------------------------------------------------------
# PATCH /{assignment_id}
# ---------------------------------------------------------------------------

@router.patch("/{assignment_id}", response_model=AssignmentResponse)
async def update_assignment(
    assignment_id: uuid.UUID,
    body: AssignmentUpdate,
    current_user: User = Depends(require_permission("create_assignment")),
    db: AsyncSession = Depends(get_db),
) -> AssignmentResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]
    a = await _get_assignment_or_404(db, assignment_id, school_id)
    _assert_teacher_owns(a, current_user)

    # Block editing if due_date has passed and submissions exist
    if a.due_date < date.today():
        sub_count = (
            await db.execute(
                select(func.count(AssignmentSubmission.id)).where(
                    AssignmentSubmission.assignment_id == a.id
                )
            )
        ).scalar_one()
        if sub_count > 0:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot edit an assignment that has passed its due date and has submissions",
            )

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(a, field, value)

    await db.commit()
    a = await _get_assignment_or_404(db, assignment_id, school_id)
    return await _build_assignment_response(db, a)


# ---------------------------------------------------------------------------
# DELETE /{assignment_id}
# ---------------------------------------------------------------------------

@router.delete("/{assignment_id}")
async def delete_assignment(
    assignment_id: uuid.UUID,
    current_user: User = Depends(require_permission("create_assignment")),
    db: AsyncSession = Depends(get_db),
) -> Response:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]
    a = await _get_assignment_or_404(db, assignment_id, school_id)
    _assert_teacher_owns(a, current_user)

    sub_count = (
        await db.execute(
            select(func.count(AssignmentSubmission.id)).where(
                AssignmentSubmission.assignment_id == a.id
            )
        )
    ).scalar_one()
    if sub_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete an assignment that already has submissions",
        )

    await db.delete(a)
    await db.commit()
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# GET /{assignment_id}/submissions
# ---------------------------------------------------------------------------

@router.get("/{assignment_id}/submissions", response_model=list[SubmissionResponse])
async def list_submissions(
    assignment_id: uuid.UUID,
    current_user: User = Depends(require_permission("grade_assignment")),
    db: AsyncSession = Depends(get_db),
) -> list[SubmissionResponse]:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]
    a = await _get_assignment_or_404(db, assignment_id, school_id)
    _assert_teacher_owns(a, current_user)

    result = await db.execute(
        select(AssignmentSubmission)
        .where(AssignmentSubmission.assignment_id == assignment_id)
        .options(
            selectinload(AssignmentSubmission.assignment),
            selectinload(AssignmentSubmission.student),
        )
        .order_by(AssignmentSubmission.submitted_at.asc())
    )
    submissions = result.scalars().all()
    return [_submission_response(sub) for sub in submissions]


# ---------------------------------------------------------------------------
# POST /{assignment_id}/submissions/{submission_id}/grade
# ---------------------------------------------------------------------------

@router.post(
    "/{assignment_id}/submissions/{submission_id}/grade",
    response_model=SubmissionResponse,
)
async def grade_submission(
    assignment_id: uuid.UUID,
    submission_id: uuid.UUID,
    body: GradeSubmissionRequest,
    current_user: User = Depends(require_permission("grade_assignment")),
    db: AsyncSession = Depends(get_db),
) -> SubmissionResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]
    a = await _get_assignment_or_404(db, assignment_id, school_id)
    _assert_teacher_owns(a, current_user)

    sub_result = await db.execute(
        select(AssignmentSubmission)
        .where(
            AssignmentSubmission.id == submission_id,
            AssignmentSubmission.assignment_id == assignment_id,
        )
        .options(
            selectinload(AssignmentSubmission.assignment),
            selectinload(AssignmentSubmission.student),
        )
    )
    sub = sub_result.scalar_one_or_none()
    if sub is None:
        raise HTTPException(status_code=404, detail="Submission not found")

    if body.score > a.max_score:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Score {body.score} exceeds assignment max_score of {a.max_score}",
        )

    sub.score = body.score
    sub.feedback = body.feedback
    sub.graded_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(sub)

    # Reload with relationships to ensure fresh data
    sub_result = await db.execute(
        select(AssignmentSubmission)
        .where(AssignmentSubmission.id == submission_id)
        .options(
            selectinload(AssignmentSubmission.assignment),
            selectinload(AssignmentSubmission.student),
        )
    )
    sub = sub_result.scalar_one()
    return _submission_response(sub)
