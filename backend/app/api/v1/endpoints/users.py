from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.response_docs import CONFLICT, FORBIDDEN, NOT_FOUND, UNAUTHORIZED
from app.core.ai_cache import invalidate_summaries
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.user import UserRead, UserUpdate, normalize_phone

router = APIRouter()


@router.get("/me", response_model=UserRead, responses={**UNAUTHORIZED})
def read_current_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.get("/", response_model=list[UserRead])
def list_users(
    role: UserRole | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[User]:
    # Any authenticated user can list the directory (matches the previous mock
    # behavior, where every role saw the full roster client-side) — needed by
    # residents/staff/employees/managers alike to resolve names on ticket screens.
    query = db.query(User)
    if role is not None:
        query = query.filter(User.role == role)
    return query.all()


@router.get("/{user_id}", response_model=UserRead, responses={**NOT_FOUND})
def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.patch(
    "/{user_id}",
    response_model=UserRead,
    responses={**CONFLICT, **FORBIDDEN, **NOT_FOUND},
)
def update_user(
    user_id: str,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.id != user_id and current_user.role not in (
        UserRole.facility_employee,
        UserRole.facility_manager,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Cannot update another user"
        )

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    updates = payload.model_dump(exclude_unset=True)

    if "email" in updates and updates["email"] != user.email:
        email_taken = (
            db.query(User).filter(User.email == updates["email"], User.id != user_id).first()
        )
        if email_taken is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists",
            )

    if "phone" in updates and normalize_phone(updates["phone"]) != normalize_phone(user.phone):
        target_phone = normalize_phone(updates["phone"])
        phone_taken = any(
            normalize_phone(phone) == target_phone
            for (phone,) in db.query(User.phone).filter(User.id != user_id).all()
        )
        if phone_taken:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this phone number already exists",
            )

    for field, value in updates.items():
        setattr(user, field, value)

    db.commit()
    invalidate_summaries()
    db.refresh(user)
    return user
