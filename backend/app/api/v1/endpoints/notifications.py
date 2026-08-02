from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.response_docs import NOT_FOUND, UNAUTHORIZED
from app.db.session import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationRead

router = APIRouter()


@router.get("/me", response_model=list[NotificationRead], responses={**UNAUTHORIZED})
def list_my_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Notification]:
    return (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )


@router.patch(
    "/{notification_id}/read", response_model=NotificationRead, responses={**NOT_FOUND}
)
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Notification:
    notification = db.get(Notification, notification_id)
    if notification is None or notification.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found"
        )
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification
