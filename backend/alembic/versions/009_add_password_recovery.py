"""Add secure password recovery tables.

Revision ID: 009
Revises: 008
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_password_reset_tokens_hash", "password_reset_tokens", ["token_hash"], unique=True)
    op.create_index("ix_password_reset_tokens_user", "password_reset_tokens", ["user_id", "created_at"])
    op.create_table(
        "password_reset_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("identity_hash", sa.String(length=64), nullable=False),
        sa.Column("requester_ip", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_password_reset_attempts_identity_created",
        "password_reset_attempts",
        ["identity_hash", "created_at"],
    )
    op.create_index(
        "ix_password_reset_attempts_ip_created",
        "password_reset_attempts",
        ["requester_ip", "created_at"],
    )


def downgrade() -> None:
    op.drop_table("password_reset_attempts")
    op.drop_table("password_reset_tokens")
