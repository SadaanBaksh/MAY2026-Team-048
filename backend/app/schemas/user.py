from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.enums import AccountStatus, UserRole


class UserBase(BaseModel):
    name: str
    email: EmailStr
    phone: str
    role: UserRole
    avatar_uri: str | None = None

    # Role-specific, optional depending on `role`
    title: str | None = None
    specialization: str | None = None


class UserCreate(UserBase):
    password: str
    avatar_color: str | None = None

    # Resident-only: looked up or created server-side into an Apartment row
    building: str | None = None
    unit_number: str | None = None


class UserRead(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    avatar_color: str
    apartment_id: str | None = None
    account_status: AccountStatus
    created_at: datetime
    active_jobs: int | None = None
    rating: float | None = None


class UserUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    avatar_color: str | None = None
    avatar_uri: str | None = None
    account_status: AccountStatus | None = None
    title: str | None = None
    specialization: str | None = None
