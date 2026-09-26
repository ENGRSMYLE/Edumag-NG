"""Add tenant-bound Web Push subscriptions.

Revision ID: 013
Revises: 012
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "push_subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("endpoint", sa.String(length=2048), nullable=False),
        sa.Column("p256dh_key", sa.String(length=255), nullable=False),
        sa.Column("auth_key", sa.String(length=255), nullable=False),
        sa.Column("user_agent", sa.String(length=1000), nullable=True),
        sa.Column("device_name", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("failure_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_success_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_failure_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(
            ["user_id", "school_id"],
            ["school_memberships.user_id", "school_memberships.school_id"],
            name="fk_push_subscriptions_user_school_membership",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("endpoint", name="uq_push_subscriptions_endpoint"),
        sa.CheckConstraint("failure_count >= 0", name="ck_push_subscriptions_failure_count_nonnegative"),
    )
    op.create_index("ix_push_subscriptions_user_active", "push_subscriptions", ["user_id", "is_active"])
    op.create_index("ix_push_subscriptions_school_active", "push_subscriptions", ["school_id", "is_active"])


def downgrade() -> None:
    op.drop_index("ix_push_subscriptions_school_active", table_name="push_subscriptions")
    op.drop_index("ix_push_subscriptions_user_active", table_name="push_subscriptions")
    op.drop_table("push_subscriptions")
