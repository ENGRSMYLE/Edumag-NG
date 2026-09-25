"""Add message threads and per-recipient delivery state.

Revision ID: 005
Revises: 004
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("thread_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("messages", sa.Column("parent_message_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_messages_parent", "messages", "messages", ["parent_message_id"], ["id"], ondelete="SET NULL")
    op.execute("UPDATE messages SET thread_id = id WHERE thread_id IS NULL")
    op.alter_column("messages", "thread_id", nullable=False)
    op.create_index("ix_messages_thread_id", "messages", ["thread_id"])

    op.create_table(
        "message_recipients",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("message_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("messages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.UniqueConstraint("message_id", "user_id", name="uq_message_recipient"),
    )
    op.create_index("ix_message_recipients_user_read", "message_recipients", ["user_id", "is_read"])
    op.create_index("ix_message_recipients_message_id", "message_recipients", ["message_id"])
    op.execute("""
        INSERT INTO message_recipients (id, message_id, user_id, is_read)
        SELECT gen_random_uuid(), id, recipient_id, is_read FROM messages
        WHERE recipient_id IS NOT NULL
    """)
    op.alter_column("messages", "recipient_id", nullable=True)


def downgrade() -> None:
    op.execute("""
        UPDATE messages m SET recipient_id = mr.user_id, is_read = mr.is_read
        FROM message_recipients mr WHERE mr.message_id = m.id
        AND mr.id = (SELECT id FROM message_recipients WHERE message_id = m.id ORDER BY id LIMIT 1)
    """)
    op.alter_column("messages", "recipient_id", nullable=False)
    op.drop_table("message_recipients")
    op.drop_index("ix_messages_thread_id", table_name="messages")
    op.drop_constraint("fk_messages_parent", "messages", type_="foreignkey")
    op.drop_column("messages", "parent_message_id")
    op.drop_column("messages", "thread_id")
