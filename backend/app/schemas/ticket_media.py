from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import MediaType


class TicketMediaCreate(BaseModel):
    media_url: str
    media_type: MediaType


class TicketMediaRead(TicketMediaCreate):
    model_config = ConfigDict(from_attributes=True)

    id: str
    ticket_id: str
    uploaded_at: datetime
