"""Add persistent school report settings.

Revision ID: 004
Revises: 003
Create Date: 2026-09-24 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("schools", sa.Column("motto", sa.String(length=255), nullable=True))
    op.add_column(
        "schools", sa.Column("report_header", sa.String(length=500), nullable=True)
    )
    op.add_column(
        "schools",
        sa.Column(
            "report_logo_position",
            sa.String(length=10),
            server_default="center",
            nullable=False,
        ),
    )
    op.create_check_constraint(
        "ck_schools_report_logo_position",
        "schools",
        "report_logo_position IN ('left', 'center', 'right')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_schools_report_logo_position", "schools", type_="check"
    )
    op.drop_column("schools", "report_logo_position")
    op.drop_column("schools", "report_header")
    op.drop_column("schools", "motto")
