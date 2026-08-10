from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.models.enums import SimilaritySuggestionStatus
from app.models.mixins import UUIDPKMixin


class PublicSimilaritySuggestion(UUIDPKMixin, Base):
    __tablename__ = "public_similarity_suggestions"
    __table_args__ = (
        UniqueConstraint("service_a_id", "service_b_id", name="uq_public_similarity_pair"),
    )

    service_a_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("public_services.id"), nullable=False, index=True
    )
    service_b_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("public_services.id"), nullable=False, index=True
    )
    score: Mapped[float] = mapped_column(Float, nullable=False)
    rationale: Mapped[str] = mapped_column(Text, nullable=False, default="")
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[SimilaritySuggestionStatus] = mapped_column(
        Enum(SimilaritySuggestionStatus),
        nullable=False,
        default=SimilaritySuggestionStatus.Pending,
        index=True,
    )
    reviewed_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    merged_service_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("public_services.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
