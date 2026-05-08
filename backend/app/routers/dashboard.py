"""
Dashboard router — aggregated stats for the super-admin overview page.
Mounted at /api/dashboard.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.rbac import get_current_user
from app.models.attendance import Attendance, AttendanceStatus
from app.models.communication import Announcement
from app.models.finance import Payment, PaymentStatus
from app.models.school_membership import MembershipRole, SchoolMembership
from app.models.student import Student
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _ordinal_month(dt: date) -> str:
    return dt.strftime("%b")


# ---------------------------------------------------------------------------
# GET /dashboard/overview
# ---------------------------------------------------------------------------

@router.get("/overview")
async def get_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    school_id: uuid.UUID = current_user.current_school_id  # type: ignore[assignment]
    today = date.today()
    this_month_start = today.replace(day=1)
    last_month_start = (this_month_start - timedelta(days=1)).replace(day=1)
    last_month_end   = this_month_start - timedelta(days=1)

    # ── Total students ────────────────────────────────────────────────────────
    total_students = (await db.execute(
        select(func.count(Student.id))
        .where(Student.school_id == school_id, Student.is_active == True)
    )).scalar_one()

    # Students added last month (for change %)
    last_month_students_added = (await db.execute(
        select(func.count(Student.id))
        .where(
            Student.school_id == school_id,
            Student.created_at >= datetime.combine(last_month_start, datetime.min.time()),
            Student.created_at < datetime.combine(this_month_start, datetime.min.time()),
        )
    )).scalar_one()

    this_month_students_added = (await db.execute(
        select(func.count(Student.id))
        .where(
            Student.school_id == school_id,
            Student.created_at >= datetime.combine(this_month_start, datetime.min.time()),
        )
    )).scalar_one()

    students_change_pct = (
        round((this_month_students_added - last_month_students_added) / max(last_month_students_added, 1) * 100, 1)
        if last_month_students_added
        else 0.0
    )

    # ── Total staff ───────────────────────────────────────────────────────────
    total_staff = (await db.execute(
        select(func.count(SchoolMembership.id))
        .where(
            SchoolMembership.school_id == school_id,
            SchoolMembership.is_active == True,
            SchoolMembership.role.in_([MembershipRole.admin, MembershipRole.teacher]),
        )
    )).scalar_one()

    # ── Monthly revenue ───────────────────────────────────────────────────────
    monthly_revenue_kobo = (await db.execute(
        select(func.coalesce(func.sum(Payment.amount_kobo), 0))
        .where(
            Payment.school_id == school_id,
            Payment.status == PaymentStatus.confirmed,
            Payment.paid_at >= datetime.combine(this_month_start, datetime.min.time()),
        )
    )).scalar_one()

    last_month_revenue = (await db.execute(
        select(func.coalesce(func.sum(Payment.amount_kobo), 0))
        .where(
            Payment.school_id == school_id,
            Payment.status == PaymentStatus.confirmed,
            Payment.paid_at >= datetime.combine(last_month_start, datetime.min.time()),
            Payment.paid_at < datetime.combine(this_month_start, datetime.min.time()),
        )
    )).scalar_one()

    revenue_change_pct = (
        round((monthly_revenue_kobo - last_month_revenue) / max(last_month_revenue, 1) * 100, 1)
        if last_month_revenue
        else 0.0
    )

    # ── Today's attendance ────────────────────────────────────────────────────
    today_attendance = (await db.execute(
        select(
            func.count(Attendance.id).label("total"),
            func.sum(
                case((Attendance.status == AttendanceStatus.present, 1), else_=0)
            ).label("present"),
        )
        .where(Attendance.school_id == school_id, Attendance.date == today)
    )).one()

    total_marked   = today_attendance.total or 0
    present_today  = int(today_attendance.present or 0)
    attendance_pct = round(present_today / max(total_marked, 1) * 100, 1) if total_marked else 0.0

    yesterday = today - timedelta(days=1)
    yesterday_att = (await db.execute(
        select(
            func.count(Attendance.id).label("total"),
            func.sum(
                case((Attendance.status == AttendanceStatus.present, 1), else_=0)
            ).label("present"),
        )
        .where(Attendance.school_id == school_id, Attendance.date == yesterday)
    )).one()

    yesterday_total   = yesterday_att.total or 0
    yesterday_present = int(yesterday_att.present or 0)
    yesterday_pct     = round(yesterday_present / max(yesterday_total, 1) * 100, 1) if yesterday_total else 0.0
    attendance_change_pct = round(attendance_pct - yesterday_pct, 1)

    # ── Enrollment data (last 6 months) ───────────────────────────────────────
    enrollment_data = []
    for i in range(5, -1, -1):
        ref = today.replace(day=1) - timedelta(days=i * 28)
        month_start = ref.replace(day=1)
        next_month  = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
        count = (await db.execute(
            select(func.count(Student.id))
            .where(
                Student.school_id == school_id,
                Student.is_active == True,
                Student.created_at < datetime.combine(next_month, datetime.min.time()),
            )
        )).scalar_one()
        enrollment_data.append({"month": _ordinal_month(month_start), "students": count})

    # ── Revenue data (last 6 months) ──────────────────────────────────────────
    revenue_data = []
    for i in range(5, -1, -1):
        ref = today.replace(day=1) - timedelta(days=i * 28)
        month_start = ref.replace(day=1)
        next_month  = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
        total = (await db.execute(
            select(func.coalesce(func.sum(Payment.amount_kobo), 0))
            .where(
                Payment.school_id == school_id,
                Payment.status == PaymentStatus.confirmed,
                Payment.paid_at >= datetime.combine(month_start, datetime.min.time()),
                Payment.paid_at < datetime.combine(next_month, datetime.min.time()),
            )
        )).scalar_one()
        revenue_data.append({"month": _ordinal_month(month_start), "amount_kobo": int(total)})

    # ── Recent activity (last 10 events) ─────────────────────────────────────
    recent_activity: list[dict[str, Any]] = []

    # Recent students added
    recent_students_rows = (await db.execute(
        select(Student)
        .where(Student.school_id == school_id)
        .order_by(Student.created_at.desc())
        .limit(4)
    )).scalars().all()

    for s in recent_students_rows:
        recent_activity.append({
            "id":          str(s.id),
            "type":        "student_added",
            "description": f"{s.first_name} {s.last_name} was enrolled",
            "actor_name":  "Admin",
            "timestamp":   s.created_at.isoformat(),
        })

    # Recent payments confirmed
    recent_payments = (await db.execute(
        select(Payment)
        .where(Payment.school_id == school_id, Payment.status == PaymentStatus.confirmed)
        .order_by(Payment.paid_at.desc())
        .limit(4)
    )).scalars().all()

    for p in recent_payments:
        recent_activity.append({
            "id":          str(p.id),
            "type":        "payment_received",
            "description": f"Payment of ₦{p.amount_kobo / 100:,.2f} received",
            "actor_name":  "Finance",
            "timestamp":   (p.paid_at or p.created_at).isoformat(),
        })

    # Recent staff invited
    recent_staff = (await db.execute(
        select(SchoolMembership)
        .options(selectinload(SchoolMembership.user))
        .where(
            SchoolMembership.school_id == school_id,
            SchoolMembership.role.in_([MembershipRole.admin, MembershipRole.teacher]),
        )
        .order_by(SchoolMembership.created_at.desc())
        .limit(3)
    )).scalars().all()

    for m in recent_staff:
        recent_activity.append({
            "id":          str(m.id),
            "type":        "staff_invited",
            "description": f"{m.user.name} was invited as {m.role.value.replace('_', ' ')}",
            "actor_name":  "Admin",
            "timestamp":   m.created_at.isoformat(),
        })

    # Recent announcements
    recent_announcements = (await db.execute(
        select(Announcement)
        .options(selectinload(Announcement.sender))
        .where(Announcement.school_id == school_id)
        .order_by(Announcement.created_at.desc())
        .limit(3)
    )).scalars().all()

    for a in recent_announcements:
        recent_activity.append({
            "id":          str(a.id),
            "type":        "announcement_posted",
            "description": f'Announcement: "{a.title}"',
            "actor_name":  a.sender.name if a.sender else "Admin",
            "timestamp":   a.created_at.isoformat(),
        })

    # Sort by timestamp desc, take 10
    recent_activity.sort(key=lambda x: x["timestamp"], reverse=True)
    recent_activity = recent_activity[:10]

    return {
        "stats": {
            "total_students":           total_students,
            "total_staff":              total_staff,
            "monthly_revenue_kobo":     int(monthly_revenue_kobo),
            "attendance_today_percent": attendance_pct,
            "students_change_pct":      students_change_pct,
            "staff_change_pct":         0.0,
            "revenue_change_pct":       revenue_change_pct,
            "attendance_change_pct":    attendance_change_pct,
        },
        "enrollment_data": enrollment_data,
        "revenue_data":    revenue_data,
        "recent_activity": recent_activity,
    }
