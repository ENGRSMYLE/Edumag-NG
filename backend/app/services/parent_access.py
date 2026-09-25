import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies.parent import ParentContext
from app.dependencies.rbac import has_permission
from app.models.assignment import Assignment
from app.models.attendance import Attendance, AttendanceStatus
from app.models.class_ import Class
from app.models.guardian import StudentGuardian
from app.models.result import Result
from app.models.school_membership import MembershipRole, SchoolMembership
from app.models.student import Student
from app.models.user import User

ParentStudentPermission = Literal[
    "can_receive_messages",
    "can_view_attendance",
    "can_view_results",
    "can_view_assignments",
    "can_view_finance",
    "can_pick_up",
]

_PERMISSION_COLUMNS = {
    "can_receive_messages": StudentGuardian.can_receive_messages,
    "can_view_attendance": StudentGuardian.can_view_attendance,
    "can_view_results": StudentGuardian.can_view_results,
    "can_view_assignments": StudentGuardian.can_view_assignments,
    "can_view_finance": StudentGuardian.can_view_finance,
    "can_pick_up": StudentGuardian.can_pick_up,
}

_RELATIONSHIP_ROLE_PERMISSIONS: dict[ParentStudentPermission, str] = {
    "can_receive_messages": "message_related_teacher",
    "can_view_attendance": "view_child_attendance",
    "can_view_results": "view_child_results",
    "can_view_assignments": "view_child_assignments",
    "can_view_finance": "view_child_finance",
    "can_pick_up": "view_own_children",
}


def require_parent_permission(context: ParentContext, permission: str) -> None:
    """Enforce parent role-level authorization before relationship checks."""
    role = context.membership.role.value
    if role != MembershipRole.parent.value or not has_permission(role, permission):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )


@dataclass(frozen=True)
class AuthorizedParentStudent:
    student: Student
    relationship: StudentGuardian


@dataclass(frozen=True)
class ParentDashboardSummary:
    child_count: int
    attendance_records: int
    present_records: int
    approved_results: int
    upcoming_assignments: int


def _active_relationship_filters(now: datetime):
    return (
        StudentGuardian.is_active.is_(True),
        or_(StudentGuardian.starts_at.is_(None), StudentGuardian.starts_at <= now),
        or_(StudentGuardian.ends_at.is_(None), StudentGuardian.ends_at >= now),
    )


async def get_authorized_parent_student(
    db: AsyncSession,
    context: ParentContext,
    student_id: uuid.UUID,
    required_permission: ParentStudentPermission | None = None,
) -> AuthorizedParentStudent:
    require_parent_permission(
        context,
        _RELATIONSHIP_ROLE_PERMISSIONS.get(required_permission, "view_own_children"),
    )
    now = datetime.now(timezone.utc)
    query = (
        select(Student, StudentGuardian)
        .join(
            StudentGuardian,
            (StudentGuardian.student_id == Student.id)
            & (StudentGuardian.school_id == Student.school_id),
        )
        .where(
            Student.id == student_id,
            Student.school_id == context.school_id,
            Student.is_active.is_(True),
            StudentGuardian.guardian_profile_id == context.guardian_profile.id,
            *_active_relationship_filters(now),
        )
        .options(selectinload(Student.current_class))
    )
    if required_permission:
        query = query.where(_PERMISSION_COLUMNS[required_permission].is_(True))

    row = (await db.execute(query)).one_or_none()
    if row is None:
        # Deliberately hide whether an unrelated or unauthorized student exists.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    student, relationship = row
    return AuthorizedParentStudent(student=student, relationship=relationship)


async def list_authorized_children(
    db: AsyncSession,
    context: ParentContext,
    required_permission: ParentStudentPermission | None = None,
) -> list[AuthorizedParentStudent]:
    require_parent_permission(
        context,
        _RELATIONSHIP_ROLE_PERMISSIONS.get(required_permission, "view_own_children"),
    )
    now = datetime.now(timezone.utc)
    query = (
        select(Student, StudentGuardian)
        .join(StudentGuardian, (StudentGuardian.student_id == Student.id) & (StudentGuardian.school_id == Student.school_id))
        .where(
            Student.school_id == context.school_id,
            Student.is_active.is_(True),
            StudentGuardian.guardian_profile_id == context.guardian_profile.id,
            *_active_relationship_filters(now),
        )
        .options(selectinload(Student.current_class))
        .order_by(Student.first_name, Student.last_name)
    )
    if required_permission:
        query = query.where(_PERMISSION_COLUMNS[required_permission].is_(True))
    return [AuthorizedParentStudent(student=s, relationship=r) for s, r in (await db.execute(query)).all()]


async def get_child_permissions(
    db: AsyncSession, context: ParentContext, student_id: uuid.UUID
) -> dict[str, bool]:
    access = await get_authorized_parent_student(db, context, student_id)
    relationship = access.relationship
    return {
        name: bool(getattr(relationship, name))
        and has_permission(context.membership.role.value, _RELATIONSHIP_ROLE_PERMISSIONS[name])
        for name in _PERMISSION_COLUMNS
    }


async def load_parent_dashboard_summary(
    db: AsyncSession,
    context: ParentContext,
    children: list[AuthorizedParentStudent] | None = None,
) -> ParentDashboardSummary:
    if children is None:
        children = await list_authorized_children(db, context)
    student_ids = [item.student.id for item in children]
    if not student_ids:
        return ParentDashboardSummary(0, 0, 0, 0, 0)

    attendance_ids = [
        item.student.id
        for item in children
        if item.relationship.can_view_attendance
        and has_permission(context.membership.role.value, "view_child_attendance")
    ]
    result_ids = [
        item.student.id
        for item in children
        if item.relationship.can_view_results
        and has_permission(context.membership.role.value, "view_child_results")
    ]
    assignment_class_ids = {
        item.student.class_id
        for item in children
        if item.student.class_id
        and item.relationship.can_view_assignments
        and has_permission(context.membership.role.value, "view_child_assignments")
    }
    attendance_total = present_total = approved_results = 0
    if attendance_ids:
        attendance_total = (await db.execute(select(func.count(Attendance.id)).where(
            Attendance.school_id == context.school_id, Attendance.student_id.in_(attendance_ids)
        ))).scalar_one()
        present_total = (await db.execute(select(func.count(Attendance.id)).where(
            Attendance.school_id == context.school_id,
            Attendance.student_id.in_(attendance_ids),
            Attendance.status == AttendanceStatus.present,
        ))).scalar_one()
    if result_ids:
        approved_results = (await db.execute(select(func.count(Result.id)).where(
            Result.school_id == context.school_id,
            Result.student_id.in_(result_ids),
            Result.is_approved.is_(True),
        ))).scalar_one()
    upcoming = 0
    if assignment_class_ids:
        upcoming = (await db.execute(select(func.count(Assignment.id)).where(
            Assignment.school_id == context.school_id,
            Assignment.class_id.in_(assignment_class_ids),
            Assignment.due_date >= date.today(),
        ))).scalar_one()
    return ParentDashboardSummary(len(student_ids), attendance_total, present_total, approved_results, upcoming)


async def list_related_teachers(db: AsyncSession, context: ParentContext) -> list[User]:
    children = await list_authorized_children(db, context, "can_receive_messages")
    class_ids = {item.student.class_id for item in children if item.student.class_id}
    if not class_ids:
        return []
    query = (
        select(User)
        .join(Class, Class.teacher_id == User.id)
        .join(SchoolMembership, SchoolMembership.user_id == User.id)
        .where(
            Class.id.in_(class_ids),
            Class.school_id == context.school_id,
            SchoolMembership.school_id == context.school_id,
            SchoolMembership.role == MembershipRole.teacher,
            SchoolMembership.is_active.is_(True),
            User.is_active.is_(True),
        )
        .distinct()
        .order_by(User.name)
    )
    return list((await db.execute(query)).scalars().all())


async def list_authorized_messaging_recipients(
    db: AsyncSession, context: ParentContext
) -> list[User]:
    require_parent_permission(context, "message_admin")
    admins_query = (
        select(User)
        .join(SchoolMembership, SchoolMembership.user_id == User.id)
        .where(
            SchoolMembership.school_id == context.school_id,
            SchoolMembership.role.in_([MembershipRole.admin, MembershipRole.super_admin]),
            SchoolMembership.is_active.is_(True),
            User.is_active.is_(True),
        )
    )
    recipients = {user.id: user for user in (await db.execute(admins_query)).scalars().all()}
    if has_permission(context.membership.role.value, "message_related_teacher"):
        for teacher in await list_related_teachers(db, context):
            recipients[teacher.id] = teacher
    return sorted(recipients.values(), key=lambda user: user.name.casefold())
