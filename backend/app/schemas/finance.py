import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class PaymentTypeEnum(str, Enum):
    school_fees = "school_fees"
    development_levy = "development_levy"
    exam_fees = "exam_fees"
    other = "other"


class PaymentMethodEnum(str, Enum):
    cash = "cash"
    bank_transfer = "bank_transfer"
    paystack = "paystack"
    pos = "pos"


class PaymentStatusEnum(str, Enum):
    pending = "pending"
    confirmed = "confirmed"
    failed = "failed"
    reversed = "reversed"


class TermEnum(str, Enum):
    first = "first"
    second = "second"
    third = "third"


# ---------------------------------------------------------------------------
# Requests
# ---------------------------------------------------------------------------

class RecordPaymentRequest(BaseModel):
    student_id: uuid.UUID
    amount_kobo: int = Field(..., gt=0)
    payment_type: PaymentTypeEnum
    payment_method: PaymentMethodEnum
    academic_session: str = Field(..., min_length=1, max_length=20)
    term: TermEnum
    notes: Optional[str] = Field(None, max_length=500)


class ConfirmPaymentRequest(BaseModel):
    notes: Optional[str] = Field(None, max_length=500)


class UpdatePaymentRequest(BaseModel):
    amount_kobo: Optional[int] = Field(None, gt=0)
    payment_type: Optional[PaymentTypeEnum] = None
    notes: Optional[str] = Field(None, max_length=500)


class InitializePaystackRequest(BaseModel):
    student_id: uuid.UUID
    amount_kobo: int = Field(..., gt=0)
    payment_type: PaymentTypeEnum
    academic_session: str = Field(..., min_length=1, max_length=20)
    term: TermEnum


class PaystackWebhookPayload(BaseModel):
    event: str
    data: dict[str, Any]


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------

class PaymentResponse(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    admission_number: str
    class_name: Optional[str]
    amount_kobo: int
    amount_naira: float
    payment_type: PaymentTypeEnum
    payment_method: PaymentMethodEnum
    academic_session: str
    term: TermEnum
    status: PaymentStatusEnum
    reference: str
    confirmed_by_name: Optional[str]
    recorded_by_name: str
    paid_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedPaymentResponse(BaseModel):
    total: int
    page: int
    per_page: int
    items: list[PaymentResponse]


class DebtorResponse(BaseModel):
    student_id: uuid.UUID
    student_name: str
    admission_number: str
    class_name: Optional[str]
    expected_amount_kobo: int
    paid_amount_kobo: int
    balance_kobo: int
    last_payment_date: Optional[datetime]


class PaginatedDebtorResponse(BaseModel):
    total: int
    page: int
    per_page: int
    items: list[DebtorResponse]


class FinancialSummary(BaseModel):
    total_collected_kobo: int
    total_outstanding_kobo: int
    confirmed_payments_count: int
    pending_payments_count: int
    debtors_count: int
    collection_rate: float


class InitializePaystackResponse(BaseModel):
    authorization_url: str
    reference: str
    payment_id: uuid.UUID
