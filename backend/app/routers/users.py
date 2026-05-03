import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies.rbac import require_permission, require_role
from app.models.class_ import Class
from app.models.refresh_token import RefreshToken
from app.models.school import School
from app.models.school_membership import MembershipRole, SchoolMembership
from app.models.user import User
from app.schemas.auth import InviteUserRequest
from app.schemas.user import (
    DeactivateUserRequest,
    PaginatedUsersResponse,
    UpdateUserRequest,
    UserListResponse,
    UserResponse,
)
from app.services.email_service import send_invite_email, send_school_linked_email
from app.utils.rate_limit import limiter
from app.utils.security import create_invite_token, generate_temp_password, hash_password

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/users", tags=["users"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _user_response(user: User, membership: SchoolMembership) -> UserResponse:
    return UserResponse.model_validate({
        "membership_id": membership.id,
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "role": getattr(membership.role, "value", membership.role),
        "is_active": membership.is_active,
        "is_first_login": user.is_first_login,
        "profile_photo_url": user.profile_photo_url,
        "class_id": membership.class_id,
        "created_at": membership.created_at,
        "last_login_at": user.last_login_at,
    })


def _user_list_response(user: User, membership: SchoolMembership) -> UserListResponse:
    return UserListResponse.model_validate({
        "membership_id": membership.id,
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "role": getattr(membership.role, "value", membership.role),
        "is_active": membership.is_active,
        "class_id": membership.class_id,
        "created_at": membership.created_at,
    })


# ---------------------------------------------------------------------------
# POST /invite
# ---------------------------------------------------------------------------

@router.post("/invite", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
@limiter.limit("10/minute")
async def invite_user(
    request: Request,
    body: InviteUserRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role("super_admin")),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    # Fetch school name for email
    school_result = await db.execute(
        select(School).where(School.id == current_user.current_school_id)
    )
    school: School | None = school_result.scalar_one_or_none()
    school_name = school.name if school else ""

    # Verify class belongs to same school (teacher role only)
    if body.role == "teacher" and body.class_id:
        class_check = await db.execute(
            select(Class).where(
                Class.id == body.class_id,
                Class.school_id == current_user.current_school_id,
            )
        )
        if not class_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Class not found in this school",
            )

    # Check if a user with this email already exists globally
    existing_user_result = await db.execute(
        select(User).where(User.email == body.email)
    )
    existing_user: User | None = existing_user_result.scalar_one_or_none()

    if existing_user:
        # Check if they already have a membership in this school
        existing_membership_result = await db.execute(
            select(SchoolMembership).where(
                SchoolMembership.user_id == existing_user.id,
                SchoolMembership.school_id == current_user.current_school_id,
            )
        )
        if existing_membership_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This user already has a membership in this school",
            )

        # User exists globally — create membership only
        try:
            membership = SchoolMembership(
                user_id=existing_user.id,
                school_id=current_user.current_school_id,
                role=MembershipRole[body.role],
                class_id=body.class_id,
                invited_by=current_user.id,
                is_active=False,
            )
            db.add(membership)
            await db.flush()

            invite_token = create_invite_token(str(membership.id))
            membership.invite_token = invite_token
            membership.invite_token_expires = datetime.now(timezone.utc) + timedelta(
                hours=settings.INVITE_TOKEN_EXPIRE_HOURS
            )

            await db.commit()
            await db.refresh(membership)
        except Exception:
            await db.rollback()
            logger.exception("invite_user (link) failed for %s", body.email)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create invitation. Please try again.",
            )

        invite_link = f"{settings.FRONTEND_URL}/set-password?token={invite_token}"
        background_tasks.add_task(
            send_school_linked_email,
            to_email=existing_user.email,
            to_name=existing_user.name,
            school_name=school_name,
            role=body.role,
            invite_link=invite_link,
        )
        return _user_response(existing_user, membership)

    else:
        # New user — create User + SchoolMembership
        temp_password = generate_temp_password()
        try:
            new_user = User(
                name=body.name,
                email=body.email,
                password_hash=hash_password(temp_password),
                is_active=True,
                is_first_login=True,
            )
            db.add(new_user)
            await db.flush()

            membership = SchoolMembership(
                user_id=new_user.id,
                school_id=current_user.current_school_id,
                role=MembershipRole[body.role],
                class_id=body.class_id,
                invited_by=current_user.id,
                is_active=False,
            )
            db.add(membership)
            await db.flush()

            invite_token = create_invite_token(str(membership.id))
            membership.invite_token = invite_token
            membership.invite_token_expires = datetime.now(timezone.utc) + timedelta(
                hours=settings.INVITE_TOKEN_EXPIRE_HOURS
            )

            await db.commit()
            await db.refresh(new_user)
            await db.refresh(membership)
        except Exception:
            await db.rollback()
            logger.exception("invite_user (new) failed for %s", body.email)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create invitation. Please try again.",
            )

        invite_link = f"{settings.FRONTEND_URL}/set-password?token={invite_token}"
        background_tasks.add_task(
            send_invite_email,
            to_email=new_user.email,
            to_name=new_user.name,
            school_name=school_name,
            role=body.role,
            invite_link=invite_link,
            temp_password=temp_password,
        )
        return _user_response(new_user, membership)


# ---------------------------------------------------------------------------
# GET /
# ---------------------------------------------------------------------------

@router.get("/", response_model=PaginatedUsersResponse)
@limiter.limit("30/minute")
async def list_users(
    request: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    role: str | None = Query(None),
    is_active: bool | None = Query(None),
    search: str | None = Query(None),
    current_user: User = Depends(require_role("super_admin", "admin")),
    db: AsyncSession = Depends(get_db),
) -> PaginatedUsersResponse:
    base_q = (
        select(User, SchoolMembership)
        .join(SchoolMembership, SchoolMembership.user_id == User.id)
        .where(SchoolMembership.school_id == current_user.current_school_id)
    )

    if role:
        try:
            base_q = base_q.where(SchoolMembership.role == MembershipRole[role])
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid role: {role}",
            )

    if is_active is not None:
        base_q = base_q.where(SchoolMembership.is_active == is_active)

    if search:
        term = f"%{search}%"
        base_q = base_q.where(
            or_(User.name.ilike(term), User.email.ilike(term))
        )

    count_q = select(func.count()).select_from(base_q.subquery())
    total_result = await db.execute(count_q)
    total_count: int = total_result.scalar_one()

    offset = (page - 1) * per_page
    items_result = await db.execute(
        base_q.order_by(SchoolMembership.created_at.desc()).offset(offset).limit(per_page)
    )
    rows = items_result.all()

    import math
    return PaginatedUsersResponse(
        items=[_user_list_response(user, membership) for user, membership in rows],
        total=total_count,
        page=page,
        per_page=per_page,
        total_pages=math.ceil(total_count / per_page) if total_count > 0 else 1,
    )


# ---------------------------------------------------------------------------
# GET /{user_id}
# ---------------------------------------------------------------------------

@router.get("/{user_id}", response_model=UserResponse)
@limiter.limit("30/minute")
async def get_user(
    request: Request,
    user_id: uuid.UUID,
    current_user: User = Depends(require_role("super_admin", "admin")),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    result = await db.execute(
        select(User, SchoolMembership)
        .join(SchoolMembership, SchoolMembership.user_id == User.id)
        .where(
            User.id == user_id,
            SchoolMembership.school_id == current_user.current_school_id,
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user, membership = row
    return _user_response(user, membership)


# ---------------------------------------------------------------------------
# PATCH /{user_id}/deactivate
# ---------------------------------------------------------------------------

@router.patch("/{user_id}/deactivate", response_model=UserResponse)
@limiter.limit("10/minute")
async def deactivate_user(
    request: Request,
    user_id: uuid.UUID,
    body: DeactivateUserRequest = DeactivateUserRequest(),
    current_user: User = Depends(require_permission("deactivate_users")),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account",
        )

    result = await db.execute(
        select(User, SchoolMembership)
        .join(SchoolMembership, SchoolMembership.user_id == User.id)
        .where(
            User.id == user_id,
            SchoolMembership.school_id == current_user.current_school_id,
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    target_user, target_membership = row

    # Admins cannot deactivate super_admins
    if (
        target_membership.role == MembershipRole.super_admin
        and current_user.current_role != MembershipRole.super_admin
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only a super admin can deactivate another super admin",
        )

    target_membership.is_active = False

    # Revoke all refresh tokens for this specific membership
    await db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.membership_id == target_membership.id,
            RefreshToken.revoked.is_(False),
        )
        .values(revoked=True)
    )

    await db.commit()
    await db.refresh(target_user)
    await db.refresh(target_membership)
    return _user_response(target_user, target_membership)


# ---------------------------------------------------------------------------
# PATCH /{user_id}
# ---------------------------------------------------------------------------

@router.patch("/{user_id}", response_model=UserResponse)
@limiter.limit("20/minute")
async def update_user(
    request: Request,
    user_id: uuid.UUID,
    body: UpdateUserRequest,
    current_user: User = Depends(require_role("super_admin")),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    result = await db.execute(
        select(User, SchoolMembership)
        .join(SchoolMembership, SchoolMembership.user_id == User.id)
        .where(
            User.id == user_id,
            SchoolMembership.school_id == current_user.current_school_id,
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    target_user, target_membership = row

    if body.name is not None:
        target_user.name = body.name
    if body.phone is not None:
        target_user.phone = body.phone

    await db.commit()
    await db.refresh(target_user)
    await db.refresh(target_membership)
    return _user_response(target_user, target_membership)


# ---------------------------------------------------------------------------
# POST /{user_id}/resend-invite
# ---------------------------------------------------------------------------

@router.post("/{user_id}/resend-invite", status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
async def resend_invite(
    request: Request,
    user_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role("super_admin")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        select(User, SchoolMembership)
        .join(SchoolMembership, SchoolMembership.user_id == User.id)
        .where(
            User.id == user_id,
            SchoolMembership.school_id == current_user.current_school_id,
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    target_user, target_membership = row

    if target_membership.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already active — invite cannot be resent",
        )

    school_result = await db.execute(
        select(School).where(School.id == current_user.current_school_id)
    )
    school: School | None = school_result.scalar_one_or_none()
    school_name = school.name if school else ""

    new_invite_token = create_invite_token(str(target_membership.id))
    target_membership.invite_token = new_invite_token
    target_membership.invite_token_expires = datetime.now(timezone.utc) + timedelta(
        hours=settings.INVITE_TOKEN_EXPIRE_HOURS
    )

    # New users need a fresh temp password; existing linked users do not
    temp_password: str | None = None
    if target_user.is_first_login:
        temp_password = generate_temp_password()
        target_user.password_hash = hash_password(temp_password)

    await db.commit()

    invite_link = f"{settings.FRONTEND_URL}/set-password?token={new_invite_token}"

    role_str = getattr(target_membership.role, "value", target_membership.role)
    if temp_password is not None:
        background_tasks.add_task(
            send_invite_email,
            to_email=target_user.email,
            to_name=target_user.name,
            school_name=school_name,
            role=role_str,
            invite_link=invite_link,
            temp_password=temp_password,
        )
    else:
        background_tasks.add_task(
            send_school_linked_email,
            to_email=target_user.email,
            to_name=target_user.name,
            school_name=school_name,
            role=role_str,
            invite_link=invite_link,
        )

    return {"message": "Invitation resent successfully"}
