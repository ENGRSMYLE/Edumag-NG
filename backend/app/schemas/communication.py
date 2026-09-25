import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class TargetAudienceEnum(str, Enum):
    all = "all"
    admin = "admin"
    teacher = "teacher"


# ---------------------------------------------------------------------------
# Announcements
# ---------------------------------------------------------------------------

class AnnouncementCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    body: str = Field(..., min_length=1)
    target_audience: TargetAudienceEnum


class AnnouncementResponse(BaseModel):
    id: uuid.UUID
    title: str
    body: str
    target_audience: TargetAudienceEnum
    sent_by_name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedAnnouncementResponse(BaseModel):
    total: int
    page: int
    per_page: int
    items: list[AnnouncementResponse]


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------

class SendMessageRequest(BaseModel):
    recipient_id: Optional[uuid.UUID] = None
    recipient_ids: list[uuid.UUID] = Field(default_factory=list, max_length=100)
    recipient_group: Optional[str] = Field(None, pattern="^(all_teachers|all_admins)$")
    subject: Optional[str] = Field(None, max_length=255)
    body: str = Field(..., min_length=1)
    thread_id: Optional[uuid.UUID] = None
    parent_message_id: Optional[uuid.UUID] = None


class MessageRecipientResponse(BaseModel):
    id: uuid.UUID
    name: str
    role: str


class MessageResponse(BaseModel):
    id: uuid.UUID
    sender_id: uuid.UUID
    sender_name: str
    recipient_id: Optional[uuid.UUID]
    recipient_name: str
    recipients: list[MessageRecipientResponse]
    subject: Optional[str]
    body: str
    is_read: bool
    thread_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedMessageResponse(BaseModel):
    total: int
    page: int
    per_page: int
    items: list[MessageResponse]


class InboxResponse(BaseModel):
    total: int
    page: int
    per_page: int
    items: list[MessageResponse]
    unread_count: int


class UnreadCountResponse(BaseModel):
    count: int


class RecipientResponse(BaseModel):
    id: uuid.UUID
    name: str
    role: str


class PaginatedRecipientResponse(BaseModel):
    total: int
    page: int
    per_page: int
    items: list[RecipientResponse]


class ThreadResponse(BaseModel):
    thread_id: uuid.UUID
    items: list[MessageResponse]
