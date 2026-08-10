from datetime import datetime, timezone

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.models.mixins import UUIDPKMixin


class Notification(UUIDPKMixin, Base):
    __tablename__ = "notifications"
    __table_args__ = (
        CheckConstraint(
            "(CASE WHEN ticket_id IS NOT NULL THEN 1 ELSE 0 END + "
            "CASE WHEN public_service_id IS NOT NULL THEN 1 ELSE 0 END + "
            "CASE WHEN notice_id IS NOT NULL THEN 1 ELSE 0 END) <= 1",
            name="ck_notification_single_target",
        ),
        UniqueConstraint("user_id", "notice_id", name="uq_notification_user_notice"),
    )

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    ticket_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("tickets.id"), nullable=True
    )
    public_service_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("public_services.id"), nullable=True
    )
    notice_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("notices.id"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
