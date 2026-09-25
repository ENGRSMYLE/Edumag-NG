import uuid
from datetime import date

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.dependencies.parent import ParentContext, get_current_parent_context
from app.models.guardian import GuardianProfile, GuardianStatus, StudentGuardian
from app.models.parent import ParentRelationship
from app.models.school import School, SchoolType
from app.models.school_membership import MembershipRole, SchoolMembership
from app.models.student import Gender, Student
from app.models.user import User
from app.services.parent_access import (
    get_authorized_parent_student,
    get_child_permissions,
    list_authorized_children,
)
from app.utils.security import hash_password


async def _seed_parent_access(db: AsyncSession):
    school_a = School(
        name="Parent School A", school_type=SchoolType.secondary,
        address="1 A Road", lga="Ikeja", state="Lagos",
        phone="08011111111", email="a@parent-school.test",
    )
    school_b = School(
        name="Parent School B", school_type=SchoolType.secondary,
        address="1 B Road", lga="Ikeja", state="Lagos",
        phone="08022222222", email="b@parent-school.test",
    )
    db.add_all([school_a, school_b])
    await db.flush()

    users = [
        User(name="Parent A", email="parent-a@test.local", password_hash=hash_password("Password1!")),
        User(name="Parent B", email="parent-b@test.local", password_hash=hash_password("Password1!")),
    ]
    db.add_all(users)
    await db.flush()
    membership_a = SchoolMembership(
        user_id=users[0].id, school_id=school_a.id, role=MembershipRole.parent, is_active=True
    )
    membership_b = SchoolMembership(
        user_id=users[1].id, school_id=school_a.id, role=MembershipRole.parent, is_active=True
    )
    db.add_all([membership_a, membership_b])
    await db.flush()
    profile_a = GuardianProfile(
        school_id=school_a.id, membership_id=membership_a.id, status=GuardianStatus.active
    )
    profile_b = GuardianProfile(
        school_id=school_a.id, membership_id=membership_b.id, status=GuardianStatus.active
    )
    db.add_all([profile_a, profile_b])
    await db.flush()

    students = [
        Student(
            school_id=school_a.id, admission_number="A-001", first_name="Child", last_name="One",
            date_of_birth=date(2012, 1, 1), gender=Gender.female, admission_date=date(2024, 1, 1),
        ),
        Student(
            school_id=school_a.id, admission_number="A-002", first_name="Child", last_name="Two",
            date_of_birth=date(2012, 2, 2), gender=Gender.male, admission_date=date(2024, 1, 1),
        ),
        Student(
            school_id=school_b.id, admission_number="B-001", first_name="Other", last_name="School",
            date_of_birth=date(2012, 3, 3), gender=Gender.female, admission_date=date(2024, 1, 1),
        ),
    ]
    db.add_all(students)
    await db.flush()
    link_a = StudentGuardian(
        school_id=school_a.id,
        guardian_profile_id=profile_a.id,
        student_id=students[0].id,
        relationship_type=ParentRelationship.mother,
        can_view_results=True,
        can_view_finance=False,
        is_primary=True,
    )
    link_b = StudentGuardian(
        school_id=school_a.id,
        guardian_profile_id=profile_b.id,
        student_id=students[1].id,
        relationship_type=ParentRelationship.father,
    )
    db.add_all([link_a, link_b])
    await db.commit()
    context_a = ParentContext(users[0], membership_a, profile_a, school_a)
    return context_a, membership_a, profile_a, students, link_a


@pytest.mark.asyncio
async def test_parent_student_access_is_tenant_and_relationship_scoped(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, _, _, students, _ = await _seed_parent_access(db)

        access = await get_authorized_parent_student(db, context, students[0].id, "can_view_results")
        assert access.student.id == students[0].id
        assert len(await list_authorized_children(db, context)) == 1

        for inaccessible_id in (students[1].id, students[2].id, uuid.uuid4()):
            with pytest.raises(HTTPException) as exc:
                await get_authorized_parent_student(db, context, inaccessible_id)
            assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_relationship_status_and_permissions_are_enforced(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, _, _, students, link = await _seed_parent_access(db)
        permissions = await get_child_permissions(db, context, students[0].id)
        assert permissions["can_view_results"] is True
        assert permissions["can_view_finance"] is False

        with pytest.raises(HTTPException) as exc:
            await get_authorized_parent_student(db, context, students[0].id, "can_view_finance")
        assert exc.value.status_code == 404

        link.is_active = False
        await db.commit()
        with pytest.raises(HTTPException) as exc:
            await get_authorized_parent_student(db, context, students[0].id)
        assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_disabled_parent_membership_invalidates_context(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, membership, _, _, _ = await _seed_parent_access(db)
        membership.is_active = False
        await db.commit()
        context.user.current_membership_id = membership.id
        context.user.current_school_id = context.school.id
        with pytest.raises(HTTPException) as exc:
            await get_current_parent_context(current_user=context.user, db=db)
        assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_duplicate_guardian_student_relationship_is_rejected(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, _, profile, students, _ = await _seed_parent_access(db)
        db.add(StudentGuardian(
            school_id=context.school.id,
            guardian_profile_id=profile.id,
            student_id=students[0].id,
            relationship_type=ParentRelationship.guardian,
        ))
        with pytest.raises(IntegrityError):
            await db.commit()
