import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.guardian import PreferredContactChannel


class ParentProfileResponse(BaseModel):
    guardian_id: uuid.UUID
    name: str
    email: str
    phone: str | None
    address: str | None
    occupation: str | None
    preferred_contact_channel: PreferredContactChannel


class ParentProfileUpdate(BaseModel):
    address: str | None = Field(default=None, max_length=500)
    occupation: str | None = Field(default=None, max_length=255)
    preferred_contact_channel: PreferredContactChannel | None = None

    model_config = {"extra": "forbid"}


class ParentChildPermissions(BaseModel):
    attendance: bool
    results: bool
    assignments: bool
    finance: bool
    messaging: bool
    pickup: bool


class ParentChildResponse(BaseModel):
    id: uuid.UUID
    admission_number: str
    first_name: str
    middle_name: str | None
    last_name: str
    date_of_birth: date
    gender: str
    photo_url: str | None
    class_id: uuid.UUID | None
    class_name: str | None
    class_level: str | None
    academic_session: str | None
    permissions: ParentChildPermissions


class PaginatedParentChildren(BaseModel):
    items: list[ParentChildResponse]
    total: int
    page: int
    per_page: int
    total_pages: int


class ParentDashboardResponse(BaseModel):
    children: list[ParentChildResponse]
    child_count: int
    attendance_records: int
    present_records: int
    attendance_rate: float
    approved_results: int
    upcoming_assignments: int


class ParentAttendanceItem(BaseModel):
    id: uuid.UUID
    date: date
    status: str
    note: str | None


class ParentResultItem(BaseModel):
    id: uuid.UUID
    subject: str
    academic_session: str
    term: str
    ca_score: float | None
    exam_score: float | None
    total_score: float | None
    grade: str | None
    teacher_comment: str | None


class ParentAssignmentItem(BaseModel):
    id: uuid.UUID
    title: str
    subject: str
    description: str | None
    due_date: date
    max_score: float
    file_url: str | None
    submitted_at: datetime | None
    score: float | None
    feedback: str | None


class ParentFinanceItem(BaseModel):
    id: uuid.UUID
    amount_kobo: int
    payment_type: str
    payment_method: str
    academic_session: str
    term: str
    status: str
    reference: str
    paid_at: datetime | None
    created_at: datetime


class _Page(BaseModel):
    total: int
    page: int
    per_page: int
    total_pages: int


class PaginatedParentAttendance(_Page):
    items: list[ParentAttendanceItem]
    present_count: int
    absent_count: int
    late_count: int
    excused_count: int
    attendance_rate: float


class PaginatedParentResults(_Page):
    items: list[ParentResultItem]


class PaginatedParentAssignments(_Page):
    items: list[ParentAssignmentItem]


class PaginatedParentFinance(_Page):
    items: list[ParentFinanceItem]
