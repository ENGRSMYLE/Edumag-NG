import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class UserResponse(BaseModel):
    membership_id: uuid.UUID
    user_id: uuid.UUID
    name: str
    email: str
    phone: str | None
    role: str
    is_active: bool
    is_first_login: bool
    profile_photo_url: str | None
    class_id: uuid.UUID | None
    created_at: datetime
    last_login_at: datetime | None
    invite_token: Optional[str] = None

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    membership_id: uuid.UUID
    user_id: uuid.UUID
    name: str
    email: str
    role: str
    is_active: bool
    class_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedUsersResponse(BaseModel):
    items: list[UserListResponse]
    total: int
    page: int
    per_page: int
    total_pages: int


class DeactivateUserRequest(BaseModel):
    reason: str | None = None


class UpdateUserRequest(BaseModel):
    name: str | None = None
    phone: str | None = None
