from datetime import date

import pytest
from fastapi import HTTPException
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.assignment import Assignment
from app.models.attendance import Attendance, AttendanceStatus
from app.models.class_ import Class, Term
from app.models.finance import Payment, PaymentMethod, PaymentStatus, PaymentTerm, PaymentType
from app.models.guardian import StudentGuardian
from app.models.parent import ParentRelationship
from app.models.result import Result, ResultTerm
from app.models.student import Gender, Student
from app.schemas.parent_portal import ParentProfileUpdate
from app.services.parent_portal import (
    get_attendance_page,
    get_children_page,
    get_dashboard,
    get_finance_page,
    get_parent_profile,
    get_results_page,
    update_parent_profile,
)
from tests.test_parent_authorization import _seed_parent_access


async def _seed_portal_data(db: AsyncSession):
    context, _, profile, students, first_link = await _seed_parent_access(db)
    school_id = context.school_id
    class_ = Class(
        school_id=school_id, name="JSS 1A", level="JSS 1", arm="A",
        academic_session="2025/2026", term=Term.first, is_active=True,
    )
    db.add(class_)
    await db.flush()
    students[0].class_id = class_.id
    students[1].class_id = class_.id
    second_link = StudentGuardian(
        school_id=school_id,
        guardian_profile_id=profile.id,
        student_id=students[1].id,
        relationship_type=ParentRelationship.mother,
        can_view_attendance=False,
        can_view_results=False,
        can_view_assignments=True,
        can_view_finance=True,
    )
    inactive_student = Student(
        school_id=school_id, admission_number="A-003", first_name="Inactive", last_name="Child",
        date_of_birth=date(2012, 4, 4), gender=Gender.female,
        admission_date=date(2024, 1, 1), is_active=False,
    )
    db.add(inactive_student)
    await db.flush()
    db.add(StudentGuardian(
        school_id=school_id, guardian_profile_id=profile.id,
        student_id=inactive_student.id, relationship_type=ParentRelationship.guardian,
    ))
    db.add_all([
        Attendance(
            school_id=school_id, class_id=class_.id, student_id=students[0].id,
            date=date(2026, 1, 10), status=AttendanceStatus.present,
            marked_by=context.user.id,
        ),
        Attendance(
            school_id=school_id, class_id=class_.id, student_id=students[0].id,
            date=date(2026, 1, 11), status=AttendanceStatus.absent,
            marked_by=context.user.id,
        ),
        Result(
            school_id=school_id, student_id=students[0].id, class_id=class_.id,
            subject="Math", academic_session="2025/2026", term=ResultTerm.first,
            total_score=80, grade="A", is_approved=True, entered_by=context.user.id,
        ),
        Result(
            school_id=school_id, student_id=students[0].id, class_id=class_.id,
            subject="English", academic_session="2025/2026", term=ResultTerm.first,
            total_score=50, grade="C", is_approved=False, entered_by=context.user.id,
        ),
        Assignment(
            school_id=school_id, class_id=class_.id, teacher_id=context.user.id,
            title="Algebra", subject="Math", due_date=date(2027, 1, 1), max_score=20,
        ),
        Payment(
            school_id=school_id, student_id=students[1].id, amount_kobo=100000,
            payment_type=PaymentType.school_fees, payment_method=PaymentMethod.bank_transfer,
            academic_session="2025/2026", term=PaymentTerm.first,
            status=PaymentStatus.confirmed, reference="PARENT-PORTAL-001",
            recorded_by=context.user.id,
        ),
        second_link,
    ])
    await db.commit()
    return context, students, first_link, second_link, inactive_student


@pytest.mark.asyncio
async def test_parent_profile_and_multiple_children_are_parent_safe(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, students, _, _, inactive = await _seed_portal_data(db)
        profile = get_parent_profile(context)
        assert profile.email == context.user.email
        updated = await update_parent_profile(
            db, context, ParentProfileUpdate(address="New Address", occupation="Doctor")
        )
        assert updated.address == "New Address"

        first_page = await get_children_page(db, context, page=1, per_page=1)
        second_page = await get_children_page(db, context, page=2, per_page=1)
        assert first_page.total == 2
        assert first_page.total_pages == 2
        returned_ids = {first_page.items[0].id, second_page.items[0].id}
        assert returned_ids == {students[0].id, students[1].id}
        assert inactive.id not in returned_ids
        assert "address" not in first_page.items[0].model_dump()


@pytest.mark.asyncio
async def test_child_permissions_published_results_and_pagination(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, students, _, _, _ = await _seed_portal_data(db)
        attendance = await get_attendance_page(db, context, students[0].id, 1, 1)
        assert attendance.total == 2 and attendance.total_pages == 2

        results = await get_results_page(db, context, students[0].id, 1, 20)
        assert results.total == 1
        assert results.items[0].subject == "Math"

        finance = await get_finance_page(db, context, students[1].id, 1, 20)
        assert finance.total == 1
        with pytest.raises(HTTPException) as exc:
            await get_finance_page(db, context, students[0].id, 1, 20)
        assert exc.value.status_code == 404
        with pytest.raises(HTTPException) as exc:
            await get_results_page(db, context, students[1].id, 1, 20)
        assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_dashboard_query_count_is_bounded_by_dataset_not_child_count(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, _, _, _, _ = await _seed_portal_data(db)
        statements = 0

        def count_query(*args, **kwargs):
            nonlocal statements
            statements += 1

        event.listen(test_engine.sync_engine, "before_cursor_execute", count_query)
        try:
            dashboard = await get_dashboard(db, context)
        finally:
            event.remove(test_engine.sync_engine, "before_cursor_execute", count_query)
        assert dashboard.child_count == 2
        assert dashboard.approved_results == 1
        assert statements <= 7
