"""Admin-only endpoints for provisioning and managing facility-manager accounts.

The `admin` role is not self-registerable (see scripts.seed_demo_users). An admin signs in
through the normal employee login and gets a token like any other user; these routes are the
only thing that role can do. Manager accounts are created here without the OTP/email
verification the public registration flow requires — the admin is the trusted actor.

"Deleting" a manager is a suspend (account_status -> suspended); the row is kept because
`notices.created_by_id` is a non-nullable FK onto it. Reactivating flips it back to active.
"""

import random

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.api.response_docs import CONFLICT, FORBIDDEN, NOT_FOUND, UNAUTHORIZED
from app.core.ai_cache import invalidate_summaries
from app.core.security import hash_password
from app.db.session import get_db
from app.models.enums import AccountStatus, UserRole
from app.models.user import User
from app.schemas.user import (
    UserRead,
    _validate_email_length,
    _validate_password_length,
    _validate_phone,
    normalize_phone,
)

router = APIRouter()

# Same palette the public registration flow picks avatar colours from.
AVATAR_PALETTE = ["#0c2d35", "#7A3FC2", "#C2740F", "#1C7A5A", "#B62B4D", "#2E7BC2"]

require_admin = require_roles(UserRole.admin)


class ManagerCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str
    title: str | None = None

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str) -> str:
        return _validate_phone(value)

    @field_validator("email")
    @classmethod
    def _email(cls, value: str) -> str:
        return _validate_email_length(value)

    @field_validator("password")
    @classmethod
    def _password(cls, value: str) -> str:
        return _validate_password_length(value)


class ManagerUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    title: str | None = None
    password: str | None = None
    account_status: AccountStatus | None = None

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str | None) -> str | None:
        return _validate_phone(value) if value is not None else value

    @field_validator("email")
    @classmethod
    def _email(cls, value: str | None) -> str | None:
        return _validate_email_length(value) if value is not None else value

    @field_validator("password")
    @classmethod
    def _password(cls, value: str | None) -> str | None:
        return _validate_password_length(value) if value is not None else value


def _email_taken(db: Session, email: str, *, exclude_id: str | None = None) -> bool:
    query = db.query(User).filter(User.email == email)
    if exclude_id is not None:
        query = query.filter(User.id != exclude_id)
    return query.first() is not None


def _phone_taken(db: Session, phone: str, *, exclude_id: str | None = None) -> bool:
    target = normalize_phone(phone)
    query = db.query(User.id, User.phone)
    if exclude_id is not None:
        query = query.filter(User.id != exclude_id)
    return any(normalize_phone(existing) == target for _, existing in query.all())


def _get_manager(db: Session, user_id: str) -> User:
    user = db.get(User, user_id)
    if user is None or user.role != UserRole.facility_manager:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Facility manager not found"
        )
    return user


@router.get(
    "/managers",
    response_model=list[UserRead],
    responses={**UNAUTHORIZED, **FORBIDDEN},
)
def list_managers(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[User]:
    return (
        db.query(User)
        .filter(User.role == UserRole.facility_manager)
        .order_by(User.created_at.desc())
        .all()
    )


@router.post(
    "/managers",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    responses={**UNAUTHORIZED, **FORBIDDEN, **CONFLICT},
)
def create_manager(
    payload: ManagerCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> User:
    if _email_taken(db, payload.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists",
        )
    if _phone_taken(db, payload.phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this phone number already exists",
        )

    manager = User(
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        role=UserRole.facility_manager,
        avatar_color=random.choice(AVATAR_PALETTE),
        hashed_password=hash_password(payload.password),
        title=payload.title,
        account_status=AccountStatus.active,
    )
    db.add(manager)
    db.commit()
    invalidate_summaries()
    db.refresh(manager)
    return manager


@router.patch(
    "/managers/{user_id}",
    response_model=UserRead,
    responses={**UNAUTHORIZED, **FORBIDDEN, **NOT_FOUND, **CONFLICT},
)
def update_manager(
    user_id: str,
    payload: ManagerUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> User:
    manager = _get_manager(db, user_id)
    updates = payload.model_dump(exclude_unset=True)

    if "account_status" in updates and updates["account_status"] not in (
        AccountStatus.active,
        AccountStatus.suspended,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="account_status must be 'active' or 'suspended'",
        )

    if "email" in updates and updates["email"] != manager.email:
        if _email_taken(db, updates["email"], exclude_id=manager.id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists",
            )

    if "phone" in updates and normalize_phone(updates["phone"]) != normalize_phone(manager.phone):
        if _phone_taken(db, updates["phone"], exclude_id=manager.id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this phone number already exists",
            )

    if "password" in updates:
        manager.hashed_password = hash_password(updates.pop("password"))

    for field, value in updates.items():
        setattr(manager, field, value)

    db.commit()
    invalidate_summaries()
    db.refresh(manager)
    return manager
