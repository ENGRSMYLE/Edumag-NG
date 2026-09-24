"""
Student service — complex logic extracted from the router.
All functions are async and receive an open AsyncSession.
"""
from __future__ import annotations

import logging
import re
import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.student import Gender, Student
from app.schemas.student import (
    BulkUploadErrorRow,
    BulkUploadResult,
    StudentCreate,
    StudentListItem,
)

if TYPE_CHECKING:
    from app.models.user import User

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Admission number generation
# ---------------------------------------------------------------------------

_ADM_RE = re.compile(r"^SCH-\d{4}-(\d{4,})$")


async def generate_admission_number(
    db: AsyncSession,
    school_id: uuid.UUID,
    year: int | None = None,
) -> str:
    """Generate the next SCH-YYYY-NNNN for the given school."""
    if year is None:
        year = datetime.utcnow().year

    prefix = f"SCH-{year}-"

    result = await db.execute(
        select(Student.admission_number)
        .where(
            Student.school_id == school_id,
            Student.admission_number.like(f"{prefix}%"),
        )
    )
    existing = result.scalars().all()

    max_seq = 0
    for adm in existing:
        m = _ADM_RE.match(adm)
        if m:
            seq = int(m.group(1))
            if seq > max_seq:
                max_seq = seq

    return f"{prefix}{max_seq + 1:04d}"


# ---------------------------------------------------------------------------
# Bulk upload helpers
# ---------------------------------------------------------------------------

def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(str(value).strip(), fmt).date()
        except ValueError:
            continue
    return None


def _cell(row: dict, key: str) -> str:
    """Return stripped cell value or empty string."""
    v = row.get(key)
    if v is None:
        return ""
    return str(v).strip()


def validate_bulk_row(
    row_data: dict,
    school_id: uuid.UUID,
    classes_map: dict[str, uuid.UUID],
) -> tuple[StudentCreate | None, str | None]:
    """
    Validate one row dict from the Excel sheet.
    Returns (StudentCreate, None) on success or (None, error_message) on failure.
    classes_map: {class_name.lower(): class_id}
    """
    first_name = _cell(row_data, "first_name")
    last_name = _cell(row_data, "last_name")
    dob_raw = _cell(row_data, "date_of_birth")
    gender_raw = _cell(row_data, "gender").lower()
    adm_date_raw = _cell(row_data, "admission_date")

    if not first_name:
        return None, "First Name is required"
    if not last_name:
        return None, "Last Name is required"

    dob = _parse_date(dob_raw)
    if dob is None:
        return None, f"Invalid Date of Birth: '{dob_raw}' (use YYYY-MM-DD)"

    if gender_raw not in ("male", "female"):
        return None, f"Gender must be 'male' or 'female', got '{gender_raw}'"

    adm_date = _parse_date(adm_date_raw)
    if adm_date is None:
        return None, f"Invalid Admission Date: '{adm_date_raw}' (use YYYY-MM-DD)"

    # Optional class lookup
    class_name_raw = _cell(row_data, "class_name")
    class_id: uuid.UUID | None = None
    if class_name_raw:
        class_id = classes_map.get(class_name_raw.lower())
        if class_id is None:
            return None, f"Class '{class_name_raw}' not found in this school"

    admission_number = _cell(row_data, "admission_number") or None

    try:
        student = StudentCreate(
            first_name=first_name,
            last_name=last_name,
            middle_name=_cell(row_data, "middle_name") or None,
            date_of_birth=dob,
            gender=gender_raw,
            admission_date=adm_date,
            address=_cell(row_data, "address") or None,
            state_of_origin=_cell(row_data, "state_of_origin") or None,
            religion=_cell(row_data, "religion") or None,
            blood_group=_cell(row_data, "blood_group") or None,
            genotype=_cell(row_data, "genotype") or None,
            admission_number=admission_number,
            class_id=class_id,
        )
    except ValidationError as exc:
        first_error = exc.errors()[0]
        field = str(first_error.get("loc", ["row"])[-1]).replace("_", " ").title()
        return None, f"{field}: {first_error['msg']}"

    return student, None


async def process_bulk_upload(
    db: AsyncSession,
    rows: list[dict],
    school_id: uuid.UUID,
    current_user: "User",
) -> BulkUploadResult:
    """
    Validate parsed spreadsheet rows and create students row-by-row.
    Bad rows are collected in error_rows — never abort the whole upload.
    """
    # Pre-load all classes for this school once
    from app.models.class_ import Class
    cls_result = await db.execute(
        select(Class.id, Class.name).where(Class.school_id == school_id)
    )
    classes_map: dict[str, uuid.UUID] = {
        name.lower(): cid for cid, name in cls_result.all()
    }

    # Pre-load existing admission numbers for duplicate check
    adm_result = await db.execute(
        select(Student.admission_number).where(Student.school_id == school_id)
    )
    existing_adm_numbers: set[str] = set(adm_result.scalars().all())

    error_rows: list[BulkUploadErrorRow] = []
    created: list[StudentListItem] = []

    for row_idx, row_dict in enumerate(rows, start=2):  # spreadsheet row 1 is the header
        adm_label = _cell(row_dict, "admission_number") or f"row-{row_idx}"

        student_create, err = validate_bulk_row(row_dict, school_id, classes_map)
        if err:
            error_rows.append(BulkUploadErrorRow(row=row_idx, admission_number=adm_label, reason=err))
            continue

        assert student_create is not None

        # Resolve or generate admission number
        if student_create.admission_number:
            adm_num = student_create.admission_number
            if adm_num in existing_adm_numbers:
                error_rows.append(BulkUploadErrorRow(
                    row=row_idx,
                    admission_number=adm_num,
                    reason=f"Admission number '{adm_num}' already exists",
                ))
                continue
        else:
            adm_num = await generate_admission_number(db, school_id)

        existing_adm_numbers.add(adm_num)

        student = Student(
            school_id=school_id,
            admission_number=adm_num,
            first_name=student_create.first_name,
            last_name=student_create.last_name,
            middle_name=student_create.middle_name,
            date_of_birth=student_create.date_of_birth,
            gender=Gender(student_create.gender),
            admission_date=student_create.admission_date,
            address=student_create.address,
            state_of_origin=student_create.state_of_origin,
            religion=student_create.religion,
            blood_group=student_create.blood_group,
            genotype=student_create.genotype,
            class_id=student_create.class_id,
            is_active=True,
        )
        db.add(student)
        try:
            await db.flush()
        except Exception as exc:
            await db.rollback()
            logger.warning("Bulk upload row %d flush error: %s", row_idx, exc)
            error_rows.append(BulkUploadErrorRow(
                row=row_idx,
                admission_number=adm_num,
                reason="Database error while saving row",
            ))
            continue

        class_name: str | None = None
        if student_create.class_id:
            class_name = next(
                (n for n, cid in {v: k for k, v in classes_map.items()}.items()
                 if cid == student_create.class_id),
                None,
            )

        full_name = f"{student.first_name} {student.last_name}"
        if student.middle_name:
            full_name = f"{student.first_name} {student.middle_name} {student.last_name}"

        created.append(StudentListItem(
            id=student.id,
            first_name=student.first_name,
            last_name=student.last_name,
            full_name=full_name,
            admission_number=adm_num,
            class_name=class_name,
            gender=student.gender.value,
            is_active=True,
            admission_date=student.admission_date,
            photo_url=None,
        ))

    await db.commit()
    return BulkUploadResult(
        success_count=len(created),
        error_rows=error_rows,
        created_students=created,
    )
