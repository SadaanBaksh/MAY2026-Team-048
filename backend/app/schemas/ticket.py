from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import CostResponsibility, MediaType, Priority, TicketStatus
from app.schemas.ticket_media import TicketMediaRead


class TicketBase(BaseModel):
    title: str
    category_id: str
    resident_note: str = ""
    image_url: str | None = None
    media_type: MediaType | None = None
    voice_note_url: str | None = None
    voice_note_duration_sec: int | None = None


class TicketCreate(TicketBase):
    priority: Priority | None = None
    ai_description: str | None = None
    ai_confidence: float | None = None
    photo_urls: list[str] = []


class TicketUpdate(BaseModel):
    category_id: str | None = None
    worker_id: str | None = None
    priority: Priority | None = None
    status: TicketStatus | None = None
    cost_responsibility: CostResponsibility | None = None
    resolution_remarks: str | None = None
    resolution_proof_url: str | None = None
    resident_rating: int | None = None
    resident_feedback: str | None = None


class TicketRead(TicketBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    resident_id: str
    worker_id: str | None
    ai_description: str
    ai_confidence: float
    priority: Priority
    status: TicketStatus
    cost_responsibility: CostResponsibility
    date_of_request: datetime
    date_of_resolution: datetime | None
    resolution_remarks: str | None
    resolution_proof_url: str | None
    resident_rating: int | None
    resident_feedback: str | None
    is_overdue: bool
    media: list[TicketMediaRead] = []
