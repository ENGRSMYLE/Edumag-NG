import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SchoolTermEnum(str, enum.Enum):
    first = "first"
    second = "second"
    third = "third"


class SchoolTerm(Base):
    __tablename__ = "school_terms"
    __table_args__ = (
        UniqueConstraint(
            "school_id",
            "academic_session",
            "term",
            name="uq_school_term_session",
        ),
        Index("ix_school_terms_school_id", "school_id"),
        Index("ix_school_terms_is_current", "is_current"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False,
    )
    academic_session: Mapped[str] = mapped_column(String(20), nullable=False)
    term: Mapped[SchoolTermEnum] = mapped_column(
        Enum(SchoolTermEnum, name="school_term_enum"), nullable=False
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
