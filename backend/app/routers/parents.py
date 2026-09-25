import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.rbac import require_permission
from app.models.guardian import GuardianStatus
from app.models.user import User
from app.routers.guardians import _queue_invitation_email
from app.schemas.guardian import (
    GuardianInviteRequest,
    GuardianInviteResponse,
    PaginatedParentAccountsResponse,
    ParentAccountResponse,
    ParentAccountUpdate,
)
from app.services.guardian_accounts import (
    create_or_link_guardian,
    disable_guardian_account,
    reactivate_guardian_account,
    resend_guardian_invitation,
)
from app.services.parent_management import get_parent_account, list_parent_accounts, update_parent_account
from app.utils.rate_limit import limiter

router = APIRouter(prefix="/parents", tags=["parents"])


@router.get("", response_model=PaginatedParentAccountsResponse)
@router.get("/", response_model=PaginatedParentAccountsResponse, include_in_schema=False)
async def list_parents(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    account_status: GuardianStatus | None = Query(None, alias="status"),
    current_user: User = Depends(require_permission("view_parent_accounts")),
    db: AsyncSession = Depends(get_db),
) -> PaginatedParentAccountsResponse:
    return await list_parent_accounts(
        db, current_user.current_school_id, page=page, per_page=per_page,  # type: ignore[attr-defined]
        search=search, account_status=account_status,
    )


@router.post("/invite", status_code=status.HTTP_201_CREATED, response_model=GuardianInviteResponse)
@limiter.limit("10/minute")
async def invite_parent(
    request: Request,
    payload: GuardianInviteRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_permission("create_parent_account")),
    db: AsyncSession = Depends(get_db),
) -> GuardianInviteResponse:
    result = await create_or_link_guardian(
        db, school_id=current_user.current_school_id, actor_user_id=current_user.id, payload=payload,  # type: ignore[attr-defined]
    )
    if result.email_task:
        _queue_invitation_email(background_tasks, result.email_task)
    return GuardianInviteResponse(
        guardian_profile_id=result.guardian_profile.id,
        membership_id=result.membership.id,
        user_id=result.user.id,
        student_guardian_id=result.relationship.id,
        invitation_created=result.invitation_created,
        invitation_expires_at=result.membership.invite_token_expires,
    )


@router.get("/{guardian_id}", response_model=ParentAccountResponse)
async def get_parent(
    guardian_id: uuid.UUID,
    current_user: User = Depends(require_permission("view_parent_accounts")),
    db: AsyncSession = Depends(get_db),
) -> ParentAccountResponse:
    return await get_parent_account(db, current_user.current_school_id, guardian_id)  # type: ignore[attr-defined]


@router.patch("/{guardian_id}", response_model=ParentAccountResponse)
async def update_parent(
    guardian_id: uuid.UUID,
    payload: ParentAccountUpdate,
    current_user: User = Depends(require_permission("edit_parent_account")),
    db: AsyncSession = Depends(get_db),
) -> ParentAccountResponse:
    return await update_parent_account(
        db, current_user.current_school_id, guardian_id, current_user.id, payload  # type: ignore[attr-defined]
    )


@router.post("/{guardian_id}/enable")
async def enable_parent(
    guardian_id: uuid.UUID,
    current_user: User = Depends(require_permission("edit_parent_account")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await reactivate_guardian_account(
        db, school_id=current_user.current_school_id, actor_user_id=current_user.id, profile_id=guardian_id,  # type: ignore[attr-defined]
    )
    return {"message": "Parent account enabled"}


@router.post("/{guardian_id}/disable")
async def disable_parent(
    guardian_id: uuid.UUID,
    current_user: User = Depends(require_permission("disable_parent_account")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await disable_guardian_account(
        db, school_id=current_user.current_school_id, actor_user_id=current_user.id, profile_id=guardian_id,  # type: ignore[attr-defined]
    )
    return {"message": "Parent account disabled"}


@router.post("/{guardian_id}/resend-invite")
async def resend_parent_invite(
    guardian_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_permission("resend_parent_invite")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    task = await resend_guardian_invitation(
        db, school_id=current_user.current_school_id, actor_user_id=current_user.id, profile_id=guardian_id,  # type: ignore[attr-defined]
    )
    _queue_invitation_email(background_tasks, task)
    return {"message": "Invitation resent successfully"}
