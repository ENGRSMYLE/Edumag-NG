"""Add in-app notifications and delivery outbox.

Revision ID: 010
Revises: 009
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None

EVENTS = (
    "parent_linked",
    "message_received",
    "result_published",
    "student_absent",
    "assignment_created",
    "fee_reminder",
    "announcement_published",
)


def upgrade():
    bind = op.get_bind()
    # A failed or manual earlier deploy can leave this shared type behind.
    # Create it once, then stop create_table from issuing CREATE TYPE again.
    postgresql.ENUM(*EVENTS, name="domain_event_type_enum").create(
        bind, checkfirst=True
    )
    event_enum = postgresql.ENUM(
        *EVENTS, name="domain_event_type_enum", create_type=False
    )

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", event_enum, nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("data", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_notifications_user_read_created", "notifications", ["user_id", "is_read", "created_at"])
    op.create_index("ix_notifications_school_user", "notifications", ["school_id", "user_id"])

    op.create_table(
        "notification_outbox",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("notification_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("notifications.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("event_type", event_enum, nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("processed_at", sa.DateTime(timezone=True)),
        sa.Column("last_error", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_notification_outbox_pending", "notification_outbox", ["processed_at", "available_at"])


def downgrade():
    op.drop_table("notification_outbox")
    op.drop_table("notifications")
    postgresql.ENUM(name="domain_event_type_enum").drop(
        op.get_bind(), checkfirst=True
    )
