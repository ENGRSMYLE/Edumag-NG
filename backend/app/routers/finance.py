"""
Finance router — payments, debtors, financial reports, Paystack integration.
"""
from __future__ import annotations

import csv
import io
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.rbac import require_permission
from app.models.finance import Payment, PaymentStatus
from app.models.student import Student
from app.models.user import User
from app.schemas.finance import (
    ConfirmPaymentRequest,
    DebtorResponse,
    FinancialSummary,
    InitializePaystackRequest,
    InitializePaystackResponse,
    PaginatedDebtorResponse,
    PaginatedPaymentResponse,
    PaymentResponse,
    PaystackWebhookPayload,
    RecordPaymentRequest,
    UpdatePaymentRequest,
)
from app.services.finance_service import (
    generate_payment_reference,
    get_confirmed_paid_kobo,
    verify_paystack_signature,
)
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/finance", tags=["finance"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_DEFAULT_FEE_KOBO = 50_000_00  # ₦50,000 in kobo — used when school has no fee config


def _payment_response(p: Payment) -> PaymentResponse:
    student_name = f"{p.student.first_name} {p.student.last_name}"
    admission_number = p.student.admission_number
    class_name: Optional[str] = None
    if p.student.current_class:
        class_name = p.student.current_class.name

    confirmed_by_name: Optional[str] = None
    if p.confirmer:
        confirmed_by_name = p.confirmer.name  # type: ignore[attr-defined]

    return PaymentResponse(
        id=p.id,
        student_id=p.student_id,
        student_name=student_name,
        admission_number=admission_number,
        class_name=class_name,
        amount_kobo=p.amount_kobo,
        amount_naira=p.amount_kobo / 100,
        payment_type=p.payment_type,  # type: ignore[arg-type]
        payment_method=p.payment_method,  # type: ignore[arg-type]
        academic_session=p.academic_session,
        term=p.term,  # type: ignore[arg-type]
        status=p.status,  # type: ignore[arg-type]
        reference=p.reference,
        confirmed_by_name=confirmed_by_name,
        recorded_by_name=p.recorder.name,  # type: ignore[attr-defined]
        paid_at=p.paid_at,
        created_at=p.created_at,
    )


async def _get_payment_or_404(
    db: AsyncSession, payment_id: uuid.UUID, school_id: uuid.UUID
) -> Payment:
    result = await db.execute(
        select(Payment)
        .where(Payment.id == payment_id, Payment.school_id == school_id)
        .options(
            selectinload(Payment.student).selectinload(Student.current_class),
            selectinload(Payment.confirmer),
            selectinload(Payment.recorder),
        )
    )
    p = result.scalar_one_or_none()
    if p is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    return p


# ---------------------------------------------------------------------------
# POST /payments — record a new payment
# ---------------------------------------------------------------------------

@router.post("/payments", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def record_payment(
    body: RecordPaymentRequest,
    current_user: User = Depends(require_permission("record_payment")),
    db: AsyncSession = Depends(get_db),
) -> PaymentResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]

    # Verify student belongs to this school
    stu_result = await db.execute(
        select(Student)
        .where(Student.id == body.student_id, Student.school_id == school_id)
        .options(selectinload(Student.current_class))
    )
    student = stu_result.scalar_one_or_none()
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")

    reference = await generate_payment_reference(db, school_id)

    payment = Payment(
        school_id=school_id,
        student_id=body.student_id,
        amount_kobo=body.amount_kobo,
        payment_type=body.payment_type,
        payment_method=body.payment_method,
        academic_session=body.academic_session,
        term=body.term,
        status=PaymentStatus.pending,
        reference=reference,
        recorded_by=current_user.id,
        notes=body.notes,
    )
    db.add(payment)
    await db.flush()
    await db.refresh(payment)

    # Load relationships for response
    p = await _get_payment_or_404(db, payment.id, school_id)
    await db.commit()
    return _payment_response(p)


# ---------------------------------------------------------------------------
# POST /payments/{payment_id}/confirm
# ---------------------------------------------------------------------------

@router.post("/payments/{payment_id}/confirm", response_model=PaymentResponse)
async def confirm_payment(
    payment_id: uuid.UUID,
    body: ConfirmPaymentRequest,
    current_user: User = Depends(require_permission("confirm_bank_transfer")),
    db: AsyncSession = Depends(get_db),
) -> PaymentResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]

    p = await _get_payment_or_404(db, payment_id, school_id)

    if p.status != PaymentStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot confirm a payment with status '{p.status.value}'",
        )

    p.status = PaymentStatus.confirmed
    p.confirmed_by = current_user.id
    p.paid_at = datetime.now(timezone.utc)
    if body.notes:
        p.notes = body.notes

    await db.commit()
    await db.refresh(p)

    # Reload with relationships
    p = await _get_payment_or_404(db, payment_id, school_id)
    return _payment_response(p)


# ---------------------------------------------------------------------------
# GET /payments
# ---------------------------------------------------------------------------

@router.get("/payments", response_model=PaginatedPaymentResponse)
async def list_payments(
    student_id: Optional[uuid.UUID] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    payment_type: Optional[str] = None,
    payment_method: Optional[str] = None,
    academic_session: Optional[str] = None,
    term: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_permission("view_payment_status")),
    db: AsyncSession = Depends(get_db),
) -> PaginatedPaymentResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]

    q = (
        select(Payment)
        .where(Payment.school_id == school_id)
        .options(
            selectinload(Payment.student).selectinload(Student.current_class),
            selectinload(Payment.confirmer),
            selectinload(Payment.recorder),
        )
        .order_by(Payment.created_at.desc())
    )

    if student_id:
        q = q.where(Payment.student_id == student_id)
    if status_filter:
        q = q.where(Payment.status == status_filter)
    if payment_type:
        q = q.where(Payment.payment_type == payment_type)
    if payment_method:
        q = q.where(Payment.payment_method == payment_method)
    if academic_session:
        q = q.where(Payment.academic_session == academic_session)
    if term:
        q = q.where(Payment.term == term)

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar_one()

    offset = (page - 1) * per_page
    rows = (await db.execute(q.offset(offset).limit(per_page))).scalars().all()

    return PaginatedPaymentResponse(
        total=total,
        page=page,
        per_page=per_page,
        items=[_payment_response(p) for p in rows],
    )


# ---------------------------------------------------------------------------
# GET /payments/{payment_id}
# ---------------------------------------------------------------------------

@router.get("/payments/{payment_id}", response_model=PaymentResponse)
async def get_payment(
    payment_id: uuid.UUID,
    current_user: User = Depends(require_permission("view_payment_status")),
    db: AsyncSession = Depends(get_db),
) -> PaymentResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]
    p = await _get_payment_or_404(db, payment_id, school_id)
    return _payment_response(p)


# ---------------------------------------------------------------------------
# PATCH /payments/{payment_id}
# ---------------------------------------------------------------------------

@router.patch("/payments/{payment_id}", response_model=PaymentResponse)
async def update_payment(
    payment_id: uuid.UUID,
    body: UpdatePaymentRequest,
    current_user: User = Depends(require_permission("edit_payment_records")),
    db: AsyncSession = Depends(get_db),
) -> PaymentResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]

    p = await _get_payment_or_404(db, payment_id, school_id)

    if p.status != PaymentStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only pending payments can be edited",
        )

    if body.amount_kobo is not None:
        p.amount_kobo = body.amount_kobo
    if body.payment_type is not None:
        p.payment_type = body.payment_type
    if body.notes is not None:
        p.notes = body.notes

    await db.commit()
    p = await _get_payment_or_404(db, payment_id, school_id)
    return _payment_response(p)


# ---------------------------------------------------------------------------
# GET /summary
# ---------------------------------------------------------------------------

@router.get("/summary", response_model=FinancialSummary)
async def financial_summary(
    academic_session: str = Query(...),
    term: str = Query(...),
    current_user: User = Depends(require_permission("generate_financial_reports")),
    db: AsyncSession = Depends(get_db),
) -> FinancialSummary:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]

    base_filter = [
        Payment.school_id == school_id,
        Payment.academic_session == academic_session,
        Payment.term == term,
    ]

    row = await db.execute(
        select(
            func.coalesce(
                func.sum(Payment.amount_kobo).filter(Payment.status == PaymentStatus.confirmed), 0
            ).label("total_collected"),
            func.count(Payment.id).filter(Payment.status == PaymentStatus.confirmed).label("confirmed_count"),
            func.count(Payment.id).filter(Payment.status == PaymentStatus.pending).label("pending_count"),
        ).where(*base_filter)
    )
    agg = row.one()

    total_collected: int = int(agg.total_collected)
    confirmed_count: int = int(agg.confirmed_count)
    pending_count: int = int(agg.pending_count)

    # Count distinct debtors: students with confirmed payments < expected fee
    debtor_subq = (
        select(Payment.student_id)
        .where(
            Payment.school_id == school_id,
            Payment.academic_session == academic_session,
            Payment.term == term,
            Payment.status == PaymentStatus.confirmed,
        )
        .group_by(Payment.student_id)
        .having(func.sum(Payment.amount_kobo) < _DEFAULT_FEE_KOBO)
        .subquery()
    )
    debtors_count_row = await db.execute(select(func.count()).select_from(debtor_subq))
    debtors_count: int = int(debtors_count_row.scalar_one())

    total_students_row = await db.execute(
        select(func.count(Student.id)).where(
            Student.school_id == school_id, Student.is_active == True
        )
    )
    total_students: int = int(total_students_row.scalar_one())
    expected_total = total_students * _DEFAULT_FEE_KOBO

    collection_rate = (total_collected / expected_total * 100) if expected_total > 0 else 0.0
    outstanding = max(0, expected_total - total_collected)

    return FinancialSummary(
        total_collected_kobo=total_collected,
        total_outstanding_kobo=outstanding,
        confirmed_payments_count=confirmed_count,
        pending_payments_count=pending_count,
        debtors_count=debtors_count,
        collection_rate=round(collection_rate, 2),
    )


# ---------------------------------------------------------------------------
# GET /debtors
# ---------------------------------------------------------------------------

@router.get("/debtors", response_model=PaginatedDebtorResponse)
async def list_debtors(
    academic_session: str = Query(...),
    term: str = Query(...),
    class_id: Optional[uuid.UUID] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_permission("track_debtors")),
    db: AsyncSession = Depends(get_db),
) -> PaginatedDebtorResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]

    # Subquery: confirmed paid per student
    paid_subq = (
        select(
            Payment.student_id.label("student_id"),
            func.coalesce(func.sum(Payment.amount_kobo), 0).label("paid_kobo"),
            func.max(Payment.paid_at).label("last_paid"),
        )
        .where(
            Payment.school_id == school_id,
            Payment.academic_session == academic_session,
            Payment.term == term,
            Payment.status == PaymentStatus.confirmed,
        )
        .group_by(Payment.student_id)
        .subquery()
    )

    # Students whose paid < expected fee
    student_q = (
        select(Student)
        .outerjoin(paid_subq, paid_subq.c.student_id == Student.id)
        .where(
            Student.school_id == school_id,
            Student.is_active == True,
            func.coalesce(paid_subq.c.paid_kobo, 0) < _DEFAULT_FEE_KOBO,
        )
        .options(selectinload(Student.current_class))
    )

    if class_id:
        student_q = student_q.where(Student.class_id == class_id)

    count_q = select(func.count()).select_from(student_q.subquery())
    total = (await db.execute(count_q)).scalar_one()

    offset = (page - 1) * per_page
    rows = (await db.execute(student_q.offset(offset).limit(per_page))).scalars().all()

    items: list[DebtorResponse] = []
    for s in rows:
        paid_kobo, last_paid = await get_confirmed_paid_kobo(
            db, school_id, s.id, academic_session, term
        )
        class_name = s.current_class.name if s.current_class else None
        items.append(
            DebtorResponse(
                student_id=s.id,
                student_name=f"{s.first_name} {s.last_name}",
                admission_number=s.admission_number,
                class_name=class_name,
                expected_amount_kobo=_DEFAULT_FEE_KOBO,
                paid_amount_kobo=paid_kobo,
                balance_kobo=_DEFAULT_FEE_KOBO - paid_kobo,
                last_payment_date=last_paid,
            )
        )

    return PaginatedDebtorResponse(total=total, page=page, per_page=per_page, items=items)


# ---------------------------------------------------------------------------
# GET /export
# ---------------------------------------------------------------------------

@router.get("/export")
async def export_payments(
    academic_session: str = Query(...),
    term: str = Query(...),
    format: str = Query("csv"),
    current_user: User = Depends(require_permission("generate_financial_reports")),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]

    if format != "csv":
        raise HTTPException(status_code=400, detail="Only 'csv' format is supported")

    rows = (
        await db.execute(
            select(Payment)
            .where(
                Payment.school_id == school_id,
                Payment.academic_session == academic_session,
                Payment.term == term,
            )
            .options(
                selectinload(Payment.student).selectinload(Student.current_class),
                selectinload(Payment.confirmer),
                selectinload(Payment.recorder),
            )
            .order_by(Payment.created_at.desc())
        )
    ).scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Reference", "Student Name", "Admission Number", "Class",
        "Amount (₦)", "Payment Type", "Payment Method",
        "Status", "Recorded By", "Confirmed By", "Paid At", "Created At",
    ])
    for p in rows:
        class_name = p.student.current_class.name if p.student.current_class else ""
        confirmed_name = p.confirmer.name if p.confirmer else ""  # type: ignore[attr-defined]
        writer.writerow([
            p.reference,
            f"{p.student.first_name} {p.student.last_name}",
            p.student.admission_number,
            class_name,
            p.amount_kobo / 100,
            p.payment_type.value,
            p.payment_method.value,
            p.status.value,
            p.recorder.name,  # type: ignore[attr-defined]
            confirmed_name,
            p.paid_at.isoformat() if p.paid_at else "",
            p.created_at.isoformat(),
        ])

    output.seek(0)
    filename = f"payments_{academic_session}_{term}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# POST /paystack/webhook — NO AUTH
# ---------------------------------------------------------------------------

@router.post("/paystack/webhook", status_code=status.HTTP_200_OK)
async def paystack_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    raw_body = await request.body()
    signature = request.headers.get("x-paystack-signature", "")

    if not verify_paystack_signature(raw_body, signature, settings.PAYSTACK_SECRET_KEY):
        logger.warning("Invalid Paystack webhook signature from %s", request.client)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")

    try:
        payload = PaystackWebhookPayload.model_validate_json(raw_body)
    except Exception:
        logger.error("Failed to parse Paystack webhook payload")
        return {"status": "ok"}

    event = payload.event
    data = payload.data
    paystack_ref = data.get("reference")

    if event == "charge.success" and paystack_ref:
        result = await db.execute(
            select(Payment).where(Payment.paystack_reference == paystack_ref)
        )
        payment = result.scalar_one_or_none()
        if payment and payment.status == PaymentStatus.pending:
            payment.status = PaymentStatus.confirmed
            payment.paid_at = datetime.now(timezone.utc)
            await db.commit()
            logger.info("Payment %s confirmed via Paystack webhook", payment.reference)

    elif event == "charge.failed" and paystack_ref:
        result = await db.execute(
            select(Payment).where(Payment.paystack_reference == paystack_ref)
        )
        payment = result.scalar_one_or_none()
        if payment and payment.status == PaymentStatus.pending:
            payment.status = PaymentStatus.failed
            await db.commit()
            logger.info("Payment %s marked failed via Paystack webhook", payment.reference)

    else:
        logger.info("Paystack event '%s' ignored", event)

    return {"status": "ok"}


# ---------------------------------------------------------------------------
# POST /paystack/initialize
# ---------------------------------------------------------------------------

@router.post("/paystack/initialize", response_model=InitializePaystackResponse, status_code=status.HTTP_201_CREATED)
async def initialize_paystack(
    body: InitializePaystackRequest,
    current_user: User = Depends(require_permission("record_payment")),
    db: AsyncSession = Depends(get_db),
) -> InitializePaystackResponse:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]

    # Verify student belongs to this school
    stu_result = await db.execute(
        select(Student)
        .where(Student.id == body.student_id, Student.school_id == school_id)
        .options(selectinload(Student.current_class))
    )
    student = stu_result.scalar_one_or_none()
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")

    reference = await generate_payment_reference(db, school_id)

    payment = Payment(
        school_id=school_id,
        student_id=body.student_id,
        amount_kobo=body.amount_kobo,
        payment_type=body.payment_type,
        payment_method="paystack",
        academic_session=body.academic_session,
        term=body.term,
        status=PaymentStatus.pending,
        reference=reference,
        paystack_reference=reference,
        recorded_by=current_user.id,
    )
    db.add(payment)
    await db.flush()

    # Fetch student email via parent or use a placeholder
    student_email = f"{student.admission_number}@edumag.ng"

    async with httpx.AsyncClient() as http:
        resp = await http.post(
            "https://api.paystack.co/transaction/initialize",
            json={
                "email": student_email,
                "amount": body.amount_kobo,
                "reference": reference,
                "metadata": {
                    "student_id": str(body.student_id),
                    "school_id": str(school_id),
                    "payment_type": body.payment_type,
                    "academic_session": body.academic_session,
                    "term": body.term,
                },
            },
            headers={
                "Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}",
                "Content-Type": "application/json",
            },
            timeout=15.0,
        )

    if resp.status_code != 200:
        logger.error("Paystack initialize failed: %s", resp.text)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to initialize Paystack transaction",
        )

    data = resp.json()["data"]
    payment.paystack_reference = data["reference"]
    await db.commit()

    return InitializePaystackResponse(
        authorization_url=data["authorization_url"],
        reference=data["reference"],
        payment_id=payment.id,
    )
