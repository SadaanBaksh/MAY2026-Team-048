from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import ensure_ticket_access, get_current_user, notify_user
from app.db.session import get_db
from app.models.comment import Comment
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.comment import CommentCreate, CommentRead

router = APIRouter()


@router.get("/{ticket_id}/comments", response_model=list[CommentRead])
def list_comments(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Comment]:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    ensure_ticket_access(ticket, current_user)
    return (
        db.query(Comment)
        .filter(Comment.ticket_id == ticket_id)
        .order_by(Comment.posted_at.asc())
        .all()
    )


@router.post(
    "/{ticket_id}/comments", response_model=CommentRead, status_code=status.HTTP_201_CREATED
)
def create_comment(
    ticket_id: str,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Comment:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    ensure_ticket_access(ticket, current_user)

    comment = Comment(ticket_id=ticket_id, user_id=current_user.id, message=payload.message)
    db.add(comment)

    recipients = {ticket.resident_id, ticket.worker_id} - {current_user.id, None}
    for recipient_id in recipients:
        notify_user(
            db,
            user_id=recipient_id,
            ticket_id=ticket.id,
            title="New message",
            message=f'{current_user.name} commented on "{ticket.title}": {payload.message}',
        )

    db.commit()
    db.refresh(comment)
    return comment
