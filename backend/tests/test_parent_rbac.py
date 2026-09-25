import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.dependencies.rbac import ROLE_PERMISSIONS, has_permission
from app.services.parent_access import get_authorized_parent_student
from tests.test_parent_authorization import _seed_parent_access


PARENT_OPERATIONS = {
    "view_own_children",
    "view_child_attendance",
    "view_child_results",
    "view_child_assignments",
    "view_child_finance",
    "view_parent_announcements",
    "message_admin",
    "message_related_teacher",
    "manage_own_profile",
    "create_parent_account",
    "view_parent_accounts",
    "edit_parent_account",
    "disable_parent_account",
    "link_guardian_to_student",
    "unlink_guardian_from_student",
    "resend_parent_invite",
    "message_parents",
    "broadcast_to_parents",
}

EXPECTED_ALLOWED = {
    "parent": {
        "view_own_children",
        "view_child_attendance",
        "view_child_results",
        "view_child_assignments",
        "view_child_finance",
        "view_parent_announcements",
        "message_admin",
        "message_related_teacher",
        "manage_own_profile",
    },
    # Teachers retain their existing ability to contact administrators, but do
    # not gain parent-account administration or parent-portal data access.
    "teacher": {"message_admin"},
    "admin": {
        "message_admin",
        "create_parent_account",
        "view_parent_accounts",
        "edit_parent_account",
        "disable_parent_account",
        "link_guardian_to_student",
        "unlink_guardian_from_student",
        "resend_parent_invite",
        "message_parents",
        "broadcast_to_parents",
    },
    "super_admin": PARENT_OPERATIONS,
}


@pytest.mark.parametrize("role", ["parent", "teacher", "admin", "super_admin"])
@pytest.mark.parametrize("operation", sorted(PARENT_OPERATIONS))
def test_parent_operation_rbac_matrix(role: str, operation: str) -> None:
    assert has_permission(role, operation) is (operation in EXPECTED_ALLOWED[role])


@pytest.mark.asyncio
async def test_student_access_requires_role_and_relationship_permissions(
    client, test_engine, monkeypatch
) -> None:
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, _, _, students, relationship = await _seed_parent_access(db)

        # Both layers allow results initially.
        access = await get_authorized_parent_student(
            db, context, students[0].id, "can_view_results"
        )
        assert access.student.id == students[0].id

        # Removing only the role grant denies before relationship lookup.
        parent_permissions = list(ROLE_PERMISSIONS["parent"])
        parent_permissions.remove("view_child_results")
        monkeypatch.setitem(ROLE_PERMISSIONS, "parent", parent_permissions)
        with pytest.raises(HTTPException) as exc:
            await get_authorized_parent_student(
                db, context, students[0].id, "can_view_results"
            )
        assert exc.value.status_code == 403

        # Restoring the role grant but disabling the relationship flag remains
        # denied, and deliberately uses 404 to avoid disclosing child records.
        monkeypatch.setitem(ROLE_PERMISSIONS, "parent", list(parent_permissions) + ["view_child_results"])
        relationship.can_view_results = False
        await db.commit()
        with pytest.raises(HTTPException) as exc:
            await get_authorized_parent_student(
                db, context, students[0].id, "can_view_results"
            )
        assert exc.value.status_code == 404
