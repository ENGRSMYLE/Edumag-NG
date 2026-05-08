import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class RelationshipEnum(str, Enum):
    father = "father"
    mother = "mother"
    guardian = "guardian"
    other = "other"


# ---------------------------------------------------------------------------
# Create / Update
# ---------------------------------------------------------------------------

class ParentCreate(BaseModel):
    student_id: uuid.UUID
    name: str = Field(..., min_length=1, max_length=255)
    relationship: RelationshipEnum
    phone: str = Field(..., min_length=1, max_length=20)
    email: Optional[str] = Field(None, max_length=255)
    address: Optional[str] = Field(None, max_length=500)
    occupation: Optional[str] = Field(None, max_length=255)
    is_primary: bool = False


class ParentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    relationship: Optional[RelationshipEnum] = None
    phone: Optional[str] = Field(None, min_length=1, max_length=20)
    email: Optional[str] = Field(None, max_length=255)
    address: Optional[str] = Field(None, max_length=500)
    occupation: Optional[str] = Field(None, max_length=255)
    is_primary: Optional[bool] = None


# ---------------------------------------------------------------------------
# Response
# ---------------------------------------------------------------------------

class ParentListItem(BaseModel):
    id: uuid.UUID
    name: str
    relationship: RelationshipEnum
    phone: str
    email: Optional[str]
    student_name: str
    is_primary: bool

    model_config = {"from_attributes": True}


class ParentResponse(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    name: str
    relationship: RelationshipEnum
    phone: str
    email: Optional[str]
    address: Optional[str]
    occupation: Optional[str]
    is_primary: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaginatedParentResponse(BaseModel):
    items: list[ParentListItem]
    total: int
    page: int
    per_page: int
    total_pages: int
