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
    recipient_id: uuid.UUID
    subject: Optional[str] = Field(None, max_length=255)
    body: str = Field(..., min_length=1)


class MessageResponse(BaseModel):
    id: uuid.UUID
    sender_id: uuid.UUID
    sender_name: str
    recipient_id: uuid.UUID
    recipient_name: str
    subject: Optional[str]
    body: str
    is_read: bool
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
