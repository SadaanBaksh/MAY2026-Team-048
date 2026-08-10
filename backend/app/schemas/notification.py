from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    ticket_id: str | None
    public_service_id: str | None
    notice_id: str | None
    title: str
    message: str
    is_read: bool
    created_at: datetime
