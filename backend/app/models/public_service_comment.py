from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.mixins import UUIDPKMixin


class PublicServiceComment(UUIDPKMixin, Base):
    __tablename__ = "public_service_comments"

    service_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("public_services.id"), nullable=False, index=True
    )
    # The page this comment was first moved off of by a merge; lets an employee unmerge.
    original_service_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("public_services.id"), nullable=True
    )
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    posted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    service: Mapped["PublicService"] = relationship(  # noqa: F821
        back_populates="comments", foreign_keys=[service_id]
    )
    user: Mapped["User"] = relationship()  # noqa: F821
