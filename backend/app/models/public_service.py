from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.enums import Priority, PublicServiceStatus
from app.models.mixins import UUIDPKMixin


class PublicService(UUIDPKMixin, Base):
    """An actionable public-service page.

    A resident submission creates a page with one PublicReport. Accepting a duplicate
    suggestion creates a new page, moves both pages' reports/comments to it, and leaves
    the source pages as immutable redirects through ``merged_into_id``.
    """

    __tablename__ = "public_services"

    created_by_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    worker_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True, index=True
    )
    category_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("categories.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str] = mapped_column(String(300), nullable=False)
    ai_summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    priority: Mapped[Priority] = mapped_column(Enum(Priority), nullable=False)
    status: Mapped[PublicServiceStatus] = mapped_column(
        Enum(PublicServiceStatus), nullable=False, default=PublicServiceStatus.Pending, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolution_proof_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    merged_into_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("public_services.id"), nullable=True, index=True
    )

    reports: Mapped[list["PublicReport"]] = relationship(  # noqa: F821
        back_populates="service",
        cascade="all, delete-orphan",
        foreign_keys="PublicReport.service_id",
    )
    comments: Mapped[list["PublicServiceComment"]] = relationship(  # noqa: F821
        back_populates="service",
        cascade="all, delete-orphan",
        foreign_keys="PublicServiceComment.service_id",
    )
    history: Mapped[list["PublicServiceHistory"]] = relationship(  # noqa: F821
        back_populates="service", cascade="all, delete-orphan"
    )


class PublicReport(UUIDPKMixin, Base):
    """The resident-authored complaint retained inside a public service page."""

    __tablename__ = "public_reports"

    service_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("public_services.id"), nullable=False, index=True
    )
    # The page this report was first moved off of by a merge; lets an employee unmerge.
    original_service_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("public_services.id"), nullable=True
    )
    author_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str] = mapped_column(String(300), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    service: Mapped["PublicService"] = relationship(
        back_populates="reports", foreign_keys=[service_id]
    )
    author: Mapped["User"] = relationship()  # noqa: F821
    media: Mapped[list["PublicReportMedia"]] = relationship(  # noqa: F821
        back_populates="report", cascade="all, delete-orphan"
    )


class PublicReportMedia(UUIDPKMixin, Base):
    __tablename__ = "public_report_media"

    report_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("public_reports.id"), nullable=False, index=True
    )
    media_url: Mapped[str] = mapped_column(String(500), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    report: Mapped["PublicReport"] = relationship(back_populates="media")
