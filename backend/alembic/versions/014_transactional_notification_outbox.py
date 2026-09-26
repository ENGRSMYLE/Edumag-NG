"""Add channel and delivery lifecycle to notification outbox.

Revision ID: 014
Revises: 013
"""

from alembic import op
import sqlalchemy as sa


revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("ix_notification_outbox_pending", table_name="notification_outbox")
    op.alter_column("notification_outbox", "attempts", new_column_name="attempt_count")
    op.add_column("notification_outbox", sa.Column("channel", sa.String(20), nullable=False, server_default="push"))
    op.add_column("notification_outbox", sa.Column("status", sa.String(20), nullable=False, server_default="pending"))
    op.add_column("notification_outbox", sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("notification_outbox", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    op.execute("UPDATE notification_outbox SET status = 'delivered' WHERE processed_at IS NOT NULL")
    op.drop_constraint("notification_outbox_notification_id_key", "notification_outbox", type_="unique")
    op.create_unique_constraint("uq_notification_outbox_notification_channel", "notification_outbox", ["notification_id", "channel"])
    op.create_check_constraint("ck_notification_outbox_attempt_count_nonnegative", "notification_outbox", "attempt_count >= 0")
    op.create_check_constraint("ck_notification_outbox_channel", "notification_outbox", "channel IN ('push')")
    op.create_check_constraint("ck_notification_outbox_status", "notification_outbox", "status IN ('pending', 'processing', 'delivered', 'retry', 'failed')")
    op.create_index("ix_notification_outbox_claim", "notification_outbox", ["status", "available_at", "locked_at"])
    op.create_index("ix_notification_outbox_notification", "notification_outbox", ["notification_id"])


def downgrade() -> None:
    op.drop_index("ix_notification_outbox_notification", table_name="notification_outbox")
    op.drop_index("ix_notification_outbox_claim", table_name="notification_outbox")
    op.drop_constraint("ck_notification_outbox_status", "notification_outbox", type_="check")
    op.drop_constraint("ck_notification_outbox_channel", "notification_outbox", type_="check")
    op.drop_constraint("ck_notification_outbox_attempt_count_nonnegative", "notification_outbox", type_="check")
    op.drop_constraint("uq_notification_outbox_notification_channel", "notification_outbox", type_="unique")
    op.create_unique_constraint("notification_outbox_notification_id_key", "notification_outbox", ["notification_id"])
    op.drop_column("notification_outbox", "updated_at")
    op.drop_column("notification_outbox", "locked_at")
    op.drop_column("notification_outbox", "status")
    op.drop_column("notification_outbox", "channel")
    op.alter_column("notification_outbox", "attempt_count", new_column_name="attempts")
    op.create_index("ix_notification_outbox_pending", "notification_outbox", ["processed_at", "available_at"])
