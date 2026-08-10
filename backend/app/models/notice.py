from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.enums import NoticeStatus
from app.models.mixins import UUIDPKMixin


class Notice(UUIDPKMixin, Base):
    __tablename__ = "notices"

    created_by_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    brief_points: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    status: Mapped[NoticeStatus] = mapped_column(
        Enum(NoticeStatus), nullable=False, default=NoticeStatus.Draft, index=True
    )
    timezone: Mapped[str] = mapped_column(String(100), nullable=False, default="UTC")
    scheduled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    recipient_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    targets: Mapped[list["NoticeTarget"]] = relationship(
        back_populates="notice", cascade="all, delete-orphan"
    )


class NoticeTarget(UUIDPKMixin, Base):
    __tablename__ = "notice_targets"
    __table_args__ = (
        UniqueConstraint("notice_id", "building", name="uq_notice_target_building"),
    )

    notice_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("notices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    building: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    notice: Mapped["Notice"] = relationship(back_populates="targets")
