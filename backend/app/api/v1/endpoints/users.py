from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, notify_user
from app.api.response_docs import CONFLICT, FORBIDDEN, NOT_FOUND, RATE_LIMITED, UNAUTHORIZED
from app.core.ai_cache import invalidate_summaries
from app.core.limiter import limiter
from app.db.session import get_db
from app.models.enums import AccountStatus, UserRole
from app.models.user import User
from app.schemas.user import UserRead, UserUpdate, normalize_phone
from app.services.email import send_otp_email
from app.services.otp import generate_otp, verify_otp

router = APIRouter()

# Purpose tag for the OTP that guards a self-service email change. The OTP is keyed by the
# *new* address (not the account's current one), so possession of the new inbox is what's
# proven before we move the login identity onto it.
EMAIL_CHANGE_PURPOSE = "change_email"


class EmailChangeRequest(BaseModel):
    new_email: EmailStr


class EmailChangeVerify(BaseModel):
    new_email: EmailStr
    otp: str


@router.get("/me", response_model=UserRead, responses={**UNAUTHORIZED})
def read_current_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post(
    "/me/email/send-otp",
    responses={**UNAUTHORIZED, **CONFLICT, **RATE_LIMITED},
)
@limiter.limit("3/minute")
def request_email_change(
    request: Request,
    payload: EmailChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    if payload.new_email.lower() == current_user.email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That is already your email address.",
        )

    email_taken = (
        db.query(User)
        .filter(User.email == payload.new_email, User.id != current_user.id)
        .first()
    )
    if email_taken is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists",
        )

    otp = generate_otp(payload.new_email, EMAIL_CHANGE_PURPOSE)
    send_otp_email(payload.new_email, otp, EMAIL_CHANGE_PURPOSE)
    return {"message": "OTP sent successfully"}


@router.post(
    "/me/email/verify",
    response_model=UserRead,
    responses={**UNAUTHORIZED, **CONFLICT, **RATE_LIMITED},
)
@limiter.limit("5/minute")
def verify_email_change(
    request: Request,
    payload: EmailChangeVerify,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    # Re-check uniqueness at confirm time: another account could have claimed the address in
    # the window between requesting and entering the OTP.
    email_taken = (
        db.query(User)
        .filter(User.email == payload.new_email, User.id != current_user.id)
        .first()
    )
    if email_taken is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists",
        )

    if not verify_otp(payload.new_email, payload.otp, EMAIL_CHANGE_PURPOSE):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP",
        )

    current_user.email = payload.new_email
    db.commit()
    invalidate_summaries()
    db.refresh(current_user)
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

    # Email is the login identity and must be proven against the new inbox first — route any
    # actual change through POST /users/me/email/{send-otp,verify}. Phone changes are disabled
    # entirely for now (no verification path exists yet). Both are still accepted here as
    # long as the value is unchanged, so a client that echoes the whole profile back still
    # works. This applies to staff/manager edits too — there is no admin path for contact info.
    if "email" in updates and updates["email"] != user.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email changes must be verified. Request an OTP for the new address instead.",
        )

    if "phone" in updates and normalize_phone(updates["phone"]) != normalize_phone(user.phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number cannot be changed.",
        )

    # Suspending an account, or reactivating a suspended one, is a facility-manager-only
    # action — separate from the employee-run registration approval flow
    # (pending -> active / rejected).
    status_change: str | None = None
    if "account_status" in updates:
        new_status = updates["account_status"]
        was_suspended = user.account_status == AccountStatus.suspended
        if new_status == AccountStatus.suspended or (
            was_suspended and new_status == AccountStatus.active
        ):
            if current_user.role != UserRole.facility_manager:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only a facility manager can suspend or reactivate an account",
                )
            if user.id == current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You cannot change your own account status",
                )
            if user.role == UserRole.facility_manager:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Facility manager accounts cannot be suspended",
                )
            status_change = (
                "suspended" if new_status == AccountStatus.suspended else "reactivated"
            )

    for field, value in updates.items():
        setattr(user, field, value)

    if status_change == "suspended":
        notify_user(
            db,
            user_id=user.id,
            title="Account suspended",
            message=(
                "Your account has been suspended by a facility manager. "
                "Please contact them to restore access."
            ),
        )
    elif status_change == "reactivated":
        notify_user(
            db,
            user_id=user.id,
            title="Account reactivated",
            message="Your account has been reactivated. You can sign in again.",
        )

    db.commit()
    invalidate_summaries()
    db.refresh(user)
    return user
