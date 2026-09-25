import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.guardian import PreferredContactChannel
from app.models.parent import ParentRelationship


class GuardianSearchItem(BaseModel):
    guardian_profile_id: uuid.UUID
    user_id: uuid.UUID
    name: str
    email: str
    phone: str | None
    phone_verified: bool
    status: str


class GuardianInviteRequest(BaseModel):
    student_id: uuid.UUID
    guardian_profile_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=30)
    relationship_type: ParentRelationship
    address: str | None = Field(default=None, max_length=500)
    occupation: str | None = Field(default=None, max_length=255)
    preferred_contact_channel: PreferredContactChannel = PreferredContactChannel.email
    is_primary: bool = False
    is_emergency_contact: bool = False
    can_receive_messages: bool = True
    can_view_attendance: bool = True
    can_view_results: bool = True
    can_view_assignments: bool = True
    can_view_finance: bool = False
    can_pick_up: bool = False

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        return " ".join(value.split())


class GuardianInviteResponse(BaseModel):
    guardian_profile_id: uuid.UUID
    membership_id: uuid.UUID
    user_id: uuid.UUID
    student_guardian_id: uuid.UUID
    invitation_created: bool
    invitation_expires_at: datetime | None


class GuardianSearchResponse(BaseModel):
    items: list[GuardianSearchItem]
