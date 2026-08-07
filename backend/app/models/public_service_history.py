from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.enums import PublicServiceStatus
from app.models.mixins import UUIDPKMixin


class PublicServiceHistory(UUIDPKMixin, Base):
    __tablename__ = "public_service_history"

    service_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("public_services.id"), nullable=False, index=True
    )
    old_status: Mapped[PublicServiceStatus | None] = mapped_column(
        Enum(PublicServiceStatus), nullable=True
    )
    new_status: Mapped[PublicServiceStatus] = mapped_column(
        Enum(PublicServiceStatus), nullable=False
    )
    remarks: Mapped[str] = mapped_column(Text, nullable=False, default="")
    actor_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    service: Mapped["PublicService"] = relationship(back_populates="history")  # noqa: F821
