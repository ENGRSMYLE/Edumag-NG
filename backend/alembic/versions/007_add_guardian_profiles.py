"""Add guardian profiles and many-to-many student relationships.

Revision ID: 007
Revises: 006
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    guardian_status = postgresql.ENUM(
        "invited",
        "active",
        "suspended",
        "disabled",
        name="guardian_status_enum",
        create_type=False,
    )
    contact_channel = postgresql.ENUM(
        "in_app",
        "email",
        "sms",
        "whatsapp",
        name="guardian_contact_channel_enum",
        create_type=False,
    )
    guardian_status.create(op.get_bind(), checkfirst=True)
    contact_channel.create(op.get_bind(), checkfirst=True)

    op.create_unique_constraint("uq_membership_id_school", "school_memberships", ["id", "school_id"])
    op.create_unique_constraint("uq_students_id_school", "students", ["id", "school_id"])

    op.create_table(
        "guardian_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("membership_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("address", sa.String(length=500), nullable=True),
        sa.Column("occupation", sa.String(length=255), nullable=True),
        sa.Column("status", guardian_status, server_default="invited", nullable=False),
        sa.Column("preferred_contact_channel", contact_channel, server_default="in_app", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("membership_id", name="uq_guardian_profiles_membership"),
        sa.UniqueConstraint("id", "school_id", name="uq_guardian_profiles_id_school"),
        sa.ForeignKeyConstraint(
            ["membership_id", "school_id"],
            ["school_memberships.id", "school_memberships.school_id"],
            name="fk_guardian_profiles_membership_school",
            ondelete="RESTRICT",
        ),
    )
    op.create_index("ix_guardian_profiles_school_status", "guardian_profiles", ["school_id", "status"])

    relationship_enum = postgresql.ENUM(
        "father", "mother", "guardian", "other",
        name="parent_relationship_enum",
        create_type=False,
    )
    op.create_table(
        "student_guardians",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("guardian_profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("relationship_type", relationship_enum, nullable=False),
        sa.Column("is_primary", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("is_emergency_contact", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("can_receive_messages", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("can_view_attendance", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("can_view_results", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("can_view_assignments", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("can_view_finance", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("can_pick_up", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("guardian_profile_id", "student_id", name="uq_guardian_student"),
        sa.ForeignKeyConstraint(
            ["guardian_profile_id", "school_id"],
            ["guardian_profiles.id", "guardian_profiles.school_id"],
            name="fk_student_guardians_profile_school",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["student_id", "school_id"],
            ["students.id", "students.school_id"],
            name="fk_student_guardians_student_school",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_student_guardians_profile_active", "student_guardians", ["guardian_profile_id", "is_active"])
    op.create_index("ix_student_guardians_student_active", "student_guardians", ["student_id", "is_active"])
    op.create_index("ix_student_guardians_school_student", "student_guardians", ["school_id", "student_id"])
    op.create_index(
        "uq_student_guardians_active_primary",
        "student_guardians",
        ["school_id", "student_id"],
        unique=True,
        postgresql_where=sa.text("is_primary AND is_active"),
    )


def downgrade() -> None:
    op.drop_table("student_guardians")
    op.drop_table("guardian_profiles")
    op.drop_constraint("uq_students_id_school", "students", type_="unique")
    op.drop_constraint("uq_membership_id_school", "school_memberships", type_="unique")
    postgresql.ENUM(name="guardian_contact_channel_enum").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="guardian_status_enum").drop(op.get_bind(), checkfirst=True)
