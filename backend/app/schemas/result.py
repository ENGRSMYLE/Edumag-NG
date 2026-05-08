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
# Score entry (request)
# ---------------------------------------------------------------------------

class ScoreEntry(BaseModel):
    student_id: uuid.UUID
    ca_score: float = Field(..., ge=0, le=40)
    exam_score: float = Field(..., ge=0, le=60)


class BulkScoreEntry(BaseModel):
    class_id: uuid.UUID
    academic_session: str = Field(..., min_length=1, max_length=20)
    term: TermEnum
    subject: str = Field(..., min_length=1, max_length=100)
    entries: list[ScoreEntry] = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# Response
# ---------------------------------------------------------------------------

class ResultResponse(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    subject: str
    academic_session: str
    term: TermEnum
    ca_score: Optional[float]
    exam_score: Optional[float]
    total_score: Optional[float]
    grade: Optional[str]
    remark: Optional[str]
    teacher_comment: Optional[str]
    is_approved: bool
    entered_by_name: str

    model_config = {"from_attributes": True}


class ResultSummary(BaseModel):
    student_id: uuid.UUID
    student_name: str
    admission_number: str
    class_name: str
    academic_session: str
    term: TermEnum
    subjects: list[ResultResponse]
    total_score: float
    average: float
    position: Optional[int]
    teacher_comment: Optional[str]
    principal_comment: Optional[str]


# ---------------------------------------------------------------------------
# Approve / comment
# ---------------------------------------------------------------------------

class ApproveResultsRequest(BaseModel):
    class_id: uuid.UUID
    academic_session: str = Field(..., min_length=1, max_length=20)
    term: TermEnum


class AddCommentRequest(BaseModel):
    teacher_comment: str = Field(..., min_length=1, max_length=500)


# ---------------------------------------------------------------------------
# Approve response
# ---------------------------------------------------------------------------

class ApproveResultsResponse(BaseModel):
    approved_count: int


class BulkScoreResponse(BaseModel):
    updated_count: int
    subject: str
