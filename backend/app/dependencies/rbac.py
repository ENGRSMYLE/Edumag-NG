from typing import Callable

from fastapi import Depends, HTTPException, status
from sqlalchemy import select

from app.dependencies.auth import get_current_user
from app.models.user import User

# ---------------------------------------------------------------------------
# Permission map
# ---------------------------------------------------------------------------
ROLE_PERMISSIONS: dict[str, list[str]] = {
    "teacher": [
        "view_own_class_students",
        "assign_student_to_class",
        "remove_student_from_class",
        "transfer_student",
        "promote_student",
        "message_parents_limited",
        "view_class_list",
        "take_attendance",
        "edit_attendance",
        "view_own_class_attendance",
        "enter_scores",
        "edit_scores",
        "add_teacher_comments",
        "view_own_class_reports",
        "create_assignment",
        "grade_assignment",
        "upload_materials",
        "view_own_class_assignments",
        "message_admin",
    ],
    "admin": [
        "deactivate_users",
        "create_student",
        "edit_student",
        "view_all_students",
        "bulk_upload_students",
        "add_parent",
        "edit_parent",
        "view_parent_contact",
        "message_parents_full",
        "create_class",
        "assign_teacher_to_class",
        "edit_class",
        "view_class_list",
        "view_own_class_attendance",
        "view_all_attendance",
        "view_own_class_reports",
        "approve_results",
        "generate_report_cards",
        "view_all_reports",
        "record_payment",
        "confirm_bank_transfer",
        "view_payment_status",
        "edit_payment_records",
        "generate_financial_reports",
        "track_debtors",
        "view_all_assignments",
        "send_announcements",
        "message_teachers",
        "message_admin",
        "backup_export_data",
    ],
    # super_admin has a wildcard — checked below
    "super_admin": ["*"],
}


def _has_permission(role: str, permission: str) -> bool:
    perms = ROLE_PERMISSIONS.get(role, [])
    return "*" in perms or permission in perms


# ---------------------------------------------------------------------------
# Dependency factories
# ---------------------------------------------------------------------------

def require_permission(permission: str) -> Callable:
    async def dependency(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if current_user.is_first_login:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "PASSWORD_CHANGE_REQUIRED",
                    "message": "Please set your password before performing this action",
                },
            )
        role_value = current_user.current_role.value  # type: ignore[attr-defined]
        if not _has_permission(role_value, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return dependency


def require_any_permission(*permissions: str) -> Callable:
    """Allow access if the user has ANY one of the listed permissions."""
    async def dependency(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if current_user.is_first_login:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "PASSWORD_CHANGE_REQUIRED",
                    "message": "Please set your password before performing this action",
                },
            )
        role_value = current_user.current_role.value  # type: ignore[attr-defined]
        if not any(_has_permission(role_value, perm) for perm in permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return dependency


def require_role(*roles: str) -> Callable:
    async def dependency(
        current_user: User = Depends(get_current_user),
    ) -> User:
        role_value = current_user.current_role.value  # type: ignore[attr-defined]
        if role_value not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return dependency


# ---------------------------------------------------------------------------
# Tenant-scoped query helper
# ---------------------------------------------------------------------------

def get_school_scoped_query(model, current_user: User):
    """Return a select() pre-filtered by current_user.current_school_id.

    Every router that lists or fetches records MUST use this to enforce
    tenant isolation — never query without a school_id filter.
    """
    return select(model).where(
        model.school_id == current_user.current_school_id  # type: ignore[attr-defined]
    )
