import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.parent import ParentRelationship

if TYPE_CHECKING:
    from app.models.school_membership import SchoolMembership
    from app.models.student import Student
    from app.models.user import User


class GuardianStatus(str, enum.Enum):
    invited = "invited"
    active = "active"
    suspended = "suspended"
    disabled = "disabled"


class PreferredContactChannel(str, enum.Enum):
    in_app = "in_app"
    email = "email"
    sms = "sms"
    whatsapp = "whatsapp"


class GuardianProfile(Base):
    __tablename__ = "guardian_profiles"
    __table_args__ = (
        UniqueConstraint("membership_id", name="uq_guardian_profiles_membership"),
        UniqueConstraint("id", "school_id", name="uq_guardian_profiles_id_school"),
        ForeignKeyConstraint(
            ["membership_id", "school_id"],
            ["school_memberships.id", "school_memberships.school_id"],
            name="fk_guardian_profiles_membership_school",
            ondelete="RESTRICT",
        ),
        Index("ix_guardian_profiles_school_status", "school_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    membership_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    occupation: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[GuardianStatus] = mapped_column(
        Enum(GuardianStatus, name="guardian_status_enum"),
        nullable=False,
        default=GuardianStatus.invited,
        server_default=GuardianStatus.invited.value,
    )
    preferred_contact_channel: Mapped[PreferredContactChannel] = mapped_column(
        Enum(PreferredContactChannel, name="guardian_contact_channel_enum"),
        nullable=False,
        default=PreferredContactChannel.in_app,
        server_default=PreferredContactChannel.in_app.value,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    membership: Mapped["SchoolMembership"] = relationship(
        "SchoolMembership", back_populates="guardian_profile", foreign_keys=[membership_id, school_id]
    )
    student_links: Mapped[list["StudentGuardian"]] = relationship(
        "StudentGuardian", back_populates="guardian_profile", overlaps="guardian_links,student"
    )


class StudentGuardian(Base):
    __tablename__ = "student_guardians"
    __table_args__ = (
        UniqueConstraint("guardian_profile_id", "student_id", name="uq_guardian_student"),
        ForeignKeyConstraint(
            ["guardian_profile_id", "school_id"],
            ["guardian_profiles.id", "guardian_profiles.school_id"],
            name="fk_student_guardians_profile_school",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["student_id", "school_id"],
            ["students.id", "students.school_id"],
            name="fk_student_guardians_student_school",
            ondelete="RESTRICT",
        ),
        Index("ix_student_guardians_profile_active", "guardian_profile_id", "is_active"),
        Index("ix_student_guardians_student_active", "student_id", "is_active"),
        Index("ix_student_guardians_school_student", "school_id", "student_id"),
        Index(
            "uq_student_guardians_active_primary",
            "school_id",
            "student_id",
            unique=True,
            postgresql_where=text("is_primary AND is_active"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    guardian_profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    relationship_type: Mapped[ParentRelationship] = mapped_column(
        Enum(ParentRelationship, name="parent_relationship_enum"), nullable=False
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    is_emergency_contact: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    can_receive_messages: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    can_view_attendance: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    can_view_results: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    can_view_assignments: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    can_view_finance: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    can_pick_up: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    guardian_profile: Mapped["GuardianProfile"] = relationship(
        "GuardianProfile",
        back_populates="student_links",
        foreign_keys=[guardian_profile_id, school_id],
        overlaps="guardian_links,student",
    )
    student: Mapped["Student"] = relationship(
        "Student",
        back_populates="guardian_links",
        foreign_keys=[student_id, school_id],
        overlaps="guardian_profile,student_links",
    )
    creator: Mapped["User | None"] = relationship("User", foreign_keys=[created_by])
