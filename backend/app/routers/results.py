"""
Results router — /api/results
Every query filters by school_id. Score entry uses batch upsert to avoid N+1.
"""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.rbac import require_permission
from app.models.class_ import Class
from app.models.result import Result
from app.models.student import Student
from app.models.user import User
from app.schemas.result import (
    AddCommentRequest,
    ApproveResultsRequest,
    ApproveResultsResponse,
    BulkScoreEntry,
    BulkScoreResponse,
    ResultResponse,
    ResultSummary,
)
from app.services.result_service import (
    compute_grade,
    compute_position,
    get_grading_system,
    grade_to_remark,
)

router = APIRouter(prefix="/results", tags=["results"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_class_or_404(
    class_id: uuid.UUID, school_id: uuid.UUID, db: AsyncSession
) -> Class:
    result = await db.execute(
        select(Class).where(Class.id == class_id, Class.school_id == school_id)
    )
    obj = result.scalar_one_or_none()
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    return obj


def _check_teacher_class(class_obj: Class, current_user: User) -> None:
    role = current_user.current_role.value  # type: ignore[attr-defined]
    if role == "teacher" and class_obj.teacher_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not the teacher of this class",
        )


def _to_result_response(
    rec: Result, grade_system: list, student_name: str = "", recorder_name: str = ""
) -> ResultResponse:
    sname = student_name or (
        f"{rec.student.first_name} {rec.student.last_name}"
        if rec.student
        else "Unknown"
    )
    rname = recorder_name or (rec.recorder.name if rec.recorder else "Unknown")
    return ResultResponse(
        id=rec.id,
        student_id=rec.student_id,
        student_name=sname,
        subject=rec.subject,
        academic_session=rec.academic_session,
        term=rec.term,
        ca_score=rec.ca_score,
        exam_score=rec.exam_score,
        total_score=rec.total_score,
        grade=rec.grade,
        remark=grade_to_remark(rec.grade, grade_system),
        teacher_comment=rec.teacher_comment,
        is_approved=rec.is_approved,
        entered_by_name=rname,
    )


# ---------------------------------------------------------------------------
# POST /api/results/scores
# ---------------------------------------------------------------------------

@router.post("/scores", response_model=BulkScoreResponse)
async def enter_scores(
    payload: BulkScoreEntry,
    current_user: User = Depends(require_permission("enter_scores")),
    db: AsyncSession = Depends(get_db),
) -> BulkScoreResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[attr-defined]

    class_obj = await _get_class_or_404(payload.class_id, school_id, db)
    _check_teacher_class(class_obj, current_user)

    # Reject if any result in this batch is already approved
    student_ids = [e.student_id for e in payload.entries]
    approved_check = await db.execute(
        select(Result.id).where(
            Result.school_id == school_id,
            Result.class_id == payload.class_id,
            Result.subject == payload.subject,
            Result.academic_session == payload.academic_session,
            Result.term == payload.term,
            Result.student_id.in_(student_ids),
            Result.is_approved.is_(True),
        ).limit(1)
    )
    if approved_check.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Results for this class/subject/term are already approved and cannot be edited",
        )

    # Verify ALL student_ids belong to this class+school in one IN query
    valid_result = await db.execute(
        select(Student.id).where(
            Student.id.in_(student_ids),
            Student.class_id == payload.class_id,
            Student.school_id == school_id,
        )
    )
    valid_ids = {row[0] for row in valid_result}
    invalid = [str(sid) for sid in student_ids if sid not in valid_ids]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Students not in this class: {invalid}",
        )

    grading_system = await get_grading_system(db, school_id)

    # Batch upsert — single SQL statement for all entries
    values = []
    for entry in payload.entries:
        total = round(entry.ca_score + entry.exam_score, 2)
        grade_letter, _ = compute_grade(total, grading_system)
        values.append({
            "id": uuid.uuid4(),
            "school_id": school_id,
            "student_id": entry.student_id,
            "class_id": payload.class_id,
            "subject": payload.subject,
            "academic_session": payload.academic_session,
            "term": payload.term,
            "ca_score": entry.ca_score,
            "exam_score": entry.exam_score,
            "total_score": total,
            "grade": grade_letter,
            "is_approved": False,
            "entered_by": current_user.id,
        })

    stmt = pg_insert(Result).values(values)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_result_student_subject_term",
        set_={
            "ca_score": stmt.excluded.ca_score,
            "exam_score": stmt.excluded.exam_score,
            "total_score": stmt.excluded.total_score,
            "grade": stmt.excluded.grade,
            "entered_by": stmt.excluded.entered_by,
        },
    )
    await db.execute(stmt)
    await db.commit()

    return BulkScoreResponse(updated_count=len(payload.entries), subject=payload.subject)


# ---------------------------------------------------------------------------
# POST /api/results/approve  ← fixed path, before /{result_id}
# ---------------------------------------------------------------------------

@router.post("/approve", response_model=ApproveResultsResponse)
async def approve_results(
    payload: ApproveResultsRequest,
    current_user: User = Depends(require_permission("approve_results")),
    db: AsyncSession = Depends(get_db),
) -> ApproveResultsResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[attr-defined]

    await _get_class_or_404(payload.class_id, school_id, db)

    result = await db.execute(
        update(Result)
        .where(
            Result.school_id == school_id,
            Result.class_id == payload.class_id,
            Result.academic_session == payload.academic_session,
            Result.term == payload.term,
            Result.is_approved.is_(False),
        )
        .values(is_approved=True, approved_by=current_user.id)
    )
    await db.commit()

    return ApproveResultsResponse(approved_count=result.rowcount)


# ---------------------------------------------------------------------------
# GET /api/results/class/{class_id}/report-cards  ← before /class/{class_id}
# ---------------------------------------------------------------------------

@router.get("/class/{class_id}/report-cards", response_model=list[ResultSummary])
async def get_class_report_cards(
    class_id: uuid.UUID,
    academic_session: str = Query(...),
    term: str = Query(...),
    current_user: User = Depends(require_permission("generate_report_cards")),
    db: AsyncSession = Depends(get_db),
) -> list[ResultSummary]:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[attr-defined]

    class_obj = await _get_class_or_404(class_id, school_id, db)
    grading_system = await get_grading_system(db, school_id)
    positions = await compute_position(db, class_id, academic_session, term, school_id)

    # Fetch all results for the class/session/term with relationships
    result = await db.execute(
        select(Result)
        .where(
            Result.school_id == school_id,
            Result.class_id == class_id,
            Result.academic_session == academic_session,
            Result.term == term,
        )
        .options(
            selectinload(Result.student),
            selectinload(Result.recorder),
        )
        .order_by(Result.subject)
    )
    all_results = result.scalars().all()

    # Group by student_id
    student_results: dict[uuid.UUID, list[Result]] = {}
    for r in all_results:
        student_results.setdefault(r.student_id, []).append(r)

    summaries = []
    for student_id, results in student_results.items():
        student = results[0].student
        subject_responses = [_to_result_response(r, grading_system) for r in results]
        total = sum(r.total_score or 0 for r in results)
        avg = round(total / len(results), 2) if results else 0.0
        teacher_comment = next(
            (r.teacher_comment for r in results if r.teacher_comment), None
        )
        summaries.append(
            ResultSummary(
                student_id=student_id,
                student_name=f"{student.first_name} {student.last_name}",
                admission_number=student.admission_number,
                class_name=class_obj.name,
                academic_session=academic_session,
                term=term,
                subjects=subject_responses,
                total_score=round(total, 2),
                average=avg,
                position=positions.get(student_id),
                teacher_comment=teacher_comment,
                principal_comment=None,
            )
        )

    return summaries


# ---------------------------------------------------------------------------
# GET /api/results/class/{class_id}
# ---------------------------------------------------------------------------

@router.get("/class/{class_id}", response_model=list[ResultResponse])
async def get_class_results(
    class_id: uuid.UUID,
    academic_session: str = Query(...),
    term: str = Query(...),
    subject: Optional[str] = Query(None),
    current_user: User = Depends(require_permission("view_own_class_reports")),
    db: AsyncSession = Depends(get_db),
) -> list[ResultResponse]:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[attr-defined]

    class_obj = await _get_class_or_404(class_id, school_id, db)
    _check_teacher_class(class_obj, current_user)
    grading_system = await get_grading_system(db, school_id)

    stmt = (
        select(Result)
        .where(
            Result.school_id == school_id,
            Result.class_id == class_id,
            Result.academic_session == academic_session,
            Result.term == term,
        )
        .options(selectinload(Result.student), selectinload(Result.recorder))
        .order_by(Result.subject, Result.student_id)
    )
    if subject:
        stmt = stmt.where(Result.subject == subject)

    result = await db.execute(stmt)
    records = result.scalars().all()
    return [_to_result_response(r, grading_system) for r in records]


# ---------------------------------------------------------------------------
# GET /api/results/student/{student_id}
# ---------------------------------------------------------------------------

@router.get("/student/{student_id}", response_model=ResultSummary)
async def get_student_results(
    student_id: uuid.UUID,
    academic_session: str = Query(...),
    term: str = Query(...),
    current_user: User = Depends(require_permission("view_own_class_reports")),
    db: AsyncSession = Depends(get_db),
) -> ResultSummary:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[attr-defined]

    student_result = await db.execute(
        select(Student).where(Student.id == student_id, Student.school_id == school_id)
    )
    student = student_result.scalar_one_or_none()
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    grading_system = await get_grading_system(db, school_id)

    result = await db.execute(
        select(Result)
        .where(
            Result.school_id == school_id,
            Result.student_id == student_id,
            Result.academic_session == academic_session,
            Result.term == term,
        )
        .options(selectinload(Result.recorder))
        .order_by(Result.subject)
    )
    records = result.scalars().all()

    class_name = "Unknown"
    if student.class_id:
        class_result = await db.execute(
            select(Class.name).where(Class.id == student.class_id)
        )
        class_name = class_result.scalar_one_or_none() or "Unknown"

    positions: dict[uuid.UUID, int] = {}
    if student.class_id:
        positions = await compute_position(
            db, student.class_id, academic_session, term, school_id
        )

    total = sum(r.total_score or 0 for r in records)
    avg = round(total / len(records), 2) if records else 0.0
    teacher_comment = next((r.teacher_comment for r in records if r.teacher_comment), None)

    subject_responses = [
        _to_result_response(r, grading_system, student_name=f"{student.first_name} {student.last_name}")
        for r in records
    ]

    return ResultSummary(
        student_id=student_id,
        student_name=f"{student.first_name} {student.last_name}",
        admission_number=student.admission_number,
        class_name=class_name,
        academic_session=academic_session,
        term=term,
        subjects=subject_responses,
        total_score=round(total, 2),
        average=avg,
        position=positions.get(student_id),
        teacher_comment=teacher_comment,
        principal_comment=None,
    )


# ---------------------------------------------------------------------------
# GET /api/results/report-card/{student_id}
# ---------------------------------------------------------------------------

@router.get("/report-card/{student_id}", response_model=ResultSummary)
async def get_report_card(
    student_id: uuid.UUID,
    academic_session: str = Query(...),
    term: str = Query(...),
    current_user: User = Depends(require_permission("generate_report_cards")),
    db: AsyncSession = Depends(get_db),
) -> ResultSummary:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[attr-defined]

    student_result = await db.execute(
        select(Student).where(Student.id == student_id, Student.school_id == school_id)
    )
    student = student_result.scalar_one_or_none()
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    grading_system = await get_grading_system(db, school_id)

    result = await db.execute(
        select(Result)
        .where(
            Result.school_id == school_id,
            Result.student_id == student_id,
            Result.academic_session == academic_session,
            Result.term == term,
        )
        .options(selectinload(Result.recorder))
        .order_by(Result.subject)
    )
    records = result.scalars().all()

    class_name = "Unknown"
    if student.class_id:
        class_result = await db.execute(
            select(Class.name).where(Class.id == student.class_id)
        )
        class_name = class_result.scalar_one_or_none() or "Unknown"

    positions: dict[uuid.UUID, int] = {}
    if student.class_id:
        positions = await compute_position(
            db, student.class_id, academic_session, term, school_id
        )

    total = sum(r.total_score or 0 for r in records)
    avg = round(total / len(records), 2) if records else 0.0
    teacher_comment = next((r.teacher_comment for r in records if r.teacher_comment), None)

    subject_responses = [
        _to_result_response(
            r, grading_system,
            student_name=f"{student.first_name} {student.last_name}",
        )
        for r in records
    ]

    return ResultSummary(
        student_id=student_id,
        student_name=f"{student.first_name} {student.last_name}",
        admission_number=student.admission_number,
        class_name=class_name,
        academic_session=academic_session,
        term=term,
        subjects=subject_responses,
        total_score=round(total, 2),
        average=avg,
        position=positions.get(student_id),
        teacher_comment=teacher_comment,
        principal_comment=None,
    )


# ---------------------------------------------------------------------------
# PATCH /api/results/{result_id}/comment
# ← Parameterized with sub-path — declared after all fixed-prefix routes
# ---------------------------------------------------------------------------

@router.patch("/{result_id}/comment", response_model=ResultResponse)
async def add_comment(
    result_id: uuid.UUID,
    payload: AddCommentRequest,
    current_user: User = Depends(require_permission("add_teacher_comments")),
    db: AsyncSession = Depends(get_db),
) -> ResultResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[attr-defined]

    result = await db.execute(
        select(Result)
        .where(Result.id == result_id, Result.school_id == school_id)
        .options(selectinload(Result.student), selectinload(Result.recorder))
    )
    rec = result.scalar_one_or_none()
    if rec is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Result not found")

    # Teacher can only comment on results for their own class
    role = current_user.current_role.value  # type: ignore[attr-defined]
    if role == "teacher":
        teacher_class_id = current_user.current_class_id  # type: ignore[attr-defined]
        if rec.class_id != teacher_class_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This result does not belong to your class",
            )

    if rec.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot edit comment on an approved result",
        )

    rec.teacher_comment = payload.teacher_comment
    await db.commit()
    await db.refresh(rec)

    # Reload with relationships
    result2 = await db.execute(
        select(Result)
        .where(Result.id == result_id)
        .options(selectinload(Result.student), selectinload(Result.recorder))
    )
    rec = result2.scalar_one()
    grading_system = await get_grading_system(db, school_id)
    return _to_result_response(rec, grading_system)
