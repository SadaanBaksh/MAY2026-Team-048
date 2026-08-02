from pydantic import BaseModel, Field, HttpUrl, field_validator

from app.models.enums import Priority


class ComplaintAnalysisRequest(BaseModel):
    resident_note: str = Field(default="", max_length=4000)
    photo_urls: list[HttpUrl] = Field(default_factory=list, max_length=3)
    voice_note_url: HttpUrl | None = None


class ComplaintAnalysisRead(BaseModel):
    ai_description: str
    category_id: str
    priority: Priority
    confidence: float = Field(ge=0, le=1)


class ChatTurn(BaseModel):
    role: str
    text: str = Field(max_length=600)

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        if value not in {"resident", "assistant"}:
            raise ValueError("role must be resident or assistant")
        return value


class ResidentChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=500)
    history: list[ChatTurn] = Field(default_factory=list, max_length=6)


class ResidentChatRead(BaseModel):
    reply: str
    related_ticket_id: str | None = None
    suggestions: list[str] = Field(default_factory=list, max_length=3)


class DashboardSummaryRead(BaseModel):
    summary: str
