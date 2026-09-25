import re
import uuid
from collections import defaultdict
from dataclasses import asdict, dataclass, field

from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.guardian import GuardianProfile, GuardianStatus, StudentGuardian
from app.models.parent import Parent
from app.models.school_membership import MembershipRole, SchoolMembership
from app.models.user import User
from app.utils.identity import normalize_email, normalize_phone
from app.utils.security import generate_temp_password, hash_password

_EMAIL = TypeAdapter(EmailStr)


@dataclass
class AuditIssue:
    legacy_parent_ids: list[str]
    reason: str
    email: str | None = None
    phone: str | None = None


@dataclass
class LegacyParentAudit:
    school_id: str
    legacy_count: int
    safe_groups: list[list[str]] = field(default_factory=list)
    valid_unique_email_matches: list[AuditIssue] = field(default_factory=list)
    duplicate_emails: list[AuditIssue] = field(default_factory=list)
    missing_emails: list[AuditIssue] = field(default_factory=list)
    duplicate_phones: list[AuditIssue] = field(default_factory=list)
    conflicting_email_phone_matches: list[AuditIssue] = field(default_factory=list)
    likely_duplicate_guardians: list[AuditIssue] = field(default_factory=list)
    invalid_contact_data: list[AuditIssue] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


def _name_key(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip()).casefold()


def _valid_email(value: str | None) -> str | None:
    if not value or not value.strip():
        return None
    try:
        return normalize_email(str(_EMAIL.validate_python(value)))
    except ValidationError:
        return ""


def _valid_phone(value: str | None) -> str | None:
    try:
        return normalize_phone(value)
    except Exception:
        return ""


async def audit_legacy_parents(db: AsyncSession, school_id: uuid.UUID) -> LegacyParentAudit:
    rows = list((await db.execute(select(Parent).where(Parent.school_id == school_id).order_by(Parent.created_at, Parent.id))).scalars().all())
    report = LegacyParentAudit(school_id=str(school_id), legacy_count=len(rows))
    by_email: dict[str, list[Parent]] = defaultdict(list)
    by_phone: dict[str, list[Parent]] = defaultdict(list)
    normalized: dict[uuid.UUID, tuple[str | None, str | None]] = {}
    for row in rows:
        email, phone = _valid_email(row.email), _valid_phone(row.phone)
        normalized[row.id] = (email, phone)
        issue = AuditIssue([str(row.id)], "", row.email, row.phone)
        if email is None:
            issue.reason = "Missing email; automatic account identity is unavailable"
            report.missing_emails.append(issue)
        elif email == "" or phone == "":
            issue.reason = "Email or phone is invalid"
            report.invalid_contact_data.append(issue)
        else:
            by_email[email].append(row)
            if phone:
                by_phone[phone].append(row)

    users = list((await db.execute(select(User).options(selectinload(User.memberships)))).scalars().all())
    users_by_email = {normalize_email(user.email): user for user in users}
    verified_by_phone = {user.phone: user for user in users if user.phone and user.phone_verified_at}
    unsafe_ids: set[uuid.UUID] = set()
    existing_primary_students = set((await db.execute(select(StudentGuardian.student_id).where(
        StudentGuardian.school_id == school_id,
        StudentGuardian.is_primary.is_(True),
        StudentGuardian.is_active.is_(True),
    ))).scalars().all())
    primary_by_student: dict[uuid.UUID, list[Parent]] = defaultdict(list)
    for row in rows:
        if row.is_primary:
            primary_by_student[row.student_id].append(row)
    for group in primary_by_student.values():
        if len(group) > 1:
            unsafe_ids.update(row.id for row in group)
            report.conflicting_email_phone_matches.append(AuditIssue([str(row.id) for row in group], "Student has multiple legacy primary guardians"))
    for row in rows:
        if row.is_primary and row.student_id in existing_primary_students:
            unsafe_ids.add(row.id)
            report.conflicting_email_phone_matches.append(AuditIssue([str(row.id)], "Student already has an active primary guardian", row.email, row.phone))
    for email, group in by_email.items():
        ids = [str(row.id) for row in group]
        phones = {normalized[row.id][1] for row in group}
        names = {_name_key(row.name) for row in group}
        if len(group) > 1:
            report.duplicate_emails.append(AuditIssue(ids, "Email occurs on multiple legacy rows", email, next(iter(phones), None)))
            report.likely_duplicate_guardians.append(AuditIssue(ids, "Rows share an email and may represent one guardian", email, next(iter(phones), None)))
        if len(phones) > 1 or len(names) > 1:
            unsafe_ids.update(row.id for row in group)
            report.conflicting_email_phone_matches.append(AuditIssue(ids, "Shared email has inconsistent name or phone", email))
            continue
        email_user = users_by_email.get(email)
        phone = next(iter(phones), None)
        phone_user = verified_by_phone.get(phone) if phone else None
        if email_user and phone_user and email_user.id != phone_user.id:
            unsafe_ids.update(row.id for row in group)
            report.conflicting_email_phone_matches.append(AuditIssue(ids, "Email and verified phone match different users", email, phone))
            continue
        if email_user:
            report.valid_unique_email_matches.append(AuditIssue(ids, "Exact normalized email matches an existing user", email, phone))
            membership = next((item for item in email_user.memberships if item.school_id == school_id), None)
            if membership and membership.role != MembershipRole.parent:
                unsafe_ids.update(row.id for row in group)
                report.conflicting_email_phone_matches.append(AuditIssue(ids, "Matching user already has a staff role in this school", email, phone))

    for phone, group in by_phone.items():
        emails = {normalized[row.id][0] for row in group}
        if len(emails) > 1:
            unsafe_ids.update(row.id for row in group)
            report.duplicate_phones.append(AuditIssue([str(row.id) for row in group], "Phone is shared by different emails", None, phone))

    for email, group in by_email.items():
        if not any(row.id in unsafe_ids for row in group):
            report.safe_groups.append([str(row.id) for row in group])
    return report


async def backfill_safe_legacy_parents(db: AsyncSession, school_id: uuid.UUID, actor_user_id: uuid.UUID) -> dict:
    report = await audit_legacy_parents(db, school_id)
    migrated_groups = created_users = created_links = 0
    for raw_ids in report.safe_groups:
        ids = [uuid.UUID(value) for value in raw_ids]
        rows = list((await db.execute(select(Parent).where(Parent.id.in_(ids), Parent.school_id == school_id))).scalars().all())
        if not rows:
            continue
        first = rows[0]
        email = normalize_email(first.email or "")
        phone = normalize_phone(first.phone)
        user = (await db.execute(select(User).where(func.lower(func.trim(User.email)) == email))).scalar_one_or_none()
        if user is None:
            user = User(name=first.name.strip(), email=email, phone=phone, password_hash=hash_password(generate_temp_password()), is_active=True, is_first_login=True)
            db.add(user); await db.flush(); created_users += 1
        membership = (await db.execute(select(SchoolMembership).where(SchoolMembership.user_id == user.id, SchoolMembership.school_id == school_id))).scalar_one_or_none()
        if membership and membership.role != MembershipRole.parent:
            continue
        if membership is None:
            membership = SchoolMembership(user_id=user.id, school_id=school_id, role=MembershipRole.parent, invited_by=actor_user_id, is_active=False)
            db.add(membership); await db.flush()
        profile = (await db.execute(select(GuardianProfile).where(GuardianProfile.membership_id == membership.id))).scalar_one_or_none()
        if profile is None:
            profile = GuardianProfile(school_id=school_id, membership_id=membership.id, address=first.address, occupation=first.occupation, status=GuardianStatus.invited)
            db.add(profile); await db.flush()
        for legacy in rows:
            existing = (await db.execute(select(StudentGuardian).where(StudentGuardian.guardian_profile_id == profile.id, StudentGuardian.student_id == legacy.student_id))).scalar_one_or_none()
            if existing is None:
                db.add(StudentGuardian(school_id=school_id, guardian_profile_id=profile.id, student_id=legacy.student_id, relationship_type=legacy.relation_type, is_primary=legacy.is_primary, created_by=actor_user_id))
                created_links += 1
        migrated_groups += 1
    await db.commit()
    return {"migrated_groups": migrated_groups, "created_users": created_users, "created_relationships": created_links, "skipped_legacy_records": report.legacy_count - sum(len(group) for group in report.safe_groups)}


async def verify_legacy_parent_backfill(db: AsyncSession, school_id: uuid.UUID) -> dict:
    legacy_count = (await db.execute(select(func.count(Parent.id)).where(Parent.school_id == school_id))).scalar_one()
    profile_count = (await db.execute(select(func.count(GuardianProfile.id)).where(GuardianProfile.school_id == school_id))).scalar_one()
    relationship_count = (await db.execute(select(func.count(StudentGuardian.id)).where(StudentGuardian.school_id == school_id))).scalar_one()
    legacy_primary = (await db.execute(select(func.count(Parent.id)).where(Parent.school_id == school_id, Parent.is_primary.is_(True)))).scalar_one()
    guardian_primary = (await db.execute(select(func.count(StudentGuardian.id)).where(StudentGuardian.school_id == school_id, StudentGuardian.is_primary.is_(True), StudentGuardian.is_active.is_(True)))).scalar_one()
    return {"legacy_parent_rows": legacy_count, "guardian_profiles": profile_count, "student_guardian_relationships": relationship_count, "legacy_primary_guardians": legacy_primary, "active_primary_guardians": guardian_primary, "relationship_count_matches": legacy_count == relationship_count, "primary_count_matches": legacy_primary == guardian_primary}
