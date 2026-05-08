import uuid
from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class AttendanceStatusEnum(str, Enum):
    present = "present"
    absent = "absent"
    late = "late"
    excused = "excused"


# ---------------------------------------------------------------------------
# Mark attendance (request)
# ---------------------------------------------------------------------------

class AttendanceRecord(BaseModel):
    student_id: uuid.UUID
    status: AttendanceStatusEnum
    note: Optional[str] = Field(None, max_length=500)


class MarkAttendanceRequest(BaseModel):
    class_id: uuid.UUID
    date: date
    records: list[AttendanceRecord] = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------

class AttendanceResponse(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    class_id: uuid.UUID
    date: date
    status: AttendanceStatusEnum
    note: Optional[str]
    marked_by_name: str

    model_config = {"from_attributes": True}


class MarkAttendanceResponse(BaseModel):
    marked_count: int
    date: date
    class_name: str
    already_marked: bool


class CheckAttendanceResponse(BaseModel):
    is_marked: bool
    date: date
    marked_at: Optional[datetime]
    marked_by: Optional[str]


# ---------------------------------------------------------------------------
# Summary schemas
# ---------------------------------------------------------------------------

class AttendanceUpdate(BaseModel):
    status: Optional[AttendanceStatusEnum] = None
    note: Optional[str] = Field(None, max_length=500)


class AttendanceSummary(BaseModel):
    date: Optional[date]
    class_id: uuid.UUID
    class_name: str
    total_students: int
    present: int
    absent: int
    late: int
    excused: int
    attendance_rate: float


class SchoolAttendanceSummary(BaseModel):
    date: date
    total_students: int
    present: int
    absent: int
    late: int
    excused: int
    attendance_rate: float
    by_class: list[AttendanceSummary]


class StudentAttendanceSummary(BaseModel):
    student_name: str
    total_days: int
    present: int
    absent: int
    late: int
    excused: int
    attendance_rate: float
