import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

from app.models.enums import AccountStatus, UserRole

# Matches the frontend's phoneSchema (utils/validation.ts): Indian mobile numbers, exactly 10
# digits, optionally prefixed with either the 91 country code (with or without a leading +) or
# a single trunk "0" — not both at once — first digit of the 10-digit number must be 6-9.
# Checked against digits-only, not raw length, so formatting characters (spaces, dashes,
# parens, a leading +) don't affect the match.
PHONE_DIGITS_PATTERN = re.compile(r"^(?:91|0)?[6-9]\d{9}$")


def _validate_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if not PHONE_DIGITS_PATTERN.match(digits):
        raise ValueError(
            "Enter a valid 10-digit Indian mobile number (starting 6-9, optional 0 or 91 prefix)."
        )
    return value


def normalize_phone(value: str) -> str:
    """Bare 10-digit core of a phone number, stripping formatting and the optional 91/0 prefix.
    Used to catch duplicates submitted in different (but equivalent) accepted formats — e.g.
    "9876543210", "+91 98765 43210", and "09876543210" all normalize to the same 10 digits.
    Only meaningful for values that already pass `_validate_phone` (a guaranteed 10-13 digit
    string), so taking the last 10 digits always isolates the right part regardless of prefix.
    """
    return re.sub(r"\D", "", value)[-10:]


# 254 is the practical RFC 5321 max for a full email address, and safely under the `email`
# column's `String(255)` limit (models/user.py) — without this, an overlong email wouldn't get
# a clean validation error, it'd hit a raw Postgres length-constraint error instead.
EMAIL_MAX_LENGTH = 254


def _validate_email_length(value: str) -> str:
    if len(value) > EMAIL_MAX_LENGTH:
        raise ValueError(f"Email must be {EMAIL_MAX_LENGTH} characters or fewer.")
    return value


# bcrypt silently ignores anything past 72 *bytes* on some builds and hard-errors on others —
# passlib raises `ValueError: password cannot be longer than 72 bytes` (see SETUP.md's
# troubleshooting table; this has already happened once). Checked in bytes, not characters,
# since multi-byte UTF-8 (emoji, accents) can exceed 72 bytes well before 72 characters.
PASSWORD_MAX_BYTES = 72


def _validate_password_length(value: str) -> str:
    if len(value.encode("utf-8")) > PASSWORD_MAX_BYTES:
        raise ValueError(f"Password must be {PASSWORD_MAX_BYTES} bytes or fewer.")
    return value


# Match each column's actual limit (models/user.py, models/apartment.py) — without these, an
# overlong value hits a raw Postgres length-constraint error (500) instead of a clean 422.
NAME_MAX_LENGTH = 150  # users.name / users.title / users.specialization
BUILDING_MAX_LENGTH = 100  # apartments.building
UNIT_NUMBER_MAX_LENGTH = 50  # apartments.unit_number


def _max_length_validator(field_label: str, max_length: int):
    def _validate(value: str | None) -> str | None:
        if value is not None and len(value) > max_length:
            raise ValueError(f"{field_label} must be {max_length} characters or fewer.")
        return value

    return _validate


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

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        return _validate_phone(value)

    @field_validator("email")
    @classmethod
    def validate_email_length(cls, value: str) -> str:
        return _validate_email_length(value)

    @field_validator("password")
    @classmethod
    def validate_password_length(cls, value: str) -> str:
        return _validate_password_length(value)

    @field_validator("name", "title", "specialization")
    @classmethod
    def validate_name_fields(cls, value: str | None) -> str | None:
        return _max_length_validator("Field", NAME_MAX_LENGTH)(value)

    @field_validator("building")
    @classmethod
    def validate_building(cls, value: str | None) -> str | None:
        return _max_length_validator("Building", BUILDING_MAX_LENGTH)(value)

    @field_validator("unit_number")
    @classmethod
    def validate_unit_number(cls, value: str | None) -> str | None:
        return _max_length_validator("Unit number", UNIT_NUMBER_MAX_LENGTH)(value)


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

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        return _validate_phone(value) if value is not None else value

    @field_validator("email")
    @classmethod
    def validate_email_length(cls, value: str | None) -> str | None:
        return _validate_email_length(value) if value is not None else value

    @field_validator("name", "title", "specialization")
    @classmethod
    def validate_name_fields(cls, value: str | None) -> str | None:
        return _max_length_validator("Field", NAME_MAX_LENGTH)(value)
