from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.guardian import StudentGuardian
from app.models.refresh_token import RefreshToken
from app.models.school import School, SchoolType
from app.schemas.guardian import ParentAccountUpdate, StudentGuardianCreate, StudentGuardianUpdate
from app.services.guardian_accounts import create_or_link_guardian
from app.services.parent_management import (
    get_parent_account,
    link_guardian_to_student,
    list_parent_accounts,
    list_student_guardians,
    unlink_guardian_from_student,
    update_parent_account,
    update_student_guardian,
)
from app.utils.security import hash_token
from tests.test_guardian_accounts import _payload, _seed_school


@pytest.mark.asyncio
async def test_parent_account_and_relationship_crud(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        school, admin, students = await _seed_school(db)
        invited = await create_or_link_guardian(
            db, school_id=school.id, actor_user_id=admin.id, payload=_payload(students[0].id)
        )

        page = await list_parent_accounts(db, school.id, page=1, per_page=20)
        assert page.total == 1
        assert page.items[0].activation_status == "invited"
        assert page.items[0].invitation_status == "pending"
        assert page.items[0].active_children_count == 1

        updated = await update_parent_account(
            db,
            school.id,
            invited.guardian_profile.id,
            admin.id,
            ParentAccountUpdate(name="Updated Parent", occupation="Engineer"),
        )
        assert updated.name == "Updated Parent"
        assert updated.occupation == "Engineer"

        second_link = await link_guardian_to_student(
            db,
            school.id,
            students[1].id,
            admin.id,
            StudentGuardianCreate(
                guardian_profile_id=invited.guardian_profile.id,
                relationship_type="mother",
                can_view_finance=True,
            ),
        )
        changed = await update_student_guardian(
            db,
            school.id,
            students[1].id,
            second_link.relationship_id,
            admin.id,
            StudentGuardianUpdate(can_view_finance=False, is_emergency_contact=True),
        )
        assert changed.can_view_finance is False
        assert changed.is_emergency_contact is True
        assert len(await list_student_guardians(db, school.id, students[1].id)) == 1


@pytest.mark.asyncio
async def test_parent_management_is_tenant_scoped(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        school, admin, students = await _seed_school(db)
        invited = await create_or_link_guardian(
            db, school_id=school.id, actor_user_id=admin.id, payload=_payload(students[0].id)
        )
        other_school = School(
            name="Other Tenant", school_type=SchoolType.secondary, address="2 Road",
            lga="Ikeja", state="Lagos", phone="08099999999", email="other-tenant@example.com",
        )
        db.add(other_school)
        await db.commit()

        with pytest.raises(HTTPException) as exc:
            await get_parent_account(db, other_school.id, invited.guardian_profile.id)
        assert exc.value.status_code == 404
        with pytest.raises(HTTPException) as exc:
            await list_student_guardians(db, other_school.id, students[0].id)
        assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_duplicate_active_link_is_rejected(client, test_engine) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        school, admin, students = await _seed_school(db)
        invited = await create_or_link_guardian(
            db, school_id=school.id, actor_user_id=admin.id, payload=_payload(students[0].id)
        )
        with pytest.raises(HTTPException) as exc:
            await link_guardian_to_student(
                db,
                school.id,
                students[0].id,
                admin.id,
                StudentGuardianCreate(
                    guardian_profile_id=invited.guardian_profile.id,
                    relationship_type="mother",
                ),
            )
        assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_unlink_only_disables_membership_after_final_child_and_revokes_sessions(
    client, test_engine
) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        school, admin, students = await _seed_school(db)
        invited = await create_or_link_guardian(
            db, school_id=school.id, actor_user_id=admin.id, payload=_payload(students[0].id)
        )
        invited.membership.is_active = True
        invited.user.is_first_login = False
        second = await link_guardian_to_student(
            db,
            school.id,
            students[1].id,
            admin.id,
            StudentGuardianCreate(
                guardian_profile_id=invited.guardian_profile.id,
                relationship_type="mother",
            ),
        )
        refresh = RefreshToken(
            user_id=invited.user.id,
            membership_id=invited.membership.id,
            token_hash=hash_token("phase-six-refresh"),
            expires_at=datetime.now(timezone.utc) + timedelta(days=1),
        )
        db.add(refresh)
        await db.commit()

        await unlink_guardian_from_student(
            db,
            school.id,
            students[0].id,
            invited.relationship.id,
            admin.id,
        )
        await db.refresh(invited.membership)
        await db.refresh(refresh)
        assert invited.membership.is_active is True
        assert refresh.revoked is False

        await unlink_guardian_from_student(
            db, school.id, students[1].id, second.relationship_id, admin.id
        )
        await db.refresh(invited.membership)
        await db.refresh(refresh)
        soft_deleted = await db.get(StudentGuardian, second.relationship_id)
        assert soft_deleted is not None and soft_deleted.is_active is False
        assert invited.membership.is_active is False
        assert refresh.revoked is True
