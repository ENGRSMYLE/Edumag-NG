"""Initial schema — all tables (multi-school architecture)

Revision ID: 001
Revises:
Create Date: 2026-04-29 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------ enums
    school_type_enum = postgresql.ENUM(
        "primary", "secondary", "both", name="school_type_enum", create_type=False
    )
    subscription_plan_enum = postgresql.ENUM(
        "free", "basic", "premium", name="subscription_plan_enum", create_type=False
    )
    role_enum = postgresql.ENUM(
        "super_admin", "admin", "teacher", name="role_enum", create_type=False
    )
    gender_enum = postgresql.ENUM(
        "male", "female", name="gender_enum", create_type=False
    )
    parent_relationship_enum = postgresql.ENUM(
        "father", "mother", "guardian", "other",
        name="parent_relationship_enum", create_type=False
    )
    term_enum = postgresql.ENUM(
        "first", "second", "third", name="term_enum", create_type=False
    )
    attendance_status_enum = postgresql.ENUM(
        "present", "absent", "late", "excused",
        name="attendance_status_enum", create_type=False
    )
    result_term_enum = postgresql.ENUM(
        "first", "second", "third", name="result_term_enum", create_type=False
    )
    payment_type_enum = postgresql.ENUM(
        "school_fees", "development_levy", "exam_fees", "other",
        name="payment_type_enum", create_type=False
    )
    payment_method_enum = postgresql.ENUM(
        "cash", "bank_transfer", "paystack", "pos",
        name="payment_method_enum", create_type=False
    )
    payment_status_enum = postgresql.ENUM(
        "pending", "confirmed", "failed", "reversed",
        name="payment_status_enum", create_type=False
    )
    payment_term_enum = postgresql.ENUM(
        "first", "second", "third", name="payment_term_enum", create_type=False
    )
    target_audience_enum = postgresql.ENUM(
        "all", "teachers", "parents", "students",
        name="target_audience_enum", create_type=False
    )
    school_term_enum = postgresql.ENUM(
        "first", "second", "third", name="school_term_enum", create_type=False
    )

    for enum_type in [
        school_type_enum, subscription_plan_enum, role_enum, gender_enum,
        parent_relationship_enum, term_enum, attendance_status_enum,
        result_term_enum, payment_type_enum, payment_method_enum,
        payment_status_enum, payment_term_enum, target_audience_enum,
        school_term_enum,
    ]:
        enum_type.create(op.get_bind(), checkfirst=True)

    # --------------------------------------------------------------- schools
    op.create_table(
        "schools",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("school_type", school_type_enum, nullable=False),
        sa.Column("address", sa.String(500), nullable=False),
        sa.Column("lga", sa.String(100), nullable=False),
        sa.Column("state", sa.String(100), nullable=False),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("logo_url", sa.String(500), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "subscription_plan", subscription_plan_enum,
            nullable=False, server_default="free"
        ),
        sa.Column("subscription_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text("now()")
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text("now()")
        ),
        sa.PrimaryKeyConstraint("id"),
        # No unique constraint on school email — same admin can run multiple schools
    )
    op.create_index("ix_schools_name", "schools", ["name"])

    # ----------------------------------------------------------------- users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("profile_photo_url", sa.String(500), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_first_login", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text("now()")
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text("now()")
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # --------------------------------------------------------------- classes
    op.create_table(
        "classes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("level", sa.String(50), nullable=False),
        sa.Column("arm", sa.String(10), nullable=True),
        sa.Column("teacher_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("capacity", sa.Integer(), nullable=False, server_default=sa.text("40")),
        sa.Column("academic_session", sa.String(20), nullable=False),
        sa.Column("term", term_enum, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text("now()")
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text("now()")
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["teacher_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_classes_school_id", "classes", ["school_id"])
    op.create_index("ix_classes_teacher_id", "classes", ["teacher_id"])

    # --------------------------------------------------- school_memberships
    op.create_table(
        "school_memberships",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", role_enum, nullable=False),
        sa.Column("class_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("invite_token", sa.String(512), nullable=True),
        sa.Column("invite_token_expires", sa.DateTime(timezone=True), nullable=True),
        sa.Column("invited_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text("now()")
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text("now()")
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "school_id", name="uq_user_school"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["invited_by"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_membership_user_id", "school_memberships", ["user_id"])
    op.create_index("ix_membership_school_id", "school_memberships", ["school_id"])
    op.create_index(
        "ix_membership_school_role", "school_memberships", ["school_id", "role"]
    )

    # -------------------------------------------------------------- students
    op.create_table(
        "students",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("admission_number", sa.String(50), nullable=False),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("middle_name", sa.String(100), nullable=True),
        sa.Column("date_of_birth", sa.Date(), nullable=False),
        sa.Column("gender", gender_enum, nullable=False),
        sa.Column("photo_url", sa.String(500), nullable=True),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("state_of_origin", sa.String(100), nullable=True),
        sa.Column("religion", sa.String(100), nullable=True),
        sa.Column("blood_group", sa.String(10), nullable=True),
        sa.Column("genotype", sa.String(10), nullable=True),
        sa.Column("class_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("admission_date", sa.Date(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text("now()")
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text("now()")
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_students_school_id", "students", ["school_id"])
    op.create_index("ix_students_class_id", "students", ["class_id"])
    op.create_index(
        "ix_students_school_admission", "students",
        ["school_id", "admission_number"], unique=True
    )

    # --------------------------------------------------------------- parents
    op.create_table(
        "parents",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("relationship", parent_relationship_enum, nullable=False),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("occupation", sa.String(255), nullable=True),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text("now()")
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text("now()")
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_parents_school_id", "parents", ["school_id"])
    op.create_index("ix_parents_student_id", "parents", ["student_id"])

    # ------------------------------------------------------------ attendance
    op.create_table(
        "attendance",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("class_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("status", attendance_status_enum, nullable=False),
        sa.Column("marked_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("note", sa.String(500), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text("now()")
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "school_id", "student_id", "date", name="uq_attendance_student_date"
        ),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["marked_by"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_attendance_school_id", "attendance", ["school_id"])
    op.create_index("ix_attendance_class_id", "attendance", ["class_id"])
    op.create_index("ix_attendance_student_id", "attendance", ["student_id"])
    op.create_index("ix_attendance_date", "attendance", ["date"])
    op.create_index("ix_attendance_marked_by", "attendance", ["marked_by"])

    # --------------------------------------------------------------- results
    op.create_table(
        "results",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("class_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject", sa.String(100), nullable=False),
        sa.Column("academic_session", sa.String(20), nullable=False),
        sa.Column("term", result_term_enum, nullable=False),
        sa.Column("ca_score", sa.Float(), nullable=True),
        sa.Column("exam_score", sa.Float(), nullable=True),
        sa.Column("total_score", sa.Float(), nullable=True),
        sa.Column("grade", sa.String(5), nullable=True),
        sa.Column("teacher_comment", sa.String(500), nullable=True),
        sa.Column(
            "is_approved", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("entered_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text("now()")
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text("now()")
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "school_id", "student_id", "subject", "academic_session", "term",
            name="uq_result_student_subject_term",
        ),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["approved_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["entered_by"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_results_school_id", "results", ["school_id"])
    op.create_index("ix_results_student_id", "results", ["student_id"])
    op.create_index("ix_results_class_id", "results", ["class_id"])
    op.create_index("ix_results_approved_by", "results", ["approved_by"])
    op.create_index("ix_results_entered_by", "results", ["entered_by"])

    # -------------------------------------------------------------- payments
    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount_kobo", sa.Integer(), nullable=False),
        sa.Column("payment_type", payment_type_enum, nullable=False),
        sa.Column("payment_method", payment_method_enum, nullable=False),
        sa.Column("academic_session", sa.String(20), nullable=False),
        sa.Column("term", payment_term_enum, nullable=False),
        sa.Column(
            "status", payment_status_enum, nullable=False, server_default="pending"
        ),
        sa.Column("reference", sa.String(100), nullable=False),
        sa.Column("paystack_reference", sa.String(100), nullable=True),
        sa.Column("confirmed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("recorded_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text("now()")
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text("now()")
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("reference", name="uq_payments_reference"),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["confirmed_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["recorded_by"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_payments_school_id", "payments", ["school_id"])
    op.create_index("ix_payments_student_id", "payments", ["student_id"])
    op.create_index("ix_payments_reference", "payments", ["reference"])
    op.create_index("ix_payments_confirmed_by", "payments", ["confirmed_by"])
    op.create_index("ix_payments_recorded_by", "payments", ["recorded_by"])

    # ----------------------------------------------------------- assignments
    op.create_table(
        "assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("class_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("teacher_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("subject", sa.String(100), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column(
            "max_score", sa.Float(), nullable=False, server_default=sa.text("100")
        ),
        sa.Column("file_url", sa.String(500), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text("now()")
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["teacher_id"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_assignments_school_id", "assignments", ["school_id"])
    op.create_index("ix_assignments_class_id", "assignments", ["class_id"])
    op.create_index("ix_assignments_teacher_id", "assignments", ["teacher_id"])

    # ------------------------------------------------ assignment_submissions
    op.create_table(
        "assignment_submissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("assignment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("feedback", sa.Text(), nullable=True),
        sa.Column("file_url", sa.String(500), nullable=True),
        sa.Column(
            "submitted_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text("now()")
        ),
        sa.Column("graded_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "assignment_id", "student_id", name="uq_submission_assignment_student"
        ),
        sa.ForeignKeyConstraint(
            ["assignment_id"], ["assignments.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "ix_submissions_assignment_id", "assignment_submissions", ["assignment_id"]
    )
    op.create_index(
        "ix_submissions_student_id", "assignment_submissions", ["student_id"]
    )

    # --------------------------------------------------------- announcements
    op.create_table(
        "announcements",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("target_audience", target_audience_enum, nullable=False),
        sa.Column("sent_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text("now()")
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sent_by"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_announcements_school_id", "announcements", ["school_id"])
    op.create_index("ix_announcements_sent_by", "announcements", ["sent_by"])

    # --------------------------------------------------------------- messages
    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sender_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("recipient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject", sa.String(255), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text("now()")
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recipient_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_messages_school_id", "messages", ["school_id"])
    op.create_index("ix_messages_sender_id", "messages", ["sender_id"])
    op.create_index("ix_messages_recipient_id", "messages", ["recipient_id"])
    op.create_index("ix_messages_is_read", "messages", ["is_read"])

    # ---------------------------------------------------------- school_terms
    op.create_table(
        "school_terms",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("academic_session", sa.String(20), nullable=False),
        sa.Column("term", school_term_enum, nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column(
            "is_current", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text("now()")
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "school_id", "academic_session", "term", name="uq_school_term_session"
        ),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_school_terms_school_id", "school_terms", ["school_id"])
    op.create_index("ix_school_terms_is_current", "school_terms", ["is_current"])

    # -------------------------------------------------------- grading_system
    op.create_table(
        "grading_system",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("grade", sa.String(5), nullable=False),
        sa.Column("min_score", sa.Float(), nullable=False),
        sa.Column("max_score", sa.Float(), nullable=False),
        sa.Column("remark", sa.String(100), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text("now()")
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_grading_system_school_id", "grading_system", ["school_id"])

    # -------------------------------------------------------- refresh_tokens
    op.create_table(
        "refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("membership_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "revoked", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text("now()")
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["membership_id"], ["school_memberships.id"], ondelete="CASCADE"
        ),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index(
        "ix_refresh_tokens_membership_id", "refresh_tokens", ["membership_id"]
    )
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"])


def downgrade() -> None:
    op.drop_table("refresh_tokens")
    op.drop_table("grading_system")
    op.drop_table("school_terms")
    op.drop_table("messages")
    op.drop_table("announcements")
    op.drop_table("assignment_submissions")
    op.drop_table("assignments")
    op.drop_table("payments")
    op.drop_table("results")
    op.drop_table("attendance")
    op.drop_table("parents")
    op.drop_table("students")
    op.drop_table("school_memberships")
    op.drop_table("classes")
    op.drop_table("users")
    op.drop_table("schools")

    for enum_name in [
        "school_term_enum",
        "target_audience_enum",
        "payment_term_enum",
        "payment_status_enum",
        "payment_method_enum",
        "payment_type_enum",
        "result_term_enum",
        "attendance_status_enum",
        "term_enum",
        "parent_relationship_enum",
        "gender_enum",
        "role_enum",
        "subscription_plan_enum",
        "school_type_enum",
    ]:
        sa.Enum(name=enum_name).drop(op.get_bind(), checkfirst=True)
