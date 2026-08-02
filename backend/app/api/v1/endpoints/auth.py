import random

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.response_docs import CONFLICT, RATE_LIMITED, UNAUTHORIZED
from app.core.limiter import limiter
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.apartment import Apartment
from app.models.enums import AccountStatus, UserRole
from app.models.user import User
from app.schemas.token import Token
from app.schemas.user import UserCreate, UserRead, normalize_phone

router = APIRouter()

AVATAR_PALETTE = ["#0c2d35", "#7A3FC2", "#C2740F", "#1C7A5A", "#B62B4D", "#2E7BC2"]

ACTIVE_ON_REGISTER = (UserRole.resident, UserRole.facility_manager)


def _resolve_apartment_id(db: Session, building: str | None, unit_number: str | None) -> str:
    if not building or not unit_number:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="building and unit_number are required for residents",
        )
    building = building.strip()
    unit_number = unit_number.strip()

    existing = (
        db.query(Apartment)
        .filter(Apartment.building.ilike(building), Apartment.unit_number.ilike(unit_number))
        .first()
    )
    if existing is not None:
        return existing.id

    apartment = Apartment(building=building, unit_number=unit_number)
    db.add(apartment)
    db.flush()
    return apartment.id


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    responses={**CONFLICT, **RATE_LIMITED},
)
@limiter.limit("5/minute")
def register(request: Request, payload: UserCreate, db: Session = Depends(get_db)) -> User:
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists",
        )

    # Compares normalized digits, not raw strings, so "9876543210", "+91 98765 43210", and
    # "09876543210" (all equivalent per phoneSchema) can't be used to dodge this check.
    target_phone = normalize_phone(payload.phone)
    phone_taken = any(
        normalize_phone(phone) == target_phone for (phone,) in db.query(User.phone).all()
    )
    if phone_taken:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this phone number already exists",
        )

    apartment_id = (
        _resolve_apartment_id(db, payload.building, payload.unit_number)
        if payload.role == UserRole.resident
        else None
    )

    user = User(
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        role=payload.role,
        avatar_color=payload.avatar_color or random.choice(AVATAR_PALETTE),
        avatar_uri=payload.avatar_uri,
        hashed_password=hash_password(payload.password),
        apartment_id=apartment_id,
        title=payload.title if payload.role in (UserRole.facility_employee, UserRole.facility_manager) else None,
        specialization=payload.specialization if payload.role == UserRole.maintenance_staff else None,
        active_jobs=0 if payload.role == UserRole.maintenance_staff else None,
        rating=0.0 if payload.role == UserRole.maintenance_staff else None,
        account_status=(
            AccountStatus.active if payload.role in ACTIVE_ON_REGISTER else AccountStatus.pending
        ),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token, responses={**UNAUTHORIZED, **RATE_LIMITED})
@limiter.limit("10/minute")
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Token:
    user = db.query(User).filter(User.email == form_data.username).first()
    if user is None or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Non-active accounts still receive a token; the client is expected to
    # gate access based on `account_status` from /users/me (pending-approval flow).
    access_token = create_access_token(subject=user.id)
    return Token(access_token=access_token)
