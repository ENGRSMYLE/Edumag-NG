import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.class_ import Class
    from app.models.student import Student
    from app.models.user import User


class ResultTerm(str, enum.Enum):
    first = "first"
    second = "second"
    third = "third"


class Result(Base):
    __tablename__ = "results"
    __table_args__ = (
        UniqueConstraint(
            "school_id",
            "student_id",
            "subject",
            "academic_session",
            "term",
            name="uq_result_student_subject_term",
        ),
        Index("ix_results_school_id", "school_id"),
        Index("ix_results_student_id", "student_id"),
        Index("ix_results_class_id", "class_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False,
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False,
    )
    class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("classes.id", ondelete="RESTRICT"),
        nullable=False,
    )
    subject: Mapped[str] = mapped_column(String(100), nullable=False)
    academic_session: Mapped[str] = mapped_column(String(20), nullable=False)
    term: Mapped[ResultTerm] = mapped_column(
        Enum(ResultTerm, name="result_term_enum"), nullable=False
    )
    ca_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    exam_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    grade: Mapped[str | None] = mapped_column(String(5), nullable=True)
    teacher_comment: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_approved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    entered_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    student: Mapped["Student"] = relationship("Student", foreign_keys=[student_id])
    class_: Mapped["Class"] = relationship("Class", foreign_keys=[class_id])
    approver: Mapped["User | None"] = relationship("User", foreign_keys=[approved_by])
    recorder: Mapped["User"] = relationship("User", foreign_keys=[entered_by])
