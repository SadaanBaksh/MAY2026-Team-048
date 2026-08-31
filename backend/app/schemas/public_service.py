from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import Priority, PublicServiceStatus, SimilaritySuggestionStatus

TITLE_MAX_LENGTH = 200
DESCRIPTION_MAX_LENGTH = 4000
LOCATION_MAX_LENGTH = 300
COMMENT_MAX_LENGTH = 2000


class PublicServiceCreate(BaseModel):
    title: str = Field(min_length=3, max_length=TITLE_MAX_LENGTH)
    description: str = Field(min_length=3, max_length=DESCRIPTION_MAX_LENGTH)
    location: str = Field(min_length=2, max_length=LOCATION_MAX_LENGTH)
    category_id: str
    priority: Priority = Priority.Medium
    photo_urls: list[str] = Field(default_factory=list, max_length=3)

    @field_validator("title", "description", "location")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value must not be blank")
        return value


class PublicServiceUpdate(BaseModel):
    worker_id: str | None = None
    category_id: str | None = None
    priority: Priority | None = None
    status: PublicServiceStatus | None = None
    resolution_remarks: str | None = Field(default=None, max_length=DESCRIPTION_MAX_LENGTH)
    resolution_proof_url: str | None = None


class PublicReportMediaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    media_url: str
    uploaded_at: datetime


class PublicReportRead(BaseModel):
    id: str
    author_id: str
    author_name: str
    author_building: str | None
    title: str
    description: str
    location: str
    created_at: datetime
    media: list[PublicReportMediaRead] = []


class PublicServiceRead(BaseModel):
    id: str
    created_by_id: str
    creator_name: str
    creator_building: str | None
    worker_id: str | None
    category_id: str
    title: str
    description: str
    location: str
    ai_summary: str
    priority: Priority
    status: PublicServiceStatus
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None
    resolution_remarks: str | None
    resolution_proof_url: str | None
    merged_into_id: str | None
    merged_from_count: int = 0
    reports: list[PublicReportRead] = []
    comment_count: int = 0


class PublicCommentCreate(BaseModel):
    message: str = Field(min_length=1, max_length=COMMENT_MAX_LENGTH)

    @field_validator("message")
    @classmethod
    def strip_message(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Message must not be blank")
        return value


class PublicCommentRead(BaseModel):
    id: str
    service_id: str
    user_id: str
    author_name: str
    author_role: str
    message: str
    posted_at: datetime


class PublicHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    service_id: str
    old_status: PublicServiceStatus | None
    new_status: PublicServiceStatus
    remarks: str
    actor_id: str | None
    changed_at: datetime


class SimilaritySuggestionRead(BaseModel):
    id: str
    service_a: PublicServiceRead
    service_b: PublicServiceRead
    score: float
    rationale: str
    model_name: str
    status: SimilaritySuggestionStatus
    reviewed_by_id: str | None
    reviewed_at: datetime | None
    merged_service_id: str | None
    created_at: datetime


class SimilarityReview(BaseModel):
    accept: bool


class PublicServiceMerge(BaseModel):
    """Employee-picked set of public services to fold into one combined page."""

    service_ids: list[str] = Field(min_length=2, max_length=10)
