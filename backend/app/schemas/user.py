from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.enums import AccountStatus, UserRole


class UserBase(BaseModel):
    name: str
    email: EmailStr
    phone: str
    role: UserRole
    avatar_color: str = "#6366F1"
    avatar_uri: str | None = None

    # Role-specific, optional depending on `role`
    apartment_id: str | None = None
    title: str | None = None
    specialization: str | None = None


class UserCreate(UserBase):
    password: str


class UserRead(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    account_status: AccountStatus
    created_at: datetime
    active_jobs: int | None = None
    rating: float | None = None


class UserUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    avatar_color: str | None = None
    avatar_uri: str | None = None
    account_status: AccountStatus | None = None
    title: str | None = None
    specialization: str | None = None
