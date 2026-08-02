import uuid

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column


def generate_uuid() -> str:
    return str(uuid.uuid4())


class UUIDPKMixin:
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_uuid, index=True
    )
