import math
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_event import AuditEvent
from app.models.guardian import GuardianProfile, GuardianStatus, StudentGuardian
from app.models.refresh_token import RefreshToken
from app.models.school_membership import MembershipRole, SchoolMembership
from app.models.student import Student
from app.models.user import User
from app.schemas.guardian import (
    PaginatedParentAccountsResponse,
    ParentAccountResponse,
    ParentAccountUpdate,
    StudentGuardianCreate,
    StudentGuardianResponse,
    StudentGuardianUpdate,
)


def _not_found(label: str = "Parent") -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{label} not found")


def _audit(school_id, actor_id, event_type, target_type, target_id, **data):
    return AuditEvent(
        school_id=school_id,
        actor_user_id=actor_id,
        event_type=event_type,
        target_type=target_type,
        target_id=target_id,
        event_data={k: str(v) if isinstance(v, uuid.UUID) else v for k, v in data.items()},
    )


def _invitation_status(membership: SchoolMembership, now: datetime) -> str:
    if membership.is_active:
        return "accepted"
    if membership.invite_token is None:
        return "none"
    if membership.invite_token_expires and membership.invite_token_expires.replace(tzinfo=timezone.utc) <= now:
        return "expired"
    return "pending"


def _relationship_response(link: StudentGuardian, user: User) -> StudentGuardianResponse:
    return StudentGuardianResponse(
        relationship_id=link.id,
        guardian_profile_id=link.guardian_profile_id,
        student_id=link.student_id,
        guardian_name=user.name,
        email=user.email,
        phone=user.phone,
        relationship_type=link.relationship_type,
        is_primary=link.is_primary,
        is_emergency_contact=link.is_emergency_contact,
        can_receive_messages=link.can_receive_messages,
        can_view_attendance=link.can_view_attendance,
        can_view_results=link.can_view_results,
        can_view_assignments=link.can_view_assignments,
        can_view_finance=link.can_view_finance,
        can_pick_up=link.can_pick_up,
        is_active=link.is_active,
        starts_at=link.starts_at,
        ends_at=link.ends_at,
    )


def _account_response(
    profile: GuardianProfile,
    membership: SchoolMembership,
    user: User,
    links: list[StudentGuardian],
) -> ParentAccountResponse:
    now = datetime.now(timezone.utc)
    activation_status = "disabled"
    if profile.status == GuardianStatus.active and membership.is_active:
        activation_status = "active"
    elif profile.status == GuardianStatus.invited:
        activation_status = "invited"
    return ParentAccountResponse(
        guardian_id=profile.id,
        membership_id=membership.id,
        user_id=user.id,
        name=user.name,
        email=user.email,
        phone=user.phone,
        address=profile.address,
        occupation=profile.occupation,
        preferred_contact_channel=profile.preferred_contact_channel,
        status=profile.status.value,
        membership_active=membership.is_active,
        activation_status=activation_status,
        invitation_status=_invitation_status(membership, now),
        invitation_expires_at=membership.invite_token_expires,
        active_children_count=sum(link.is_active for link in links),
        relationships=[_relationship_response(link, user) for link in links],
    )


async def _parent_row(db: AsyncSession, school_id: uuid.UUID, guardian_id: uuid.UUID):
    row = (await db.execute(
        select(GuardianProfile, SchoolMembership, User)
        .join(SchoolMembership, SchoolMembership.id == GuardianProfile.membership_id)
        .join(User, User.id == SchoolMembership.user_id)
        .where(
            GuardianProfile.id == guardian_id,
            GuardianProfile.school_id == school_id,
            SchoolMembership.school_id == school_id,
            SchoolMembership.role == MembershipRole.parent,
        )
    )).one_or_none()
    if row is None:
        raise _not_found()
    return row


async def list_parent_accounts(
    db: AsyncSession,
    school_id: uuid.UUID,
    *,
    page: int,
    per_page: int,
    search: str | None = None,
    account_status: GuardianStatus | None = None,
) -> PaginatedParentAccountsResponse:
    filters = [
        GuardianProfile.school_id == school_id,
        SchoolMembership.school_id == school_id,
        SchoolMembership.role == MembershipRole.parent,
    ]
    if search:
        term = f"%{search.strip()}%"
        filters.append(or_(User.name.ilike(term), User.email.ilike(term), User.phone.ilike(term)))
    if account_status:
        filters.append(GuardianProfile.status == account_status)
    base = (
        select(GuardianProfile, SchoolMembership, User)
        .join(SchoolMembership, SchoolMembership.id == GuardianProfile.membership_id)
        .join(User, User.id == SchoolMembership.user_id)
        .where(*filters)
    )
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (await db.execute(
        base.order_by(User.name, User.email).offset((page - 1) * per_page).limit(per_page)
    )).all()
    profile_ids = [profile.id for profile, _, _ in rows]
    links_by_profile: dict[uuid.UUID, list[StudentGuardian]] = {pid: [] for pid in profile_ids}
    if profile_ids:
        links = list((await db.execute(
            select(StudentGuardian)
            .where(
                StudentGuardian.school_id == school_id,
                StudentGuardian.guardian_profile_id.in_(profile_ids),
            )
            .order_by(StudentGuardian.created_at)
        )).scalars().all())
        for link in links:
            links_by_profile[link.guardian_profile_id].append(link)
    return PaginatedParentAccountsResponse(
        items=[_account_response(p, m, u, links_by_profile[p.id]) for p, m, u in rows],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


async def get_parent_account(
    db: AsyncSession, school_id: uuid.UUID, guardian_id: uuid.UUID
) -> ParentAccountResponse:
    profile, membership, user = await _parent_row(db, school_id, guardian_id)
    links = list((await db.execute(
        select(StudentGuardian).where(
            StudentGuardian.guardian_profile_id == profile.id,
            StudentGuardian.school_id == school_id,
        ).order_by(StudentGuardian.created_at)
    )).scalars().all())
    return _account_response(profile, membership, user, links)


async def update_parent_account(
    db: AsyncSession,
    school_id: uuid.UUID,
    guardian_id: uuid.UUID,
    actor_id: uuid.UUID,
    payload: ParentAccountUpdate,
) -> ParentAccountResponse:
    profile, _, user = await _parent_row(db, school_id, guardian_id)
    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes:
        user.name = " ".join(changes.pop("name").split())
    for field, value in changes.items():
        setattr(profile, field, value)
    db.add(_audit(school_id, actor_id, "parent_account_updated", "guardian_profile", profile.id))
    await db.commit()
    return await get_parent_account(db, school_id, guardian_id)


async def list_student_guardians(
    db: AsyncSession, school_id: uuid.UUID, student_id: uuid.UUID
) -> list[StudentGuardianResponse]:
    exists = (await db.execute(select(Student.id).where(
        Student.id == student_id, Student.school_id == school_id
    ))).scalar_one_or_none()
    if exists is None:
        raise _not_found("Student")
    rows = (await db.execute(
        select(StudentGuardian, User)
        .join(GuardianProfile, GuardianProfile.id == StudentGuardian.guardian_profile_id)
        .join(SchoolMembership, SchoolMembership.id == GuardianProfile.membership_id)
        .join(User, User.id == SchoolMembership.user_id)
        .where(StudentGuardian.student_id == student_id, StudentGuardian.school_id == school_id)
        .order_by(StudentGuardian.is_active.desc(), StudentGuardian.is_primary.desc(), User.name)
    )).all()
    return [_relationship_response(link, user) for link, user in rows]


async def link_guardian_to_student(
    db: AsyncSession,
    school_id: uuid.UUID,
    student_id: uuid.UUID,
    actor_id: uuid.UUID,
    payload: StudentGuardianCreate,
) -> StudentGuardianResponse:
    student = (await db.execute(select(Student).where(
        Student.id == student_id, Student.school_id == school_id
    ))).scalar_one_or_none()
    if student is None:
        raise _not_found("Student")
    profile, membership, user = await _parent_row(db, school_id, payload.guardian_profile_id)
    existing = (await db.execute(select(StudentGuardian).where(
        StudentGuardian.guardian_profile_id == profile.id,
        StudentGuardian.student_id == student_id,
        StudentGuardian.school_id == school_id,
    ))).scalar_one_or_none()
    if existing and existing.is_active:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Guardian is already linked to student")
    if payload.is_primary:
        await db.execute(update(StudentGuardian).where(
            StudentGuardian.student_id == student_id,
            StudentGuardian.school_id == school_id,
            StudentGuardian.is_primary.is_(True),
            StudentGuardian.is_active.is_(True),
        ).values(is_primary=False))
    values = payload.model_dump(exclude={"guardian_profile_id"})
    if existing:
        for field, value in values.items():
            setattr(existing, field, value)
        existing.is_active = True
        existing.ends_at = payload.ends_at
        link = existing
    else:
        link = StudentGuardian(
            school_id=school_id,
            student_id=student_id,
            guardian_profile_id=profile.id,
            created_by=actor_id,
            **values,
        )
        db.add(link)
    if not user.is_first_login:
        membership.is_active = True
        profile.status = GuardianStatus.active
    await db.flush()
    db.add(_audit(school_id, actor_id, "guardian_linked_to_student", "student_guardian", link.id))
    await db.commit()
    return _relationship_response(link, user)


async def _relationship_row(db, school_id, student_id, relationship_id):
    row = (await db.execute(
        select(StudentGuardian, GuardianProfile, SchoolMembership, User)
        .join(GuardianProfile, GuardianProfile.id == StudentGuardian.guardian_profile_id)
        .join(SchoolMembership, SchoolMembership.id == GuardianProfile.membership_id)
        .join(User, User.id == SchoolMembership.user_id)
        .where(
            StudentGuardian.id == relationship_id,
            StudentGuardian.student_id == student_id,
            StudentGuardian.school_id == school_id,
            GuardianProfile.school_id == school_id,
            SchoolMembership.school_id == school_id,
        )
    )).one_or_none()
    if row is None:
        raise _not_found("Guardian relationship")
    return row


async def update_student_guardian(
    db: AsyncSession,
    school_id: uuid.UUID,
    student_id: uuid.UUID,
    relationship_id: uuid.UUID,
    actor_id: uuid.UUID,
    payload: StudentGuardianUpdate,
) -> StudentGuardianResponse:
    link, profile, membership, user = await _relationship_row(
        db, school_id, student_id, relationship_id
    )
    changes = payload.model_dump(exclude_unset=True)
    if changes.get("is_primary") is True:
        await db.execute(update(StudentGuardian).where(
            StudentGuardian.student_id == student_id,
            StudentGuardian.school_id == school_id,
            StudentGuardian.id != link.id,
            StudentGuardian.is_active.is_(True),
        ).values(is_primary=False))
    if changes.get("is_active") is False:
        changes.pop("is_active")
        await unlink_guardian_from_student(
            db, school_id, student_id, relationship_id, actor_id, commit=False
        )
    else:
        for field, value in changes.items():
            setattr(link, field, value)
        if changes.get("is_active") is True and not user.is_first_login:
            profile.status = GuardianStatus.active
            membership.is_active = True
    db.add(_audit(school_id, actor_id, "guardian_relationship_updated", "student_guardian", link.id))
    await db.commit()
    return _relationship_response(link, user)


async def unlink_guardian_from_student(
    db: AsyncSession,
    school_id: uuid.UUID,
    student_id: uuid.UUID,
    relationship_id: uuid.UUID,
    actor_id: uuid.UUID,
    *,
    commit: bool = True,
) -> None:
    link, profile, membership, _ = await _relationship_row(
        db, school_id, student_id, relationship_id
    )
    if link.is_active:
        link.is_active = False
        link.is_primary = False
        link.ends_at = datetime.now(timezone.utc)
    remaining = (await db.execute(select(func.count(StudentGuardian.id)).where(
        StudentGuardian.guardian_profile_id == profile.id,
        StudentGuardian.school_id == school_id,
        StudentGuardian.id != link.id,
        StudentGuardian.is_active.is_(True),
    ))).scalar_one()
    if remaining == 0:
        membership.is_active = False
        await db.execute(update(RefreshToken).where(
            RefreshToken.membership_id == membership.id,
            RefreshToken.revoked.is_(False),
        ).values(revoked=True))
    db.add(_audit(
        school_id, actor_id, "guardian_unlinked_from_student", "student_guardian", link.id,
        final_active_relationship=remaining == 0,
    ))
    if commit:
        await db.commit()
