from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import CostResponsibility, MediaType, Priority, TicketStatus
from app.schemas.ticket_media import TicketMediaRead

# Matches the `tickets.title` column's `String(200)` limit (models/ticket.py) — without this,
# an overlong title hits a raw Postgres length-constraint error (500) instead of a clean 422.
TITLE_MAX_LENGTH = 200

# `resident_note` / `resolution_remarks` / `resident_feedback` are unbounded `Text` columns in
# the DB, so there's no length-constraint crash risk — but nothing stopped a client submitting an
# arbitrarily large blob either. Capped at a generous but sane size to close that off.
FREE_TEXT_MAX_LENGTH = 4000


def _max_length_validator(field_label: str, max_length: int):
    def _validate(value: str | None) -> str | None:
        if value is not None and len(value) > max_length:
            raise ValueError(f"{field_label} must be {max_length} characters or fewer.")
        return value

    return _validate


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

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        return _max_length_validator("Title", TITLE_MAX_LENGTH)(value)

    @field_validator("resident_note")
    @classmethod
    def validate_resident_note(cls, value: str) -> str:
        return _max_length_validator("Note", FREE_TEXT_MAX_LENGTH)(value)


class TicketUpdate(BaseModel):
    category_id: str | None = None
    worker_id: str | None = None
    priority: Priority | None = None
    status: TicketStatus | None = None
    cost_responsibility: CostResponsibility | None = None
    resolution_remarks: str | None = None
    resolution_proof_url: str | None = None
    # A resident-submitted rating with no bounds could previously be any integer at all (e.g.
    # 999999), which would silently corrupt the worker-rating average computed in tickets.py.
    resident_rating: int | None = Field(default=None, ge=1, le=5)
    resident_feedback: str | None = None

    @field_validator("resolution_remarks")
    @classmethod
    def validate_resolution_remarks(cls, value: str | None) -> str | None:
        return _max_length_validator("Resolution remarks", FREE_TEXT_MAX_LENGTH)(value)

    @field_validator("resident_feedback")
    @classmethod
    def validate_resident_feedback(cls, value: str | None) -> str | None:
        return _max_length_validator("Feedback", FREE_TEXT_MAX_LENGTH)(value)


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
