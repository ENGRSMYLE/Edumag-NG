import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class TermEnum(str, Enum):
    first = "first"
    second = "second"
    third = "third"


# ---------------------------------------------------------------------------
# Create / Update
# ---------------------------------------------------------------------------

class ClassCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    level: str = Field(..., min_length=1, max_length=50)
    arm: Optional[str] = Field(None, max_length=10)
    teacher_id: Optional[uuid.UUID] = None
    capacity: int = Field(40, ge=1, le=500)
    academic_session: str = Field(..., min_length=1, max_length=20)
    term: TermEnum


class ClassUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    level: Optional[str] = Field(None, min_length=1, max_length=50)
    arm: Optional[str] = Field(None, max_length=10)
    teacher_id: Optional[uuid.UUID] = None
    capacity: Optional[int] = Field(None, ge=1, le=500)
    academic_session: Optional[str] = Field(None, min_length=1, max_length=20)
    term: Optional[TermEnum] = None
    is_active: Optional[bool] = None


# ---------------------------------------------------------------------------
# Response
# ---------------------------------------------------------------------------

class ClassListItem(BaseModel):
    id: uuid.UUID
    name: str
    level: str
    arm: Optional[str]
    teacher_name: Optional[str]
    student_count: int
    academic_session: str
    term: TermEnum
    is_active: bool

    model_config = {"from_attributes": True}


class ClassResponse(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    name: str
    level: str
    arm: Optional[str]
    teacher_id: Optional[uuid.UUID]
    teacher_name: Optional[str]
    capacity: int
    academic_session: str
    term: TermEnum
    is_active: bool
    student_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaginatedClassResponse(BaseModel):
    items: list[ClassListItem]
    total: int
    page: int
    per_page: int
    total_pages: int


# ---------------------------------------------------------------------------
# Teacher assignment
# ---------------------------------------------------------------------------

class AssignTeacherRequest(BaseModel):
    teacher_id: uuid.UUID
