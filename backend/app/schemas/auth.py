import re
import uuid
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, field_validator, model_validator

from app.models.school import SchoolType


_NIGERIAN_PHONE_RE = re.compile(r"^(\+234|234|0)[789][01]\d{8}$")


class SendOTPRequest(BaseModel):
    email: EmailStr
    school_name: str


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str

    @field_validator("otp")
    @classmethod
    def validate_otp_format(cls, v: str) -> str:
        if not re.match(r"^\d{6}$", v):
            raise ValueError("OTP must be exactly 6 digits")
        return v


class VerifyOTPResponse(BaseModel):
    verified: bool
    verification_token: str


class RegisterSchoolRequest(BaseModel):
    school_name: str
    school_type: SchoolType
    address: str
    lga: str
    state: str
    phone: str
    admin_name: str
    email: EmailStr
    password: str
    verification_token: str

    @field_validator("phone")
    @classmethod
    def validate_nigerian_phone(cls, v: str) -> str:
        if not _NIGERIAN_PHONE_RE.match(v):
            raise ValueError(
                "Phone must be a valid Nigerian number "
                "(e.g. 08012345678 or +2348012345678)"
            )
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SchoolOption(BaseModel):
    membership_id: uuid.UUID
    school_id: uuid.UUID
    school_name: str
    school_logo_url: Optional[str] = None
    role: str
    is_first_login: bool

    model_config = {"from_attributes": True}


class LoginStep1Response(BaseModel):
    requires_school_selection: bool = True
    temp_token: str
    schools: list[SchoolOption]
    user_name: str


class SelectSchoolRequest(BaseModel):
    temp_token: str
    membership_id: uuid.UUID


class SwitchSchoolRequest(BaseModel):
    membership_id: uuid.UUID


class UserInToken(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    role: str
    school_id: uuid.UUID
    school_name: str
    membership_id: uuid.UUID
    is_first_login: bool
    profile_photo_url: Optional[str] = None
    current_class_id: Optional[uuid.UUID] = None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserInToken


class InviteUserRequest(BaseModel):
    name: str
    email: EmailStr
    role: Literal["admin", "teacher"]
    class_id: Optional[uuid.UUID] = None

    @model_validator(mode="after")
    def class_id_required_for_teacher(self) -> "InviteUserRequest":
        if self.role == "teacher" and self.class_id is None:
            raise ValueError("class_id is required when role is 'teacher'")
        return self


class SetPasswordRequest(BaseModel):
    invite_token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        return v


class RefreshRequest(BaseModel):
    refresh_token: Optional[str] = None
