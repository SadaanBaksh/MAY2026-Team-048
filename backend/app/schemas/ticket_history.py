from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import TicketStatus


class TicketHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    ticket_id: str
    old_status: TicketStatus | None
    new_status: TicketStatus
    remarks: str
    changed_at: datetime
    actor_id: str | None
