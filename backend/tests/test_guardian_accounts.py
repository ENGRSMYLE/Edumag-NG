from datetime import date, datetime, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.audit_event import AuditEvent
from app.models.guardian import GuardianProfile, StudentGuardian
from app.models.parent import ParentRelationship
from app.models.school import School, SchoolType
from app.models.school_membership import MembershipRole, SchoolMembership
from app.models.student import Gender, Student
from app.models.user import User
from app.schemas.guardian import GuardianInviteRequest
from app.services.guardian_accounts import create_or_link_guardian, search_guardians
from app.utils.security import hash_password


async def _seed_school(db: AsyncSession):
    school = School(
        name="Guardian Test School",
        school_type=SchoolType.secondary,
        address="1 Test Road",
        lga="Ikeja",
        state="Lagos",
        phone="08010000000",
        email="guardian-school@test.local",
    )
    admin = User(
        name="School Admin",
        email="guardian-admin@test.local",
        password_hash=hash_password("Password1!"),
        is_first_login=False,
    )
    db.add_all([school, admin])
    await db.flush()
    db.add(SchoolMembership(
        user_id=admin.id,
        school_id=school.id,
        role=MembershipRole.admin,
        is_active=True,
    ))
    students = [
        Student(
            school_id=school.id,
            admission_number=f"G-{number:03}",
            first_name=f"Child{number}",
            last_name="Test",
            date_of_birth=date(2012, 1, number),
            gender=Gender.female,
            admission_date=date(2024, 1, 1),
        )
        for number in (1, 2)
    ]
    db.add_all(students)
    await db.commit()
    return school, admin, students


def _payload(student_id, email="parent@example.com", phone="08012345678", **changes):
    values = {
        "student_id": student_id,
        "name": "Test Parent",
        "email": email,
        "phone": phone,
        "relationship_type": ParentRelationship.mother,
    }
    values.update(changes)
    return GuardianInviteRequest(**values)


@pytest.mark.asyncio
async def test_new_parent_creation_and_audit(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        school, admin, students = await _seed_school(db)
        result = await create_or_link_guardian(
            db, school_id=school.id, actor_user_id=admin.id, payload=_payload(students[0].id)
        )
        assert result.user.email == "parent@example.com"
        assert result.user.phone == "+2348012345678"
        assert result.membership.role == MembershipRole.parent
        assert result.invitation_created is True
        assert result.email_task is not None
        assert result.relationship.student_id == students[0].id
        assert (await db.execute(select(func.count(AuditEvent.id)))).scalar_one() == 6


@pytest.mark.asyncio
async def test_existing_parent_can_link_second_child_without_duplicate_invite(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        school, admin, students = await _seed_school(db)
        first = await create_or_link_guardian(
            db, school_id=school.id, actor_user_id=admin.id, payload=_payload(students[0].id)
        )
        second = await create_or_link_guardian(
            db, school_id=school.id, actor_user_id=admin.id, payload=_payload(students[1].id)
        )
        assert second.user.id == first.user.id
        assert second.guardian_profile.id == first.guardian_profile.id
        assert second.invitation_created is False
        assert second.email_task is None

        with pytest.raises(HTTPException) as exc:
            await create_or_link_guardian(
                db, school_id=school.id, actor_user_id=admin.id, payload=_payload(students[0].id)
            )
        assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_multiple_guardians_can_link_one_student(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        school, admin, students = await _seed_school(db)
        first = await create_or_link_guardian(
            db, school_id=school.id, actor_user_id=admin.id, payload=_payload(students[0].id)
        )
        second = await create_or_link_guardian(
            db,
            school_id=school.id,
            actor_user_id=admin.id,
            payload=_payload(
                students[0].id,
                email="second-parent@example.com",
                phone="08087654321",
                relationship_type=ParentRelationship.father,
            ),
        )
        assert first.guardian_profile.id != second.guardian_profile.id
        assert (await db.execute(select(func.count(StudentGuardian.id)))).scalar_one() == 2


@pytest.mark.asyncio
async def test_email_phone_conflict_requires_manual_resolution(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        school, admin, students = await _seed_school(db)
        email_owner = User(
            name="Email Owner", email="email-owner@example.com", phone="+2348011111111",
            password_hash=hash_password("Password1!"),
        )
        phone_owner = User(
            name="Phone Owner", email="phone-owner@example.com", phone="+2348022222222",
            phone_verified_at=datetime.now(timezone.utc), password_hash=hash_password("Password1!"),
        )
        db.add_all([email_owner, phone_owner])
        await db.commit()

        with pytest.raises(HTTPException) as exc:
            await create_or_link_guardian(
                db,
                school_id=school.id,
                actor_user_id=admin.id,
                payload=_payload(
                    students[0].id,
                    email="EMAIL-OWNER@example.com",
                    phone="+234 802 222 2222",
                ),
            )
        assert exc.value.status_code == 409
        assert "manual resolution" in exc.value.detail


@pytest.mark.asyncio
async def test_relationship_failure_rolls_back_account_and_audit(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        school, admin, students = await _seed_school(db)
        await create_or_link_guardian(
            db,
            school_id=school.id,
            actor_user_id=admin.id,
            payload=_payload(students[0].id, is_primary=True),
        )
        with pytest.raises(HTTPException) as exc:
            await create_or_link_guardian(
                db,
                school_id=school.id,
                actor_user_id=admin.id,
                payload=_payload(
                    students[0].id,
                    email="rollback-parent@example.com",
                    phone="08033334444",
                    is_primary=True,
                ),
            )
        assert exc.value.status_code == 409
        assert (await db.execute(
            select(User).where(User.email == "rollback-parent@example.com")
        )).scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_guardian_search_normalizes_identity_and_name_is_display_only(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        school, admin, students = await _seed_school(db)
        created = await create_or_link_guardian(
            db, school_id=school.id, actor_user_id=admin.id, payload=_payload(students[0].id)
        )
        created.user.phone_verified_at = datetime.now(timezone.utc)
        await db.commit()

        by_email = await search_guardians(db, school.id, email=" PARENT@EXAMPLE.COM ")
        by_phone = await search_guardians(db, school.id, phone="08012345678")
        by_name = await search_guardians(db, school.id, name="Test Par")
        assert by_email[0].guardian_profile_id == created.guardian_profile.id
        assert by_phone[0].phone_verified is True
        assert by_name[0].name == "Test Parent"
