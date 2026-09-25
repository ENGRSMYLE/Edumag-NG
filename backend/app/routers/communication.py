"""
Communication router — announcements and internal messages.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.dependencies.rbac import require_permission
from app.models.communication import Announcement, Message, MessageRecipient, TargetAudience
from app.models.school_membership import MembershipRole, SchoolMembership
from app.models.user import User
from app.schemas.communication import (
    AnnouncementCreate,
    AnnouncementResponse,
    InboxResponse,
    MessageResponse,
    MessageRecipientResponse,
    PaginatedAnnouncementResponse,
    PaginatedMessageResponse,
    RecipientResponse,
    PaginatedRecipientResponse,
    SendMessageRequest,
    ThreadResponse,
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


def _message_response(m: Message, viewer_id: uuid.UUID) -> MessageResponse:
    deliveries = list(m.recipients)
    recipients = []
    for delivery in deliveries:
        membership = next((x for x in delivery.user.memberships if x.school_id == m.school_id), None)
        recipients.append(MessageRecipientResponse(
            id=delivery.user_id,
            name=delivery.user.name,
            role=membership.role.value if membership else "unknown",
        ))
    first = recipients[0] if recipients else None
    own_delivery = next((x for x in deliveries if x.user_id == viewer_id), None)
    return MessageResponse(
        id=m.id,
        sender_id=m.sender_id,
        sender_name=m.sender.name,
        recipient_id=first.id if first else m.recipient_id,
        recipient_name=(first.name if len(recipients) == 1 else f"{len(recipients)} recipients") if first else "",
        recipients=recipients,
        subject=m.subject,
        body=m.body,
        is_read=own_delivery.is_read if own_delivery else m.is_read,
        thread_id=m.thread_id,
        created_at=m.created_at,
    )


_MSG_OPTIONS = [
    selectinload(Message.sender),
    selectinload(Message.recipients).selectinload(MessageRecipient.user).selectinload(User.memberships),
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

    # Administrators manage the announcement feed and can review everything
    # they have published. Teachers only receive school-wide or teacher notices.
    role = current_user.current_role.value  # type: ignore[attr-defined]
    if role == MembershipRole.teacher.value:
        q = q.where(
            Announcement.target_audience.in_([
                TargetAudience.all,
                TargetAudience.teacher,
            ])
        )
    elif role == MembershipRole.parent.value:
        # Parents receive school-wide notices only. Role-specific staff notices
        # must never leak through this shared endpoint.
        q = q.where(Announcement.target_audience == TargetAudience.all)

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

@router.get("/messages/recipients", response_model=PaginatedRecipientResponse)
async def list_recipients(
    search: Optional[str] = None,
    role_filter: Optional[MembershipRole] = Query(None, alias="role"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedRecipientResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]
    role = current_user.current_role.value  # type: ignore[attr-defined]

    # Determine which roles this user can send messages to
    if role == "teacher":
        target_roles = [MembershipRole.admin, MembershipRole.super_admin]
    elif role == "admin":
        target_roles = [MembershipRole.teacher, MembershipRole.admin, MembershipRole.super_admin]
    else:  # super_admin
        target_roles = [MembershipRole.super_admin, MembershipRole.admin, MembershipRole.teacher]

    q = (
        select(User, SchoolMembership)
        .join(SchoolMembership, SchoolMembership.user_id == User.id)
        .where(
            SchoolMembership.school_id == school_id,
            SchoolMembership.role.in_(target_roles),
            SchoolMembership.is_active == True,
            User.id != current_user.id,
        )
    )
    if role_filter:
        if role_filter not in target_roles:
            raise HTTPException(status_code=403, detail="You cannot message this role")
        q = q.where(SchoolMembership.role == role_filter)
    if search:
        q = q.where(or_(User.name.ilike(f"%{search}%"), User.email.ilike(f"%{search}%")))
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    rows = (await db.execute(q.order_by(User.name).offset((page - 1) * per_page).limit(per_page))).all()
    return PaginatedRecipientResponse(total=total, page=page, per_page=per_page, items=[
        RecipientResponse(id=user.id, name=user.name, role=membership.role.value) for user, membership in rows
    ])


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

    requested_ids = set(body.recipient_ids)
    if body.recipient_id:
        requested_ids.add(body.recipient_id)
    if body.recipient_group:
        if role == "teacher":
            raise HTTPException(status_code=403, detail="Teachers cannot send broadcasts")
        group_roles = {
            "all_teachers": [MembershipRole.teacher],
            "all_admins": [MembershipRole.admin, MembershipRole.super_admin],
        }[body.recipient_group]
        group_rows = await db.execute(select(SchoolMembership.user_id).where(
            SchoolMembership.school_id == school_id,
            SchoolMembership.role.in_(group_roles),
            SchoolMembership.is_active == True,
            SchoolMembership.user_id != current_user.id,
        ))
        requested_ids.update(group_rows.scalars().all())
    requested_ids.discard(current_user.id)
    if not requested_ids:
        raise HTTPException(status_code=422, detail="Select at least one recipient")

    membership_rows = (await db.execute(select(SchoolMembership).where(
        SchoolMembership.user_id.in_(requested_ids),
        SchoolMembership.school_id == school_id,
        SchoolMembership.is_active == True,
    ))).scalars().all()
    if len(membership_rows) != len(requested_ids):
        raise HTTPException(status_code=404, detail="One or more recipients were not found in this school")
    if role == "teacher" and any(m.role not in (MembershipRole.admin, MembershipRole.super_admin) for m in membership_rows):
        raise HTTPException(status_code=403, detail="Teachers can only message admin staff")

    thread_id = body.thread_id or uuid.uuid4()
    if body.thread_id:
        access = await db.execute(select(Message.id).outerjoin(MessageRecipient).where(
            Message.thread_id == body.thread_id,
            Message.school_id == school_id,
            or_(Message.sender_id == current_user.id, MessageRecipient.user_id == current_user.id),
        ).limit(1))
        if access.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Conversation not found")

    msg = Message(
        school_id=school_id,
        sender_id=current_user.id,
        recipient_id=next(iter(requested_ids)) if len(requested_ids) == 1 else None,
        subject=body.subject,
        body=body.body,
        is_read=False,
        thread_id=thread_id,
        parent_message_id=body.parent_message_id,
    )
    db.add(msg)
    await db.flush()
    db.add_all([MessageRecipient(message_id=msg.id, user_id=user_id) for user_id in requested_ids])
    await db.flush()

    result = await db.execute(
        select(Message)
        .where(Message.id == msg.id)
        .options(*_MSG_OPTIONS)
    )
    msg = result.scalar_one()
    await db.commit()
    return _message_response(msg, current_user.id)


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
        select(func.count(MessageRecipient.id)).join(Message).where(
            Message.school_id == school_id,
            MessageRecipient.user_id == current_user.id,
            MessageRecipient.is_deleted == False,
            MessageRecipient.is_read == False,
        )
    )
    return UnreadCountResponse(count=row.scalar_one())


# ---------------------------------------------------------------------------
# GET /messages/inbox  (fixed path before parameterised routes)
# ---------------------------------------------------------------------------

@router.get("/messages/inbox", response_model=InboxResponse)
async def inbox(
    is_read: Optional[bool] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> InboxResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]

    q = (
        select(Message)
        .join(MessageRecipient)
        .where(
            Message.school_id == school_id,
            MessageRecipient.user_id == current_user.id,
            MessageRecipient.is_deleted == False,
        )
        .options(*_MSG_OPTIONS)
        .order_by(Message.created_at.desc())
    )
    if is_read is not None:
        q = q.where(MessageRecipient.is_read == is_read)
    if search:
        q = q.join(Message.sender).where(or_(
            Message.subject.ilike(f"%{search}%"),
            Message.body.ilike(f"%{search}%"),
            User.name.ilike(f"%{search}%"),
        ))

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar_one()

    unread_row = await db.execute(
        select(func.count(MessageRecipient.id)).join(Message).where(
            Message.school_id == school_id,
            MessageRecipient.user_id == current_user.id,
            MessageRecipient.is_deleted == False,
            MessageRecipient.is_read == False,
        )
    )
    unread_count_val: int = unread_row.scalar_one()

    offset = (page - 1) * per_page
    items = (await db.execute(q.offset(offset).limit(per_page))).scalars().all()

    return InboxResponse(
        total=total,
        page=page,
        per_page=per_page,
        items=[_message_response(m, current_user.id) for m in items],
        unread_count=unread_count_val,
    )


# ---------------------------------------------------------------------------
# GET /messages/sent  (fixed path before parameterised routes)
# ---------------------------------------------------------------------------

@router.get("/messages/sent", response_model=PaginatedMessageResponse)
async def sent_messages(
    search: Optional[str] = None,
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
    if search:
        q = q.where(or_(Message.subject.ilike(f"%{search}%"), Message.body.ilike(f"%{search}%")))

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar_one()

    offset = (page - 1) * per_page
    items = (await db.execute(q.offset(offset).limit(per_page))).scalars().all()

    return PaginatedMessageResponse(
        total=total, page=page, per_page=per_page,
        items=[_message_response(m, current_user.id) for m in items],
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
        select(MessageRecipient)
        .join(Message)
        .where(
            Message.id == message_id,
            Message.school_id == school_id,
            MessageRecipient.user_id == current_user.id,
        )
    )
    delivery = result.scalar_one_or_none()
    if delivery is None:
        raise HTTPException(status_code=404, detail="Message not found")
    delivery.is_read = True
    delivery.read_at = datetime.now(timezone.utc)
    await db.commit()

    result = await db.execute(
        select(Message).where(Message.id == message_id).options(*_MSG_OPTIONS)
    )
    msg = result.scalar_one()
    return _message_response(msg, current_user.id)


@router.get("/messages/{message_id}", response_model=ThreadResponse)
async def get_conversation(
    message_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ThreadResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]
    seed = (await db.execute(select(Message).outerjoin(MessageRecipient).where(
        Message.id == message_id,
        Message.school_id == school_id,
        or_(Message.sender_id == current_user.id, MessageRecipient.user_id == current_user.id),
    ).distinct())).scalar_one_or_none()
    if seed is None:
        raise HTTPException(status_code=404, detail="Message not found")
    q = select(Message).outerjoin(MessageRecipient).where(
        Message.thread_id == seed.thread_id,
        Message.school_id == school_id,
        or_(Message.sender_id == current_user.id, MessageRecipient.user_id == current_user.id),
    ).options(*_MSG_OPTIONS).distinct().order_by(Message.created_at)
    items = (await db.execute(q)).scalars().all()
    return ThreadResponse(thread_id=seed.thread_id, items=[_message_response(item, current_user.id) for item in items])
