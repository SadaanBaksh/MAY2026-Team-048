from datetime import datetime
import re

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.enums import NoticeStatus

TITLE_MAX_LENGTH = 200
BODY_MAX_LENGTH = 6000
BRIEF_POINT_MAX_LENGTH = 500
MAX_BRIEF_POINTS = 20
MAX_TARGET_BUILDINGS = 100
TIMEZONE_PATTERN = re.compile(r"^[A-Za-z0-9_+\-/]+$")


def _strip_nonblank(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("Value must not be blank")
    return value


class NoticeCreate(BaseModel):
    title: str = Field(default="", max_length=TITLE_MAX_LENGTH)
    body: str = Field(default="", max_length=BODY_MAX_LENGTH)
    brief_points: list[str] = Field(default_factory=list, max_length=MAX_BRIEF_POINTS)
    target_buildings: list[str] = Field(default_factory=list, max_length=MAX_TARGET_BUILDINGS)
    timezone: str = Field(default="UTC", max_length=100)
    expires_at: datetime | None = None

    @field_validator("title", "body")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("brief_points")
    @classmethod
    def validate_brief(cls, values: list[str]) -> list[str]:
        cleaned = [_strip_nonblank(value) for value in values]
        if any(len(value) > BRIEF_POINT_MAX_LENGTH for value in cleaned):
            raise ValueError(f"Each brief point must be {BRIEF_POINT_MAX_LENGTH} characters or fewer")
        return cleaned

    @field_validator("target_buildings")
    @classmethod
    def validate_targets(cls, values: list[str]) -> list[str]:
        return list(dict.fromkeys(_strip_nonblank(value) for value in values))

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        value = value.strip()
        if not value or not TIMEZONE_PATTERN.fullmatch(value):
            raise ValueError("Timezone must be a valid IANA-style name")
        return value

    @field_validator("expires_at")
    @classmethod
    def require_aware_expiry(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("expires_at must include a timezone offset")
        return value


class NoticeUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=TITLE_MAX_LENGTH)
    body: str | None = Field(default=None, max_length=BODY_MAX_LENGTH)
    brief_points: list[str] | None = Field(default=None, max_length=MAX_BRIEF_POINTS)
    target_buildings: list[str] | None = Field(default=None, max_length=MAX_TARGET_BUILDINGS)
    timezone: str | None = Field(default=None, max_length=100)
    expires_at: datetime | None = None

    @field_validator("title", "body")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None

    @field_validator("brief_points")
    @classmethod
    def validate_optional_brief(cls, values: list[str] | None) -> list[str] | None:
        if values is None:
            return None
        return NoticeCreate.validate_brief(values)

    @field_validator("target_buildings")
    @classmethod
    def validate_optional_targets(cls, values: list[str] | None) -> list[str] | None:
        if values is None:
            return None
        return NoticeCreate.validate_targets(values)

    @field_validator("timezone")
    @classmethod
    def validate_optional_timezone(cls, value: str | None) -> str | None:
        return NoticeCreate.validate_timezone(value) if value is not None else None

    @field_validator("expires_at")
    @classmethod
    def require_aware_expiry(cls, value: datetime | None) -> datetime | None:
        return NoticeCreate.require_aware_expiry(value)


class NoticeSchedule(BaseModel):
    scheduled_at: datetime

    @model_validator(mode="after")
    def require_aware_schedule(self):
        if self.scheduled_at.tzinfo is None:
            raise ValueError("scheduled_at must include a timezone offset")
        return self


class NoticeTowerRead(BaseModel):
    building: str
    resident_count: int


class NoticeDraftRequest(BaseModel):
    brief_points: list[str] = Field(min_length=1, max_length=MAX_BRIEF_POINTS)
    target_buildings: list[str] = Field(min_length=1, max_length=MAX_TARGET_BUILDINGS)
    scheduled_at: datetime | None = None
    expires_at: datetime | None = None
    timezone: str = Field(default="UTC", max_length=100)

    @field_validator("brief_points")
    @classmethod
    def validate_brief(cls, values: list[str]) -> list[str]:
        return NoticeCreate.validate_brief(values)

    @field_validator("target_buildings")
    @classmethod
    def validate_targets(cls, values: list[str]) -> list[str]:
        return NoticeCreate.validate_targets(values)

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        return NoticeCreate.validate_timezone(value)

    @field_validator("scheduled_at", "expires_at")
    @classmethod
    def require_aware_dates(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("Dates must include a timezone offset")
        return value


class NoticeDraftRead(BaseModel):
    title: str = Field(min_length=1, max_length=TITLE_MAX_LENGTH)
    body: str = Field(min_length=1, max_length=BODY_MAX_LENGTH)

    @field_validator("title", "body")
    @classmethod
    def strip_generated_text(cls, value: str) -> str:
        return _strip_nonblank(value)


class NoticeRead(BaseModel):
    id: str
    created_by_id: str
    title: str
    body: str
    brief_points: list[str]
    target_buildings: list[str]
    status: NoticeStatus
    timezone: str
    scheduled_at: datetime | None
    sent_at: datetime | None
    expires_at: datetime | None
    recipient_count: int
    created_at: datetime
    updated_at: datetime
