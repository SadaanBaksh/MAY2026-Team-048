"""Import all models so Alembic's autogenerate can see them via Base.metadata."""

from app.db.base_class import Base  # noqa: F401
from app.models import (  # noqa: F401
    Apartment,
    Category,
    Comment,
    Notification,
    Ticket,
    TicketHistory,
    TicketMedia,
    User,
)
