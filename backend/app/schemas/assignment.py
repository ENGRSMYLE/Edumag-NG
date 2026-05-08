import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Assignment requests
# ---------------------------------------------------------------------------

class AssignmentCreate(BaseModel):
    class_id: uuid.UUID
    title: str = Field(..., min_length=1, max_length=255)
    subject: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    due_date: date
    max_score: float = Field(100.0, gt=0)
    file_url: Optional[str] = Field(None, max_length=500)


class AssignmentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    subject: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    due_date: Optional[date] = None
    max_score: Optional[float] = Field(None, gt=0)
    file_url: Optional[str] = Field(None, max_length=500)


# ---------------------------------------------------------------------------
# Assignment responses
# ---------------------------------------------------------------------------

class AssignmentResponse(BaseModel):
    id: uuid.UUID
    class_id: uuid.UUID
    class_name: str
    teacher_name: str
    title: str
    subject: str
    description: Optional[str]
    due_date: date
    max_score: float
    file_url: Optional[str]
    submission_count: int
    graded_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedAssignmentResponse(BaseModel):
    total: int
    page: int
    per_page: int
    items: list[AssignmentResponse]


# ---------------------------------------------------------------------------
# Submission
# ---------------------------------------------------------------------------

class SubmissionResponse(BaseModel):
    id: uuid.UUID
    assignment_id: uuid.UUID
    assignment_title: str
    student_id: uuid.UUID
    student_name: str
    score: Optional[float]
    feedback: Optional[str]
    file_url: Optional[str]
    submitted_at: datetime
    graded_at: Optional[datetime]
    is_graded: bool

    model_config = {"from_attributes": True}


class GradeSubmissionRequest(BaseModel):
    score: float = Field(..., ge=0)
    feedback: Optional[str] = Field(None, max_length=1000)
