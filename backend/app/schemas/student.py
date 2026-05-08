import uuid
from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ActionEnum(str, Enum):
    promote = "promote"
    repeat = "repeat"


# ---------------------------------------------------------------------------
# Create / Update
# ---------------------------------------------------------------------------

class StudentCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    middle_name: Optional[str] = Field(None, max_length=100)
    date_of_birth: date
    gender: str = Field(..., pattern="^(male|female)$")
    address: Optional[str] = Field(None, max_length=500)
    state_of_origin: Optional[str] = Field(None, max_length=100)
    religion: Optional[str] = Field(None, max_length=100)
    blood_group: Optional[str] = Field(None, max_length=10)
    genotype: Optional[str] = Field(None, max_length=10)
    admission_number: Optional[str] = Field(None, max_length=50)
    admission_date: date
    class_id: Optional[uuid.UUID] = None
    photo_url: Optional[str] = Field(None, max_length=500)


class StudentUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    middle_name: Optional[str] = Field(None, max_length=100)
    date_of_birth: Optional[date] = None
    gender: Optional[str] = Field(None, pattern="^(male|female)$")
    address: Optional[str] = Field(None, max_length=500)
    state_of_origin: Optional[str] = Field(None, max_length=100)
    religion: Optional[str] = Field(None, max_length=100)
    blood_group: Optional[str] = Field(None, max_length=10)
    genotype: Optional[str] = Field(None, max_length=10)
    admission_number: Optional[str] = Field(None, max_length=50)
    admission_date: Optional[date] = None
    class_id: Optional[uuid.UUID] = None
    photo_url: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None


# ---------------------------------------------------------------------------
# Response
# ---------------------------------------------------------------------------

class StudentListItem(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    full_name: str
    admission_number: str
    class_name: Optional[str]
    gender: str
    is_active: bool
    admission_date: date
    photo_url: Optional[str]

    model_config = {"from_attributes": True}


class StudentResponse(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    admission_number: str
    first_name: str
    last_name: str
    middle_name: Optional[str]
    full_name: str
    date_of_birth: date
    gender: str
    address: Optional[str]
    state_of_origin: Optional[str]
    religion: Optional[str]
    blood_group: Optional[str]
    genotype: Optional[str]
    class_id: Optional[uuid.UUID]
    class_name: Optional[str]
    is_active: bool
    admission_date: date
    photo_url: Optional[str]
    parent_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaginatedStudentResponse(BaseModel):
    items: list[StudentListItem]
    total: int
    page: int
    per_page: int
    total_pages: int


# ---------------------------------------------------------------------------
# Bulk upload
# ---------------------------------------------------------------------------

class BulkUploadRow(BaseModel):
    first_name: str
    last_name: str
    middle_name: Optional[str] = None
    date_of_birth: date
    gender: str
    address: Optional[str] = None
    state_of_origin: Optional[str] = None
    admission_number: Optional[str] = None
    admission_date: date
    class_id: Optional[uuid.UUID] = None
    photo_url: Optional[str] = None


class BulkUploadErrorRow(BaseModel):
    row: int
    admission_number: str
    reason: str


class BulkUploadResult(BaseModel):
    success_count: int
    error_rows: list[BulkUploadErrorRow]
    created_students: list[StudentListItem]


# ---------------------------------------------------------------------------
# Transfer / Promotion
# ---------------------------------------------------------------------------

class StudentTransfer(BaseModel):
    new_class_id: uuid.UUID
    reason: Optional[str] = None


class StudentPromotion(BaseModel):
    student_ids: list[uuid.UUID] = Field(..., min_length=1)
    action: ActionEnum
    new_class_id: Optional[uuid.UUID] = None
    reason: Optional[str] = None


class AssignClassRequest(BaseModel):
    class_id: uuid.UUID
