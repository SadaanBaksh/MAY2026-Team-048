from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.enums import AccountStatus, UserRole
from app.models.user import User
from app.schemas.token import Token
from app.schemas.user import UserCreate, UserRead

router = APIRouter()


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> User:
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists",
        )

    user = User(
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        role=payload.role,
        avatar_color=payload.avatar_color,
        avatar_uri=payload.avatar_uri,
        hashed_password=hash_password(payload.password),
        apartment_id=payload.apartment_id if payload.role == UserRole.resident else None,
        title=payload.title if payload.role in (UserRole.facility_employee, UserRole.facility_manager) else None,
        specialization=payload.specialization if payload.role == UserRole.maintenance_staff else None,
        active_jobs=0 if payload.role == UserRole.maintenance_staff else None,
        rating=0.0 if payload.role == UserRole.maintenance_staff else None,
        account_status=(
            AccountStatus.active if payload.role == UserRole.resident else AccountStatus.pending
        ),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
) -> Token:
    user = db.query(User).filter(User.email == form_data.username).first()
    if user is None or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.account_status != AccountStatus.active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {user.account_status.value}",
        )

    access_token = create_access_token(subject=user.id)
    return Token(access_token=access_token)
