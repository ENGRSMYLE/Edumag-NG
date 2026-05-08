"""Fix target_audience enum — replace students/parents/teachers with admin/teacher

Revision ID: 003
Revises: 002
Create Date: 2026-05-07 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Step 1: change column to plain text so we can drop the old enum type
    op.execute(
        "ALTER TABLE announcements ALTER COLUMN target_audience TYPE VARCHAR(50) USING target_audience::text"
    )

    # Step 2: drop the old PostgreSQL enum type
    op.execute("DROP TYPE IF EXISTS target_audience_enum")

    # Step 3: remap any legacy values that might exist in the DB
    op.execute("UPDATE announcements SET target_audience = 'teacher' WHERE target_audience = 'teachers'")
    op.execute("UPDATE announcements SET target_audience = 'all' WHERE target_audience IN ('parents', 'students')")

    # Step 4: create the new enum with correct values
    new_enum = postgresql.ENUM("all", "admin", "teacher", name="target_audience_enum", create_type=True)
    new_enum.create(op.get_bind())

    # Step 5: cast the column back to the new enum type
    op.execute(
        "ALTER TABLE announcements ALTER COLUMN target_audience TYPE target_audience_enum "
        "USING target_audience::target_audience_enum"
    )


def downgrade() -> None:
    # Reverse: back to old 4-value enum (data loss for 'admin' rows, maps to 'teachers')
    op.execute(
        "ALTER TABLE announcements ALTER COLUMN target_audience TYPE VARCHAR(50) USING target_audience::text"
    )
    op.execute("DROP TYPE IF EXISTS target_audience_enum")
    op.execute("UPDATE announcements SET target_audience = 'teachers' WHERE target_audience = 'teacher'")
    op.execute("UPDATE announcements SET target_audience = 'all' WHERE target_audience = 'admin'")

    old_enum = postgresql.ENUM("all", "teachers", "parents", "students", name="target_audience_enum", create_type=True)
    old_enum.create(op.get_bind())
    op.execute(
        "ALTER TABLE announcements ALTER COLUMN target_audience TYPE target_audience_enum "
        "USING target_audience::target_audience_enum"
    )
