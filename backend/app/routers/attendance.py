"""
Attendance router — /api/attendance
Every query filters by school_id. SQL aggregates only — never Python loops for counts.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.rbac import require_permission
from app.models.attendance import Attendance, AttendanceStatus
from app.models.class_ import Class
from app.models.student import Student
from app.models.user import User
from app.schemas.attendance import (
    AttendanceResponse,
    AttendanceSummary,
    AttendanceUpdate,
    CheckAttendanceResponse,
    MarkAttendanceRequest,
    MarkAttendanceResponse,
    SchoolAttendanceSummary,
    StudentAttendanceSummary,
)

router = APIRouter(prefix="/attendance", tags=["attendance"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _today() -> date:
    return datetime.now(timezone.utc).date()


def _attendance_rate(present: int, total: int) -> float:
    if total == 0:
        return 0.0
    return round(present / total * 100, 2)


async def _get_class_or_403(
    class_id: uuid.UUID,
    school_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
    check_teacher: bool = False,
) -> Class:
    result = await db.execute(
        select(Class).where(Class.id == class_id, Class.school_id == school_id)
    )
    class_obj = result.scalar_one_or_none()
    if class_obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")

    if check_teacher:
        role_value = current_user.current_role.value  # type: ignore[attr-defined]
        if role_value == "teacher" and class_obj.teacher_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not the teacher of this class",
            )
    return class_obj


def _to_attendance_response(rec: Attendance) -> AttendanceResponse:
    student = rec.student
    marker = rec.marker
    return AttendanceResponse(
        id=rec.id,
        student_id=rec.student_id,
        student_name=f"{student.first_name} {student.last_name}",
        class_id=rec.class_id,
        date=rec.date,
        status=rec.status,
        note=rec.note,
        marked_by_name=marker.name,
    )


# ---------------------------------------------------------------------------
# POST /api/attendance/mark
# ---------------------------------------------------------------------------

@router.post("/mark", response_model=MarkAttendanceResponse)
async def mark_attendance(
    payload: MarkAttendanceRequest,
    current_user: User = Depends(require_permission("take_attendance")),
    db: AsyncSession = Depends(get_db),
) -> MarkAttendanceResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[attr-defined]

    class_obj = await _get_class_or_403(
        payload.class_id, school_id, current_user, db, check_teacher=True
    )

    # Check if attendance already marked for this class+date
    existing_count_result = await db.execute(
        select(func.count(Attendance.id)).where(
            Attendance.school_id == school_id,
            Attendance.class_id == payload.class_id,
            Attendance.date == payload.date,
        )
    )
    already_marked = existing_count_result.scalar_one() > 0

    # Verify ALL student_ids belong to this class+school in one IN query
    student_ids = [r.student_id for r in payload.records]
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

    # Batch upsert all records in one statement
    values = [
        {
            "id": uuid.uuid4(),
            "school_id": school_id,
            "class_id": payload.class_id,
            "student_id": rec.student_id,
            "date": payload.date,
            "status": rec.status,
            "note": rec.note,
            "marked_by": current_user.id,
        }
        for rec in payload.records
    ]
    upsert_stmt = pg_insert(Attendance).values(values)
    upsert_stmt = upsert_stmt.on_conflict_do_update(
        index_elements=["school_id", "student_id", "date"],
        set_={
            "status": upsert_stmt.excluded.status,
            "note": upsert_stmt.excluded.note,
            "marked_by": upsert_stmt.excluded.marked_by,
            "class_id": upsert_stmt.excluded.class_id,
        },
    )
    await db.execute(upsert_stmt)
    await db.commit()

    return MarkAttendanceResponse(
        marked_count=len(payload.records),
        date=payload.date,
        class_name=class_obj.name,
        already_marked=already_marked,
    )


# ---------------------------------------------------------------------------
# GET /api/attendance/check/{class_id}  ← fixed prefix, before /{attendance_id}
# ---------------------------------------------------------------------------

@router.get("/check/{class_id}", response_model=CheckAttendanceResponse)
async def check_attendance(
    class_id: uuid.UUID,
    date_param: Optional[date] = Query(None, alias="date"),
    current_user: User = Depends(require_permission("take_attendance")),
    db: AsyncSession = Depends(get_db),
) -> CheckAttendanceResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[attr-defined]
    target_date = date_param or _today()

    await _get_class_or_403(class_id, school_id, current_user, db)

    result = await db.execute(
        select(func.min(Attendance.created_at), func.min(Attendance.marked_by)).where(
            Attendance.school_id == school_id,
            Attendance.class_id == class_id,
            Attendance.date == target_date,
        )
    )
    row = result.one()
    first_created_at, first_marker_id = row[0], row[1]
    is_marked = first_created_at is not None

    marked_by_name: Optional[str] = None
    if first_marker_id:
        marker_result = await db.execute(
            select(User.name).where(User.id == first_marker_id)
        )
        marked_by_name = marker_result.scalar_one_or_none()

    return CheckAttendanceResponse(
        is_marked=is_marked,
        date=target_date,
        marked_at=first_created_at,
        marked_by=marked_by_name,
    )


# ---------------------------------------------------------------------------
# GET /api/attendance/school
# ---------------------------------------------------------------------------

@router.get("/school", response_model=SchoolAttendanceSummary)
async def school_attendance_summary(
    date_param: Optional[date] = Query(None, alias="date"),
    class_id: Optional[uuid.UUID] = Query(None),
    current_user: User = Depends(require_permission("view_all_attendance")),
    db: AsyncSession = Depends(get_db),
) -> SchoolAttendanceSummary:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[attr-defined]
    target_date = date_param or _today()

    # School-wide totals using SQL aggregates
    total_stmt = select(
        func.count(Attendance.id).label("total"),
        func.count(case((Attendance.status == AttendanceStatus.present, 1))).label("present"),
        func.count(case((Attendance.status == AttendanceStatus.absent, 1))).label("absent"),
        func.count(case((Attendance.status == AttendanceStatus.late, 1))).label("late"),
        func.count(case((Attendance.status == AttendanceStatus.excused, 1))).label("excused"),
    ).where(
        Attendance.school_id == school_id,
        Attendance.date == target_date,
    )
    if class_id:
        total_stmt = total_stmt.where(Attendance.class_id == class_id)

    total_row = (await db.execute(total_stmt)).one()
    total, present, absent, late, excused = (
        total_row.total, total_row.present, total_row.absent,
        total_row.late, total_row.excused,
    )

    # Per-class breakdown using SQL GROUP BY
    by_class_stmt = (
        select(
            Attendance.class_id,
            func.count(Attendance.id).label("total"),
            func.count(case((Attendance.status == AttendanceStatus.present, 1))).label("present"),
            func.count(case((Attendance.status == AttendanceStatus.absent, 1))).label("absent"),
            func.count(case((Attendance.status == AttendanceStatus.late, 1))).label("late"),
            func.count(case((Attendance.status == AttendanceStatus.excused, 1))).label("excused"),
        )
        .where(Attendance.school_id == school_id, Attendance.date == target_date)
        .group_by(Attendance.class_id)
    )
    if class_id:
        by_class_stmt = by_class_stmt.where(Attendance.class_id == class_id)

    by_class_rows = (await db.execute(by_class_stmt)).all()

    # Fetch class names in one query
    class_ids = [row.class_id for row in by_class_rows]
    class_names: dict[uuid.UUID, str] = {}
    if class_ids:
        names_result = await db.execute(
            select(Class.id, Class.name).where(Class.id.in_(class_ids))
        )
        class_names = {row[0]: row[1] for row in names_result}

    by_class = [
        AttendanceSummary(
            date=target_date,
            class_id=row.class_id,
            class_name=class_names.get(row.class_id, "Unknown"),
            total_students=row.total,
            present=row.present,
            absent=row.absent,
            late=row.late,
            excused=row.excused,
            attendance_rate=_attendance_rate(row.present, row.total),
        )
        for row in by_class_rows
    ]

    return SchoolAttendanceSummary(
        date=target_date,
        total_students=total,
        present=present,
        absent=absent,
        late=late,
        excused=excused,
        attendance_rate=_attendance_rate(present, total),
        by_class=by_class,
    )


# ---------------------------------------------------------------------------
# GET /api/attendance/class/{class_id}/summary
# ← Must be declared before GET /class/{class_id} to avoid shadowing
# ---------------------------------------------------------------------------

@router.get("/class/{class_id}/summary", response_model=AttendanceSummary)
async def class_attendance_summary(
    class_id: uuid.UUID,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: User = Depends(require_permission("view_own_class_attendance")),
    db: AsyncSession = Depends(get_db),
) -> AttendanceSummary:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[attr-defined]
    class_obj = await _get_class_or_403(
        class_id, school_id, current_user, db, check_teacher=True
    )

    # Default: last 30 days if no range provided
    end = end_date or _today()
    from datetime import timedelta
    start = start_date or (end - timedelta(days=30))

    result = await db.execute(
        select(
            func.count(Attendance.id).label("total"),
            func.count(case((Attendance.status == AttendanceStatus.present, 1))).label("present"),
            func.count(case((Attendance.status == AttendanceStatus.absent, 1))).label("absent"),
            func.count(case((Attendance.status == AttendanceStatus.late, 1))).label("late"),
            func.count(case((Attendance.status == AttendanceStatus.excused, 1))).label("excused"),
        ).where(
            Attendance.school_id == school_id,
            Attendance.class_id == class_id,
            Attendance.date.between(start, end),
        )
    )
    row = result.one()

    return AttendanceSummary(
        date=start,
        class_id=class_id,
        class_name=class_obj.name,
        total_students=row.total,
        present=row.present,
        absent=row.absent,
        late=row.late,
        excused=row.excused,
        attendance_rate=_attendance_rate(row.present, row.total),
    )


# ---------------------------------------------------------------------------
# GET /api/attendance/class/{class_id}
# ---------------------------------------------------------------------------

@router.get("/class/{class_id}", response_model=list[AttendanceResponse])
async def get_class_attendance(
    class_id: uuid.UUID,
    date_param: Optional[date] = Query(None, alias="date"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    student_id: Optional[uuid.UUID] = Query(None),
    current_user: User = Depends(require_permission("view_own_class_attendance")),
    db: AsyncSession = Depends(get_db),
) -> list[AttendanceResponse]:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[attr-defined]
    await _get_class_or_403(class_id, school_id, current_user, db, check_teacher=True)

    stmt = (
        select(Attendance)
        .where(Attendance.school_id == school_id, Attendance.class_id == class_id)
        .options(selectinload(Attendance.student), selectinload(Attendance.marker))
        .order_by(Attendance.date.desc())
    )

    if date_param:
        stmt = stmt.where(Attendance.date == date_param)
    else:
        if start_date:
            stmt = stmt.where(Attendance.date >= start_date)
        if end_date:
            stmt = stmt.where(Attendance.date <= end_date)
        if not start_date and not end_date:
            stmt = stmt.where(Attendance.date == _today())

    if student_id:
        stmt = stmt.where(Attendance.student_id == student_id)

    result = await db.execute(stmt)
    records = result.scalars().all()
    return [_to_attendance_response(r) for r in records]


# ---------------------------------------------------------------------------
# GET /api/attendance/student/{student_id}
# ---------------------------------------------------------------------------

@router.get("/student/{student_id}", response_model=StudentAttendanceSummary)
async def student_attendance_summary(
    student_id: uuid.UUID,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: User = Depends(require_permission("view_own_class_attendance")),
    db: AsyncSession = Depends(get_db),
) -> StudentAttendanceSummary:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[attr-defined]

    student_result = await db.execute(
        select(Student).where(Student.id == student_id, Student.school_id == school_id)
    )
    student = student_result.scalar_one_or_none()
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    # If teacher, verify student is in their class
    role_value = current_user.current_role.value  # type: ignore[attr-defined]
    if role_value == "teacher":
        teacher_class_id = current_user.current_class_id  # type: ignore[attr-defined]
        if student.class_id != teacher_class_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Student is not in your class",
            )

    from datetime import timedelta
    end = end_date or _today()
    start = start_date or (end - timedelta(days=90))

    result = await db.execute(
        select(
            func.count(Attendance.id).label("total"),
            func.count(case((Attendance.status == AttendanceStatus.present, 1))).label("present"),
            func.count(case((Attendance.status == AttendanceStatus.absent, 1))).label("absent"),
            func.count(case((Attendance.status == AttendanceStatus.late, 1))).label("late"),
            func.count(case((Attendance.status == AttendanceStatus.excused, 1))).label("excused"),
        ).where(
            Attendance.school_id == school_id,
            Attendance.student_id == student_id,
            Attendance.date.between(start, end),
        )
    )
    row = result.one()

    return StudentAttendanceSummary(
        student_name=f"{student.first_name} {student.last_name}",
        total_days=row.total,
        present=row.present,
        absent=row.absent,
        late=row.late,
        excused=row.excused,
        attendance_rate=_attendance_rate(row.present, row.total),
    )


# ---------------------------------------------------------------------------
# PATCH /api/attendance/{attendance_id}
# ← Parameterized — declared last to avoid shadowing fixed-prefix routes
# ---------------------------------------------------------------------------

@router.patch("/{attendance_id}", response_model=AttendanceResponse)
async def update_attendance(
    attendance_id: uuid.UUID,
    payload: AttendanceUpdate,
    current_user: User = Depends(require_permission("edit_attendance")),
    db: AsyncSession = Depends(get_db),
) -> AttendanceResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[attr-defined]

    result = await db.execute(
        select(Attendance)
        .where(Attendance.id == attendance_id, Attendance.school_id == school_id)
        .options(selectinload(Attendance.student), selectinload(Attendance.marker))
    )
    rec = result.scalar_one_or_none()
    if rec is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance record not found")

    # If teacher, verify the record belongs to their class
    role_value = current_user.current_role.value  # type: ignore[attr-defined]
    if role_value == "teacher":
        teacher_class_id = current_user.current_class_id  # type: ignore[attr-defined]
        if rec.class_id != teacher_class_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This attendance record does not belong to your class",
            )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rec, field, value)

    await db.commit()
    await db.refresh(rec)

    # Reload with relationships after update
    result2 = await db.execute(
        select(Attendance)
        .where(Attendance.id == attendance_id)
        .options(selectinload(Attendance.student), selectinload(Attendance.marker))
    )
    rec = result2.scalar_one()
    return _to_attendance_response(rec)
