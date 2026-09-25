import math
import uuid

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.parent import ParentContext
from app.dependencies.rbac import has_permission
from app.models.assignment import Assignment, AssignmentSubmission
from app.models.attendance import Attendance
from app.models.audit_event import AuditEvent
from app.models.finance import Payment
from app.models.result import Result
from app.schemas.parent_portal import (
    PaginatedParentAssignments,
    PaginatedParentAttendance,
    PaginatedParentChildren,
    PaginatedParentFinance,
    PaginatedParentResults,
    ParentAssignmentItem,
    ParentAttendanceItem,
    ParentChildPermissions,
    ParentChildResponse,
    ParentDashboardResponse,
    ParentFinanceItem,
    ParentProfileResponse,
    ParentProfileUpdate,
    ParentResultItem,
)
from app.services.parent_access import (
    AuthorizedParentStudent,
    get_authorized_parent_student,
    list_authorized_children,
    load_parent_dashboard_summary,
    require_parent_permission,
)


def _pages(total: int, per_page: int) -> int:
    return math.ceil(total / per_page) if total else 0


def _child_response(context: ParentContext, access: AuthorizedParentStudent) -> ParentChildResponse:
    student = access.student
    link = access.relationship
    role = context.membership.role.value
    class_ = student.current_class
    return ParentChildResponse(
        id=student.id,
        admission_number=student.admission_number,
        first_name=student.first_name,
        middle_name=student.middle_name,
        last_name=student.last_name,
        date_of_birth=student.date_of_birth,
        gender=student.gender.value,
        photo_url=student.photo_url,
        class_id=student.class_id,
        class_name=class_.name if class_ else None,
        class_level=class_.level if class_ else None,
        academic_session=class_.academic_session if class_ else None,
        permissions=ParentChildPermissions(
            attendance=link.can_view_attendance and has_permission(role, "view_child_attendance"),
            results=link.can_view_results and has_permission(role, "view_child_results"),
            assignments=link.can_view_assignments and has_permission(role, "view_child_assignments"),
            finance=link.can_view_finance and has_permission(role, "view_child_finance"),
            messaging=link.can_receive_messages and has_permission(role, "message_related_teacher"),
            pickup=link.can_pick_up,
        ),
    )


def get_parent_profile(context: ParentContext) -> ParentProfileResponse:
    require_parent_permission(context, "manage_own_profile")
    return ParentProfileResponse(
        guardian_id=context.guardian_profile.id,
        name=context.user.name,
        email=context.user.email,
        phone=context.user.phone,
        address=context.guardian_profile.address,
        occupation=context.guardian_profile.occupation,
        preferred_contact_channel=context.guardian_profile.preferred_contact_channel,
    )


async def update_parent_profile(
    db: AsyncSession, context: ParentContext, payload: ParentProfileUpdate
) -> ParentProfileResponse:
    require_parent_permission(context, "manage_own_profile")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(context.guardian_profile, field, value)
    db.add(AuditEvent(
        school_id=context.school_id,
        actor_user_id=context.user.id,
        event_type="parent_profile_updated",
        target_type="guardian_profile",
        target_id=context.guardian_profile.id,
        event_data={"fields": sorted(payload.model_fields_set)},
    ))
    await db.commit()
    return get_parent_profile(context)


async def get_children_page(
    db: AsyncSession, context: ParentContext, page: int, per_page: int
) -> PaginatedParentChildren:
    children = await list_authorized_children(db, context)
    total = len(children)
    start = (page - 1) * per_page
    return PaginatedParentChildren(
        items=[_child_response(context, item) for item in children[start:start + per_page]],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=_pages(total, per_page),
    )


async def get_child(
    db: AsyncSession, context: ParentContext, student_id: uuid.UUID
) -> ParentChildResponse:
    return _child_response(
        context, await get_authorized_parent_student(db, context, student_id)
    )


async def get_dashboard(db: AsyncSession, context: ParentContext) -> ParentDashboardResponse:
    children = await list_authorized_children(db, context)
    summary = await load_parent_dashboard_summary(db, context, children)
    rate = round(summary.present_records / summary.attendance_records * 100, 2) if summary.attendance_records else 0.0
    return ParentDashboardResponse(
        children=[_child_response(context, child) for child in children],
        child_count=summary.child_count,
        attendance_records=summary.attendance_records,
        present_records=summary.present_records,
        attendance_rate=rate,
        approved_results=summary.approved_results,
        upcoming_assignments=summary.upcoming_assignments,
    )


async def get_attendance_page(db, context, student_id, page, per_page):
    await get_authorized_parent_student(db, context, student_id, "can_view_attendance")
    filters = (Attendance.school_id == context.school_id, Attendance.student_id == student_id)
    total = (await db.execute(select(func.count(Attendance.id)).where(*filters))).scalar_one()
    records = list((await db.execute(
        select(Attendance).where(*filters).order_by(Attendance.date.desc())
        .offset((page - 1) * per_page).limit(per_page)
    )).scalars().all())
    return PaginatedParentAttendance(
        items=[ParentAttendanceItem(id=r.id, date=r.date, status=r.status.value, note=r.note) for r in records],
        total=total, page=page, per_page=per_page, total_pages=_pages(total, per_page),
    )


async def get_results_page(db, context, student_id, page, per_page):
    await get_authorized_parent_student(db, context, student_id, "can_view_results")
    filters = (
        Result.school_id == context.school_id,
        Result.student_id == student_id,
        Result.is_approved.is_(True),
    )
    total = (await db.execute(select(func.count(Result.id)).where(*filters))).scalar_one()
    records = list((await db.execute(
        select(Result).where(*filters)
        .order_by(Result.academic_session.desc(), Result.term, Result.subject)
        .offset((page - 1) * per_page).limit(per_page)
    )).scalars().all())
    return PaginatedParentResults(
        items=[ParentResultItem(
            id=r.id, subject=r.subject, academic_session=r.academic_session, term=r.term.value,
            ca_score=r.ca_score, exam_score=r.exam_score, total_score=r.total_score,
            grade=r.grade, teacher_comment=r.teacher_comment,
        ) for r in records],
        total=total, page=page, per_page=per_page, total_pages=_pages(total, per_page),
    )


async def get_assignments_page(db, context, student_id, page, per_page):
    access = await get_authorized_parent_student(db, context, student_id, "can_view_assignments")
    if access.student.class_id is None:
        return PaginatedParentAssignments(items=[], total=0, page=page, per_page=per_page, total_pages=0)
    filters = (Assignment.school_id == context.school_id, Assignment.class_id == access.student.class_id)
    total = (await db.execute(select(func.count(Assignment.id)).where(*filters))).scalar_one()
    rows = (await db.execute(
        select(Assignment, AssignmentSubmission)
        .outerjoin(
            AssignmentSubmission,
            and_(
                AssignmentSubmission.assignment_id == Assignment.id,
                AssignmentSubmission.student_id == student_id,
            ),
        )
        .where(*filters).order_by(Assignment.due_date.desc())
        .offset((page - 1) * per_page).limit(per_page)
    )).all()
    return PaginatedParentAssignments(
        items=[ParentAssignmentItem(
            id=a.id, title=a.title, subject=a.subject, description=a.description,
            due_date=a.due_date, max_score=a.max_score, file_url=a.file_url,
            submitted_at=s.submitted_at if s else None, score=s.score if s else None,
            feedback=s.feedback if s else None,
        ) for a, s in rows],
        total=total, page=page, per_page=per_page, total_pages=_pages(total, per_page),
    )


async def get_finance_page(db, context, student_id, page, per_page):
    await get_authorized_parent_student(db, context, student_id, "can_view_finance")
    filters = (Payment.school_id == context.school_id, Payment.student_id == student_id)
    total = (await db.execute(select(func.count(Payment.id)).where(*filters))).scalar_one()
    records = list((await db.execute(
        select(Payment).where(*filters).order_by(Payment.created_at.desc())
        .offset((page - 1) * per_page).limit(per_page)
    )).scalars().all())
    return PaginatedParentFinance(
        items=[ParentFinanceItem(
            id=p.id, amount_kobo=p.amount_kobo, payment_type=p.payment_type.value,
            payment_method=p.payment_method.value, academic_session=p.academic_session,
            term=p.term.value, status=p.status.value, reference=p.reference,
            paid_at=p.paid_at, created_at=p.created_at,
        ) for p in records],
        total=total, page=page, per_page=per_page, total_pages=_pages(total, per_page),
    )
