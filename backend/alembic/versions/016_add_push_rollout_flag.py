"""Add per-school push notification rollout flag.

Revision ID: 016
Revises: 015
"""

from alembic import op
import sqlalchemy as sa


revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Deliberately disabled for every school. Rollout is an explicit action.
    op.add_column(
        "schools",
        sa.Column(
            "push_notifications_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("schools", "push_notifications_enabled")
