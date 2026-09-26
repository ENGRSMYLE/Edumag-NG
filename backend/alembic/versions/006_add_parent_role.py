"""Add parent membership role.

Revision ID: 006
Revises: 005
"""
from typing import Sequence, Union

from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # PostgreSQL enum additions must be committed before a later migration can
    # use the new value. Alembic otherwise wraps a fresh multi-revision upgrade
    # in one transaction and revision 012 fails when it compares role='parent'.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE role_enum ADD VALUE IF NOT EXISTS 'parent'")


def downgrade() -> None:
    # PostgreSQL cannot safely remove an enum value in place. Keeping the
    # unused value makes rollback non-destructive and preserves any parent
    # memberships created after this migration.
    pass
