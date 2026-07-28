from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.enums import CostResponsibility, MediaType, Priority, TicketStatus
from app.models.mixins import UUIDPKMixin


class Ticket(UUIDPKMixin, Base):
    __tablename__ = "tickets"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    resident_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    worker_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    category_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("categories.id"), nullable=False
    )

    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    media_type: Mapped[MediaType | None] = mapped_column(Enum(MediaType), nullable=True)
    resident_note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    voice_note_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    voice_note_duration_sec: Mapped[int | None] = mapped_column(Integer, nullable=True)

    ai_description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    ai_confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    priority: Mapped[Priority] = mapped_column(Enum(Priority), nullable=False)
    status: Mapped[TicketStatus] = mapped_column(
        Enum(TicketStatus), nullable=False, default=TicketStatus.Pending
    )
    cost_responsibility: Mapped[CostResponsibility] = mapped_column(
        Enum(CostResponsibility), nullable=False, default=CostResponsibility.Pending_Review
    )

    date_of_request: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    date_of_resolution: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    resolution_remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolution_proof_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    resident_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    resident_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_overdue: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    media: Mapped[list["TicketMedia"]] = relationship(  # noqa: F821
        back_populates="ticket", cascade="all, delete-orphan"
    )
    history: Mapped[list["TicketHistory"]] = relationship(  # noqa: F821
        back_populates="ticket", cascade="all, delete-orphan"
    )
    comments: Mapped[list["Comment"]] = relationship(  # noqa: F821
        back_populates="ticket", cascade="all, delete-orphan"
    )
