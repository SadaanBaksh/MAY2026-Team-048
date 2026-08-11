from datetime import datetime, timezone

from sqlalchemy import Enum, Float, ForeignKey, Integer, String, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.enums import AccountStatus, UserRole
from app.models.mixins import UUIDPKMixin


class User(UUIDPKMixin, Base):
    __tablename__ = "users"

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    phone: Mapped[str] = mapped_column(String(30), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    avatar_color: Mapped[str] = mapped_column(String(20), nullable=False, default="#6366F1")
    avatar_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)
    account_status: Mapped[AccountStatus] = mapped_column(
        Enum(AccountStatus), nullable=False, default=AccountStatus.pending
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Resident-only
    apartment_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("apartments.id"), nullable=True
    )
    apartment: Mapped["Apartment | None"] = relationship(back_populates="residents", lazy="joined")  # noqa: F821

    @property
    def building(self) -> str | None:
        return self.apartment.building if self.apartment else None

    @property
    def unit_number(self) -> str | None:
        return self.apartment.unit_number if self.apartment else None

    # Facility employee / facility manager
    title: Mapped[str | None] = mapped_column(String(150), nullable=True)

    # Maintenance staff only
    specialization: Mapped[str | None] = mapped_column(String(150), nullable=True)
    active_jobs: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.0)
