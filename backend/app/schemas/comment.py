from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

# `message` is an unbounded `Text` column in the DB, so there's no length-constraint crash risk
# — but nothing stopped a client submitting an arbitrarily large blob either. Capped at a
# generous but sane size to close that off.
MESSAGE_MAX_LENGTH = 4000


class CommentCreate(BaseModel):
    message: str

    @field_validator("message")
    @classmethod
    def validate_message_length(cls, value: str) -> str:
        if len(value) > MESSAGE_MAX_LENGTH:
            raise ValueError(f"Message must be {MESSAGE_MAX_LENGTH} characters or fewer.")
        return value


class CommentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    ticket_id: str
    user_id: str
    message: str
    posted_at: datetime
