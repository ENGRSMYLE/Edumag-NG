import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.audit_event import AuditEvent
from app.models.guardian import GuardianProfile, GuardianStatus, StudentGuardian
from app.models.school import School
from app.models.school_membership import MembershipRole, SchoolMembership
from app.models.refresh_token import RefreshToken
from app.models.student import Student
from app.models.user import User
from app.schemas.guardian import GuardianInviteRequest, GuardianSearchItem
from app.utils.identity import normalize_email, normalize_phone
from app.utils.security import create_invite_token, generate_temp_password, hash_password


@dataclass(frozen=True)
class GuardianEmailTask:
    kind: Literal["new_account", "school_linked"]
    to_email: str
    to_name: str
    school_name: str
    invite_link: str
    temp_password: str | None = None


@dataclass(frozen=True)
class GuardianInviteResult:
    guardian_profile: GuardianProfile
    membership: SchoolMembership
    user: User
    relationship: StudentGuardian
    invitation_created: bool
    email_task: GuardianEmailTask | None


async def _get_guardian_account(
    db: AsyncSession, school_id: uuid.UUID, profile_id: uuid.UUID
) -> tuple[GuardianProfile, SchoolMembership, User, School]:
    row = (await db.execute(
        select(GuardianProfile, SchoolMembership, User, School)
        .join(SchoolMembership, SchoolMembership.id == GuardianProfile.membership_id)
        .join(User, User.id == SchoolMembership.user_id)
        .join(School, School.id == GuardianProfile.school_id)
        .where(GuardianProfile.id == profile_id, GuardianProfile.school_id == school_id)
    )).one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guardian not found")
    return row


async def disable_guardian_account(
    db: AsyncSession, *, school_id: uuid.UUID, actor_user_id: uuid.UUID, profile_id: uuid.UUID
) -> None:
    profile, membership, _, _ = await _get_guardian_account(db, school_id, profile_id)
    profile.status = GuardianStatus.disabled
    membership.is_active = False
    membership.invite_token = None
    membership.invite_token_expires = None
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.membership_id == membership.id, RefreshToken.revoked.is_(False))
        .values(revoked=True)
    )
    db.add(_audit(school_id, actor_user_id, "parent_account_disabled", "guardian_profile", profile.id))
    await db.commit()


async def reactivate_guardian_account(
    db: AsyncSession, *, school_id: uuid.UUID, actor_user_id: uuid.UUID, profile_id: uuid.UUID
) -> None:
    profile, membership, user, _ = await _get_guardian_account(db, school_id, profile_id)
    if not user.is_active:
        raise _conflict("The global account is disabled and requires administrator review")
    if profile.status != GuardianStatus.disabled:
        raise _conflict("Guardian account is not disabled")
    profile.status = GuardianStatus.active
    membership.is_active = True
    db.add(_audit(school_id, actor_user_id, "parent_account_reactivated", "guardian_profile", profile.id))
    await db.commit()


async def resend_guardian_invitation(
    db: AsyncSession, *, school_id: uuid.UUID, actor_user_id: uuid.UUID, profile_id: uuid.UUID
) -> GuardianEmailTask:
    profile, membership, user, school = await _get_guardian_account(db, school_id, profile_id)
    if membership.is_active or profile.status == GuardianStatus.active:
        raise _conflict("Guardian account is already active")
    if profile.status in {GuardianStatus.disabled, GuardianStatus.suspended} or not user.is_active:
        raise _conflict("Guardian account requires administrator review")

    now = datetime.now(timezone.utc)
    raw_token = create_invite_token(str(membership.id))
    membership.invite_token = raw_token
    membership.invite_token_expires = now + timedelta(hours=settings.INVITE_TOKEN_EXPIRE_HOURS)
    temp_password = None
    if user.is_first_login:
        temp_password = generate_temp_password()
        user.password_hash = hash_password(temp_password)
    db.add(_audit(school_id, actor_user_id, "parent_invitation_resent", "school_membership", membership.id))
    await db.commit()
    return GuardianEmailTask(
        kind="new_account" if user.is_first_login else "school_linked",
        to_email=user.email,
        to_name=user.name,
        school_name=school.name,
        invite_link=f"{settings.FRONTEND_URL}/set-password?token={raw_token}",
        temp_password=temp_password,
    )


def _conflict(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


def _audit(
    school_id: uuid.UUID,
    actor_user_id: uuid.UUID,
    event_type: str,
    target_type: str,
    target_id: uuid.UUID,
    **event_data: Any,
) -> AuditEvent:
    return AuditEvent(
        school_id=school_id,
        actor_user_id=actor_user_id,
        event_type=event_type,
        target_type=target_type,
        target_id=target_id,
        event_data={key: str(value) if isinstance(value, uuid.UUID) else value for key, value in event_data.items()},
    )


async def search_guardians(
    db: AsyncSession,
    school_id: uuid.UUID,
    *,
    email: str | None = None,
    phone: str | None = None,
    name: str | None = None,
    limit: int = 20,
) -> list[GuardianSearchItem]:
    filters = []
    if email:
        filters.append(func.lower(func.trim(User.email)) == normalize_email(email))
    if phone:
        filters.append(User.phone == normalize_phone(phone))
    if name and name.strip():
        # Name is intentionally a display/search aid only; creation matching
        # never calls this branch.
        filters.append(User.name.ilike(f"%{name.strip()}%"))
    if not filters:
        return []

    query = (
        select(GuardianProfile, User)
        .join(SchoolMembership, SchoolMembership.id == GuardianProfile.membership_id)
        .join(User, User.id == SchoolMembership.user_id)
        .where(GuardianProfile.school_id == school_id, or_(*filters))
        .order_by(User.name, User.email)
        .limit(limit)
    )
    rows = (await db.execute(query)).all()
    return [
        GuardianSearchItem(
            guardian_profile_id=profile.id,
            user_id=user.id,
            name=user.name,
            email=user.email,
            phone=user.phone,
            phone_verified=user.phone_verified_at is not None,
            status=profile.status.value,
        )
        for profile, user in rows
    ]


async def create_or_link_guardian(
    db: AsyncSession,
    *,
    school_id: uuid.UUID,
    actor_user_id: uuid.UUID,
    payload: GuardianInviteRequest,
) -> GuardianInviteResult:
    normalized_email = normalize_email(str(payload.email))
    normalized_phone = normalize_phone(payload.phone)
    now = datetime.now(timezone.utc)

    try:
        school = (await db.execute(
            select(School).where(School.id == school_id, School.is_active.is_(True))
        )).scalar_one_or_none()
        student = (await db.execute(
            select(Student).where(
                Student.id == payload.student_id,
                Student.school_id == school_id,
                Student.is_active.is_(True),
            )
        )).scalar_one_or_none()
        if school is None or student is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

        user: User | None = None
        membership: SchoolMembership | None = None
        profile: GuardianProfile | None = None
        user_was_created = False

        if payload.guardian_profile_id:
            selected = (await db.execute(
                select(GuardianProfile, SchoolMembership, User)
                .join(SchoolMembership, SchoolMembership.id == GuardianProfile.membership_id)
                .join(User, User.id == SchoolMembership.user_id)
                .where(
                    GuardianProfile.id == payload.guardian_profile_id,
                    GuardianProfile.school_id == school_id,
                )
            )).one_or_none()
            if selected is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guardian not found")
            profile, membership, user = selected
        else:
            email_user = (await db.execute(
                select(User).where(func.lower(func.trim(User.email)) == normalized_email)
            )).scalar_one_or_none()
            phone_users: list[User] = []
            if normalized_phone:
                phone_users = list((await db.execute(
                    select(User).where(
                        User.phone == normalized_phone,
                        User.phone_verified_at.is_not(None),
                    )
                )).scalars().all())
                if len(phone_users) > 1:
                    raise _conflict("Verified phone matches multiple accounts; manual resolution is required")
            phone_user = phone_users[0] if phone_users else None
            if email_user and phone_user and email_user.id != phone_user.id:
                raise _conflict("Email and verified phone identify different users; manual resolution is required")
            user = email_user or phone_user

        if user is not None and not user.is_active:
            raise _conflict("The matching account is disabled and requires administrator review")

        if user is None:
            temp_password = generate_temp_password()
            user = User(
                name=payload.name,
                email=normalized_email,
                phone=normalized_phone,
                password_hash=hash_password(temp_password),
                is_active=True,
                is_first_login=True,
            )
            db.add(user)
            await db.flush()
            user_was_created = True
            db.add(_audit(school_id, actor_user_id, "parent_account_created", "user", user.id))
        else:
            temp_password = None

        if membership is None:
            membership = (await db.execute(
                select(SchoolMembership).where(
                    SchoolMembership.user_id == user.id,
                    SchoolMembership.school_id == school_id,
                )
            )).scalar_one_or_none()
        if membership is not None and membership.role != MembershipRole.parent:
            raise _conflict("This user already has a staff role in this school; manual resolution is required")
        if membership is None:
            membership = SchoolMembership(
                user_id=user.id,
                school_id=school_id,
                role=MembershipRole.parent,
                invited_by=actor_user_id,
                is_active=False,
            )
            db.add(membership)
            await db.flush()
            db.add(_audit(school_id, actor_user_id, "parent_membership_created", "school_membership", membership.id))

        if profile is None:
            profile = (await db.execute(
                select(GuardianProfile).where(GuardianProfile.membership_id == membership.id)
            )).scalar_one_or_none()
        if profile is not None and profile.status in {GuardianStatus.disabled, GuardianStatus.suspended}:
            raise _conflict("The guardian profile is disabled and requires administrator review")
        if profile is not None and membership.is_active and profile.status == GuardianStatus.invited:
            profile.status = GuardianStatus.active
        if profile is None:
            profile = GuardianProfile(
                school_id=school_id,
                membership_id=membership.id,
                address=payload.address,
                occupation=payload.occupation,
                preferred_contact_channel=payload.preferred_contact_channel,
                status=GuardianStatus.active if membership.is_active else GuardianStatus.invited,
            )
            db.add(profile)
            await db.flush()
            db.add(_audit(school_id, actor_user_id, "guardian_profile_created", "guardian_profile", profile.id))

        duplicate_link = (await db.execute(
            select(StudentGuardian.id).where(
                StudentGuardian.guardian_profile_id == profile.id,
                StudentGuardian.student_id == student.id,
            )
        )).scalar_one_or_none()
        if duplicate_link:
            raise _conflict("This guardian is already linked to the student")

        relationship = StudentGuardian(
            school_id=school_id,
            guardian_profile_id=profile.id,
            student_id=student.id,
            relationship_type=payload.relationship_type,
            is_primary=payload.is_primary,
            is_emergency_contact=payload.is_emergency_contact,
            can_receive_messages=payload.can_receive_messages,
            can_view_attendance=payload.can_view_attendance,
            can_view_results=payload.can_view_results,
            can_view_assignments=payload.can_view_assignments,
            can_view_finance=payload.can_view_finance,
            can_pick_up=payload.can_pick_up,
            created_by=actor_user_id,
        )
        db.add(relationship)
        await db.flush()
        db.add(_audit(
            school_id,
            actor_user_id,
            "guardian_linked_to_student",
            "student_guardian",
            relationship.id,
            student_id=student.id,
            guardian_profile_id=profile.id,
        ))

        invitation_created = False
        email_task: GuardianEmailTask | None = None
        has_valid_invitation = (
            membership.invite_token is not None
            and membership.invite_token_expires is not None
            and membership.invite_token_expires.replace(tzinfo=timezone.utc) > now
        )
        if not membership.is_active and not has_valid_invitation:
            invite_token = create_invite_token(str(membership.id))
            membership.invite_token = invite_token
            membership.invite_token_expires = now + timedelta(hours=settings.INVITE_TOKEN_EXPIRE_HOURS)
            invitation_created = True
            invite_link = f"{settings.FRONTEND_URL}/set-password?token={invite_token}"
            email_task = GuardianEmailTask(
                kind="new_account" if user_was_created else "school_linked",
                to_email=user.email,
                to_name=user.name,
                school_name=school.name,
                invite_link=invite_link,
                temp_password=temp_password,
            )
            db.add(_audit(
                school_id,
                actor_user_id,
                "parent_invitation_created",
                "school_membership",
                membership.id,
            ))

        await db.commit()
        await db.refresh(profile)
        await db.refresh(membership)
        await db.refresh(relationship)
        return GuardianInviteResult(
            guardian_profile=profile,
            membership=membership,
            user=user,
            relationship=relationship,
            invitation_created=invitation_created,
            email_task=email_task,
        )
    except HTTPException:
        await db.rollback()
        raise
    except IntegrityError as exc:
        await db.rollback()
        raise _conflict("Guardian relationship could not be created because it conflicts with existing data") from exc
    except Exception:
        await db.rollback()
        raise
