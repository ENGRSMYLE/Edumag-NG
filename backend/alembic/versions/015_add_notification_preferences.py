"""Add tenant-scoped notification preferences.

Revision ID: 015
Revises: 014
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "notifications",
        sa.Column("is_in_app_visible", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    event_enum = postgresql.ENUM(name="domain_event_type_enum", create_type=False)
    op.create_table(
        "notification_preferences",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", event_enum, nullable=False),
        sa.Column("in_app_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("push_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("email_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("sms_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("whatsapp_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "school_id", "event_type", name="uq_notification_preference_user_school_event"),
    )
    op.create_index("ix_notification_preferences_user_school", "notification_preferences", ["user_id", "school_id"])
    op.create_index("ix_notification_preferences_school_event", "notification_preferences", ["school_id", "event_type"])


def downgrade() -> None:
    op.drop_index("ix_notification_preferences_school_event", table_name="notification_preferences")
    op.drop_index("ix_notification_preferences_user_school", table_name="notification_preferences")
    op.drop_table("notification_preferences")
    op.drop_column("notifications", "is_in_app_visible")
