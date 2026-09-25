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


class StudentGuardianResponse(BaseModel):
    relationship_id: uuid.UUID
    guardian_profile_id: uuid.UUID
    student_id: uuid.UUID
    guardian_name: str
    email: str
    phone: str | None
    relationship_type: ParentRelationship
    is_primary: bool
    is_emergency_contact: bool
    can_receive_messages: bool
    can_view_attendance: bool
    can_view_results: bool
    can_view_assignments: bool
    can_view_finance: bool
    can_pick_up: bool
    is_active: bool
    starts_at: datetime | None
    ends_at: datetime | None


class ParentAccountResponse(BaseModel):
    guardian_id: uuid.UUID
    membership_id: uuid.UUID
    user_id: uuid.UUID
    name: str
    email: str
    phone: str | None
    address: str | None
    occupation: str | None
    preferred_contact_channel: PreferredContactChannel
    status: str
    membership_active: bool
    activation_status: str
    invitation_status: str
    invitation_expires_at: datetime | None
    active_children_count: int
    relationships: list[StudentGuardianResponse] = Field(default_factory=list)


class PaginatedParentAccountsResponse(BaseModel):
    items: list[ParentAccountResponse]
    total: int
    page: int
    per_page: int
    total_pages: int


class ParentAccountUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    address: str | None = Field(default=None, max_length=500)
    occupation: str | None = Field(default=None, max_length=255)
    preferred_contact_channel: PreferredContactChannel | None = None


class StudentGuardianCreate(BaseModel):
    guardian_profile_id: uuid.UUID
    relationship_type: ParentRelationship
    is_primary: bool = False
    is_emergency_contact: bool = False
    can_receive_messages: bool = True
    can_view_attendance: bool = True
    can_view_results: bool = True
    can_view_assignments: bool = True
    can_view_finance: bool = False
    can_pick_up: bool = False
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class StudentGuardianUpdate(BaseModel):
    relationship_type: ParentRelationship | None = None
    is_primary: bool | None = None
    is_emergency_contact: bool | None = None
    can_receive_messages: bool | None = None
    can_view_attendance: bool | None = None
    can_view_results: bool | None = None
    can_view_assignments: bool | None = None
    can_view_finance: bool | None = None
    can_pick_up: bool | None = None
    is_active: bool | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
