"""
Communication router — announcements and internal messages.
"""
from __future__ import annotations

import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.dependencies.rbac import require_permission
from app.models.communication import Announcement, Message
from app.models.school_membership import MembershipRole, SchoolMembership
from app.models.user import User
from app.schemas.communication import (
    AnnouncementCreate,
    AnnouncementResponse,
    InboxResponse,
    MessageResponse,
    PaginatedAnnouncementResponse,
    PaginatedMessageResponse,
    RecipientResponse,
    SendMessageRequest,
    UnreadCountResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/communication", tags=["communication"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _announcement_response(a: Announcement) -> AnnouncementResponse:
    return AnnouncementResponse(
        id=a.id,
        title=a.title,
        body=a.body,
        target_audience=a.target_audience,  # type: ignore[arg-type]
        sent_by_name=a.sender.name,
        created_at=a.created_at,
    )


def _message_response(m: Message) -> MessageResponse:
    return MessageResponse(
        id=m.id,
        sender_id=m.sender_id,
        sender_name=m.sender.name,
        recipient_id=m.recipient_id,
        recipient_name=m.recipient.name,
        subject=m.subject,
        body=m.body,
        is_read=m.is_read,
        created_at=m.created_at,
    )


_MSG_OPTIONS = [
    selectinload(Message.sender),
    selectinload(Message.recipient),
]


# ---------------------------------------------------------------------------
# POST /announcements
# ---------------------------------------------------------------------------

@router.post("/announcements", response_model=AnnouncementResponse, status_code=status.HTTP_201_CREATED)
async def create_announcement(
    body: AnnouncementCreate,
    current_user: User = Depends(require_permission("send_announcements")),
    db: AsyncSession = Depends(get_db),
) -> AnnouncementResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]

    ann = Announcement(
        school_id=school_id,
        title=body.title,
        body=body.body,
        target_audience=body.target_audience,
        sent_by=current_user.id,
    )
    db.add(ann)
    await db.flush()

    result = await db.execute(
        select(Announcement)
        .where(Announcement.id == ann.id)
        .options(selectinload(Announcement.sender))
    )
    ann = result.scalar_one()
    await db.commit()
    return _announcement_response(ann)


# ---------------------------------------------------------------------------
# GET /announcements
# ---------------------------------------------------------------------------

@router.get("/announcements", response_model=PaginatedAnnouncementResponse)
async def list_announcements(
    target_audience: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedAnnouncementResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]

    q = (
        select(Announcement)
        .where(Announcement.school_id == school_id)
        .options(selectinload(Announcement.sender))
        .order_by(Announcement.created_at.desc())
    )
    if target_audience:
        q = q.where(Announcement.target_audience == target_audience)

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar_one()

    offset = (page - 1) * per_page
    items = (await db.execute(q.offset(offset).limit(per_page))).scalars().all()

    return PaginatedAnnouncementResponse(
        total=total,
        page=page,
        per_page=per_page,
        items=[_announcement_response(a) for a in items],
    )


# ---------------------------------------------------------------------------
# GET /messages/recipients — users this caller is allowed to message
# ---------------------------------------------------------------------------

@router.get("/messages/recipients", response_model=list[RecipientResponse])
async def list_recipients(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[RecipientResponse]:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]
    role = current_user.current_role.value  # type: ignore[attr-defined]

    # Determine which roles this user can send messages to
    if role == "teacher":
        target_roles = [MembershipRole.admin, MembershipRole.super_admin]
    elif role == "admin":
        target_roles = [MembershipRole.teacher, MembershipRole.super_admin]
    else:  # super_admin
        target_roles = [MembershipRole.admin, MembershipRole.teacher]

    result = await db.execute(
        select(User, SchoolMembership)
        .join(SchoolMembership, SchoolMembership.user_id == User.id)
        .where(
            SchoolMembership.school_id == school_id,
            SchoolMembership.role.in_(target_roles),
            SchoolMembership.is_active == True,
            User.id != current_user.id,
        )
        .order_by(User.name)
    )
    rows = result.all()
    return [
        RecipientResponse(id=user.id, name=user.name, role=membership.role.value)
        for user, membership in rows
    ]


# ---------------------------------------------------------------------------
# POST /messages
# ---------------------------------------------------------------------------

@router.post("/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    body: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]
    role = current_user.current_role.value  # type: ignore[attr-defined]

    # Verify recipient is a member of the same school
    recipient_membership = await db.execute(
        select(SchoolMembership)
        .where(
            SchoolMembership.user_id == body.recipient_id,
            SchoolMembership.school_id == school_id,
            SchoolMembership.is_active == True,
        )
    )
    membership = recipient_membership.scalar_one_or_none()
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient not found in this school",
        )

    # Teacher can only message admin or super_admin
    if role == "teacher":
        recipient_role = membership.role.value
        if recipient_role not in ("admin", "super_admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Teachers can only message admin staff",
            )

    # Cannot message yourself
    if body.recipient_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot send a message to yourself",
        )

    msg = Message(
        school_id=school_id,
        sender_id=current_user.id,
        recipient_id=body.recipient_id,
        subject=body.subject,
        body=body.body,
        is_read=False,
    )
    db.add(msg)
    await db.flush()

    result = await db.execute(
        select(Message)
        .where(Message.id == msg.id)
        .options(*_MSG_OPTIONS)
    )
    msg = result.scalar_one()
    await db.commit()
    return _message_response(msg)


# ---------------------------------------------------------------------------
# GET /messages/unread-count  (fixed path before parameterised routes)
# ---------------------------------------------------------------------------

@router.get("/messages/unread-count", response_model=UnreadCountResponse)
async def unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UnreadCountResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]

    row = await db.execute(
        select(func.count(Message.id)).where(
            Message.school_id == school_id,
            Message.recipient_id == current_user.id,
            Message.is_read == False,
        )
    )
    return UnreadCountResponse(count=row.scalar_one())


# ---------------------------------------------------------------------------
# GET /messages/inbox  (fixed path before parameterised routes)
# ---------------------------------------------------------------------------

@router.get("/messages/inbox", response_model=InboxResponse)
async def inbox(
    is_read: Optional[bool] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> InboxResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]

    q = (
        select(Message)
        .where(
            Message.school_id == school_id,
            Message.recipient_id == current_user.id,
        )
        .options(*_MSG_OPTIONS)
        .order_by(Message.created_at.desc())
    )
    if is_read is not None:
        q = q.where(Message.is_read == is_read)

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar_one()

    unread_row = await db.execute(
        select(func.count(Message.id)).where(
            Message.school_id == school_id,
            Message.recipient_id == current_user.id,
            Message.is_read == False,
        )
    )
    unread_count_val: int = unread_row.scalar_one()

    offset = (page - 1) * per_page
    items = (await db.execute(q.offset(offset).limit(per_page))).scalars().all()

    return InboxResponse(
        total=total,
        page=page,
        per_page=per_page,
        items=[_message_response(m) for m in items],
        unread_count=unread_count_val,
    )


# ---------------------------------------------------------------------------
# GET /messages/sent  (fixed path before parameterised routes)
# ---------------------------------------------------------------------------

@router.get("/messages/sent", response_model=PaginatedMessageResponse)
async def sent_messages(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedMessageResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]

    q = (
        select(Message)
        .where(
            Message.school_id == school_id,
            Message.sender_id == current_user.id,
        )
        .options(*_MSG_OPTIONS)
        .order_by(Message.created_at.desc())
    )

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar_one()

    offset = (page - 1) * per_page
    items = (await db.execute(q.offset(offset).limit(per_page))).scalars().all()

    return PaginatedMessageResponse(
        total=total, page=page, per_page=per_page,
        items=[_message_response(m) for m in items],
    )


# ---------------------------------------------------------------------------
# PATCH /messages/{message_id}/read
# ---------------------------------------------------------------------------

@router.patch("/messages/{message_id}/read", response_model=MessageResponse)
async def mark_read(
    message_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]

    result = await db.execute(
        select(Message)
        .where(
            Message.id == message_id,
            Message.school_id == school_id,
        )
        .options(*_MSG_OPTIONS)
    )
    msg = result.scalar_one_or_none()
    if msg is None:
        raise HTTPException(status_code=404, detail="Message not found")

    if msg.recipient_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only mark your own messages as read",
        )

    msg.is_read = True
    await db.commit()
    await db.refresh(msg)

    result = await db.execute(
        select(Message).where(Message.id == message_id).options(*_MSG_OPTIONS)
    )
    msg = result.scalar_one()
    return _message_response(msg)
