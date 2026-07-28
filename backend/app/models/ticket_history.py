from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.enums import TicketStatus
from app.models.mixins import UUIDPKMixin


class TicketHistory(UUIDPKMixin, Base):
    __tablename__ = "ticket_history"

    ticket_id: Mapped[str] = mapped_column(String(36), ForeignKey("tickets.id"), nullable=False)
    old_status: Mapped[TicketStatus | None] = mapped_column(Enum(TicketStatus), nullable=True)
    new_status: Mapped[TicketStatus] = mapped_column(Enum(TicketStatus), nullable=False)
    remarks: Mapped[str] = mapped_column(Text, nullable=False, default="")
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    actor_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )

    ticket: Mapped["Ticket"] = relationship(back_populates="history")  # noqa: F821
