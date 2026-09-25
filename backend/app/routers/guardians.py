import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.rbac import require_permission
from app.models.user import User
from app.schemas.guardian import (
    GuardianInviteRequest,
    GuardianInviteResponse,
    GuardianSearchResponse,
)
from app.services.email_service import send_invite_email, send_school_linked_email
from app.services.guardian_accounts import (
    GuardianEmailTask,
    create_or_link_guardian,
    disable_guardian_account,
    reactivate_guardian_account,
    resend_guardian_invitation,
    search_guardians,
)
from app.utils.rate_limit import limiter

router = APIRouter(prefix="/guardians", tags=["guardians"])


def _queue_invitation_email(background_tasks: BackgroundTasks, task: GuardianEmailTask) -> None:
    if task.kind == "new_account":
        background_tasks.add_task(
            send_invite_email,
            to_email=task.to_email,
            to_name=task.to_name,
            school_name=task.school_name,
            role="parent",
            invite_link=task.invite_link,
            temp_password=task.temp_password or "",
        )
    else:
        background_tasks.add_task(
            send_school_linked_email,
            to_email=task.to_email,
            to_name=task.to_name,
            school_name=task.school_name,
            role="parent",
            invite_link=task.invite_link,
        )


@router.get("/search", response_model=GuardianSearchResponse)
@limiter.limit("30/minute")
async def search_guardian_accounts(
    request: Request,
    email: str | None = Query(None),
    phone: str | None = Query(None),
    name: str | None = Query(None, min_length=2),
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(require_permission("view_parent_accounts")),
    db: AsyncSession = Depends(get_db),
) -> GuardianSearchResponse:
    items = await search_guardians(
        db,
        current_user.current_school_id,  # type: ignore[attr-defined]
        email=email,
        phone=phone,
        name=name,
        limit=limit,
    )
    return GuardianSearchResponse(items=items)


@router.post("/invite", status_code=status.HTTP_201_CREATED, response_model=GuardianInviteResponse)
@limiter.limit("10/minute")
async def invite_guardian(
    request: Request,
    payload: GuardianInviteRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_permission("create_parent_account")),
    db: AsyncSession = Depends(get_db),
) -> GuardianInviteResponse:
    result = await create_or_link_guardian(
        db,
        school_id=current_user.current_school_id,  # type: ignore[attr-defined]
        actor_user_id=current_user.id,
        payload=payload,
    )

    # The service commits before returning, so delivery can never race an
    # uncommitted or rolled-back account.
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


@router.post("/{profile_id}/resend-invite")
async def resend_parent_invite(
    profile_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_permission("resend_parent_invite")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    task = await resend_guardian_invitation(
        db,
        school_id=current_user.current_school_id,  # type: ignore[attr-defined]
        actor_user_id=current_user.id,
        profile_id=profile_id,
    )
    _queue_invitation_email(background_tasks, task)
    return {"message": "Invitation resent successfully"}


@router.patch("/{profile_id}/disable")
async def disable_parent(
    profile_id: uuid.UUID,
    current_user: User = Depends(require_permission("disable_parent_account")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await disable_guardian_account(
        db,
        school_id=current_user.current_school_id,  # type: ignore[attr-defined]
        actor_user_id=current_user.id,
        profile_id=profile_id,
    )
    return {"message": "Parent account disabled"}


@router.patch("/{profile_id}/reactivate")
async def reactivate_parent(
    profile_id: uuid.UUID,
    current_user: User = Depends(require_permission("edit_parent_account")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await reactivate_guardian_account(
        db,
        school_id=current_user.current_school_id,  # type: ignore[attr-defined]
        actor_user_id=current_user.id,
        profile_id=profile_id,
    )
    return {"message": "Parent account reactivated"}
