import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Enum, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class DomainEventType(str, enum.Enum):
    parent_linked = "parent_linked"
    message_received = "message_received"
    result_published = "result_published"
    student_absent = "student_absent"
    assignment_created = "assignment_created"
    fee_reminder = "fee_reminder"
    announcement_published = "announcement_published"

class NotificationChannel(str, enum.Enum):
    push = "push"

class OutboxStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    accepted = "accepted"
    # Kept temporarily so pre-migration rows can still be read.
    delivered = "delivered"
    retry = "retry"
    failed = "failed"

class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_user_read_created", "user_id", "is_read", "created_at"), Index("ix_notifications_school_user", "school_id", "user_id"))
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    event_type: Mapped[DomainEventType] = mapped_column(Enum(DomainEventType, name="domain_event_type_enum"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    is_in_app_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"
    __table_args__ = (
        UniqueConstraint("user_id", "school_id", "event_type", name="uq_notification_preference_user_school_event"),
        Index("ix_notification_preferences_user_school", "user_id", "school_id"),
        Index("ix_notification_preferences_school_event", "school_id", "event_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[DomainEventType] = mapped_column(
        Enum(DomainEventType, name="domain_event_type_enum", create_type=False), nullable=False
    )
    in_app_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    push_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    email_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    sms_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    whatsapp_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

class NotificationOutbox(Base):
    __tablename__ = "notification_outbox"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    notification_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("notifications.id", ondelete="CASCADE"), nullable=False)
    channel: Mapped[NotificationChannel] = mapped_column(Enum(NotificationChannel, native_enum=False, length=20), nullable=False, default=NotificationChannel.push, server_default="push")
    status: Mapped[OutboxStatus] = mapped_column(Enum(OutboxStatus, native_enum=False, length=20), nullable=False, default=OutboxStatus.pending, server_default="pending")
    event_type: Mapped[DomainEventType] = mapped_column(Enum(DomainEventType, name="domain_event_type_enum", create_type=False), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_notification_outbox_claim", "status", "available_at", "locked_at"),
        Index("ix_notification_outbox_notification", "notification_id"),
        UniqueConstraint("notification_id", "channel", name="uq_notification_outbox_notification_channel"),
        CheckConstraint("attempt_count >= 0", name="ck_notification_outbox_attempt_count_nonnegative"),
        CheckConstraint("channel IN ('push')", name="ck_notification_outbox_channel"),
        CheckConstraint("status IN ('pending', 'processing', 'accepted', 'delivered', 'retry', 'failed')", name="ck_notification_outbox_status"),
    )
