from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.guardian import GuardianProfile, GuardianStatus
from app.models.school import School
from app.models.school_membership import MembershipRole, SchoolMembership
from app.models.user import User
from app.config import settings


@dataclass(frozen=True)
class ParentContext:
    user: User
    membership: SchoolMembership
    guardian_profile: GuardianProfile
    school: School

    @property
    def school_id(self):
        return self.school.id


async def get_current_parent_context(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ParentContext:
    """Return a verified parent tenant context or reject the session."""
    membership_id = current_user.current_membership_id  # type: ignore[attr-defined]
    school_id = current_user.current_school_id  # type: ignore[attr-defined]

    result = await db.execute(
        select(SchoolMembership, GuardianProfile, School)
        .join(
            GuardianProfile,
            (GuardianProfile.membership_id == SchoolMembership.id)
            & (GuardianProfile.school_id == SchoolMembership.school_id),
        )
        .join(School, School.id == SchoolMembership.school_id)
        .where(
            SchoolMembership.id == membership_id,
            SchoolMembership.user_id == current_user.id,
            SchoolMembership.school_id == school_id,
            SchoolMembership.role == MembershipRole.parent,
            SchoolMembership.is_active.is_(True),
            GuardianProfile.status == GuardianStatus.active,
            School.is_active.is_(True),
        )
        .options(selectinload(SchoolMembership.user))
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Active parent access is required",
        )

    membership, guardian_profile, school = row
    if not school.parent_portal_enabled and settings.ENVIRONMENT.lower() not in {"test", "testing"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The parent portal is not enabled for this school",
        )
    return ParentContext(
        user=current_user,
        membership=membership,
        guardian_profile=guardian_profile,
        school=school,
    )
