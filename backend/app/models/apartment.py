from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.mixins import UUIDPKMixin


class Apartment(UUIDPKMixin, Base):
    __tablename__ = "apartments"

    unit_number: Mapped[str] = mapped_column(String(50), nullable=False)
    building: Mapped[str] = mapped_column(String(100), nullable=False)

    residents: Mapped[list["User"]] = relationship(back_populates="apartment")  # noqa: F821
