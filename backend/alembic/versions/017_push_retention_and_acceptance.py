"""Track push retention metadata and provider acceptance accurately.

Revision ID: 017
Revises: 016
"""

from alembic import op
import sqlalchemy as sa


revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "push_subscriptions",
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.drop_constraint("ck_notification_outbox_status", "notification_outbox", type_="check")
    op.execute("UPDATE notification_outbox SET status = 'accepted' WHERE status = 'delivered'")
    op.create_check_constraint(
        "ck_notification_outbox_status",
        "notification_outbox",
        "status IN ('pending', 'processing', 'accepted', 'delivered', 'retry', 'failed')",
    )


def downgrade() -> None:
    op.execute("UPDATE notification_outbox SET status = 'delivered' WHERE status = 'accepted'")
    op.drop_constraint("ck_notification_outbox_status", "notification_outbox", type_="check")
    op.create_check_constraint(
        "ck_notification_outbox_status",
        "notification_outbox",
        "status IN ('pending', 'processing', 'delivered', 'retry', 'failed')",
    )
    op.drop_column("push_subscriptions", "expires_at")
