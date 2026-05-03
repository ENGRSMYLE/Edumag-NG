"""Add email_verifications table

Revision ID: 002
Revises: 001
Create Date: 2026-05-03 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "CREATE TYPE verification_purpose AS ENUM ('signup', 'password_reset')"
    )

    op.create_table(
        "email_verifications",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("otp_hash", sa.String(255), nullable=False),
        sa.Column(
            "purpose",
            postgresql.ENUM(
                "signup",
                "password_reset",
                name="verification_purpose",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("is_used", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    op.create_index(
        "ix_email_verifications_email",
        "email_verifications",
        ["email"],
    )
    op.create_index(
        "ix_email_verifications_email_purpose_used",
        "email_verifications",
        ["email", "purpose", "is_used"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_email_verifications_email_purpose_used",
        table_name="email_verifications",
    )
    op.drop_index(
        "ix_email_verifications_email",
        table_name="email_verifications",
    )
    op.drop_table("email_verifications")
    op.execute("DROP TYPE verification_purpose")
