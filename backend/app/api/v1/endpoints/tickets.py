from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import ensure_ticket_access, get_current_user, require_roles
from app.db.session import get_db
from app.models.enums import MediaType, Priority, TicketStatus, UserRole
from app.models.ticket import Ticket
from app.models.ticket_history import TicketHistory
from app.models.ticket_media import TicketMedia
from app.models.user import User
from app.schemas.ticket import TicketCreate, TicketRead, TicketUpdate
from app.schemas.ticket_history import TicketHistoryRead

router = APIRouter()


@router.get("/", response_model=list[TicketRead])
def list_tickets(
    status_filter: TicketStatus | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Ticket]:
    query = db.query(Ticket)

    if current_user.role == UserRole.resident:
        query = query.filter(Ticket.resident_id == current_user.id)
    elif current_user.role == UserRole.maintenance_staff:
        query = query.filter(Ticket.worker_id == current_user.id)
    # facility_employee / facility_manager see all tickets

    if status_filter is not None:
        query = query.filter(Ticket.status == status_filter)

    return query.order_by(Ticket.date_of_request.desc()).all()


@router.post(
    "/",
    response_model=TicketRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.resident))],
)
def create_ticket(
    payload: TicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Ticket:
    ticket = Ticket(
        **payload.model_dump(
            exclude={"priority", "ai_description", "ai_confidence", "photo_urls"}
        ),
        resident_id=current_user.id,
        priority=payload.priority or Priority.Medium,
        ai_description=payload.ai_description or "",
        ai_confidence=payload.ai_confidence or 0.0,
    )
    if payload.photo_urls and not ticket.image_url:
        ticket.image_url = payload.photo_urls[0]
        ticket.media_type = ticket.media_type or MediaType.Image
    db.add(ticket)
    db.flush()

    for url in payload.photo_urls:
        db.add(TicketMedia(ticket_id=ticket.id, media_url=url, media_type=MediaType.Image))

    db.add(
        TicketHistory(
            ticket_id=ticket.id,
            old_status=None,
            new_status=TicketStatus.Pending,
            remarks="Complaint submitted",
            actor_id=current_user.id,
        )
    )
    db.commit()
    db.refresh(ticket)
    return ticket


@router.get("/{ticket_id}", response_model=TicketRead)
def get_ticket(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Ticket:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    ensure_ticket_access(ticket, current_user)

    return ticket


@router.patch("/{ticket_id}", response_model=TicketRead)
def update_ticket(
    ticket_id: str,
    payload: TicketUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Ticket:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    updates = payload.model_dump(exclude_unset=True)

    if current_user.role == UserRole.resident:
        allowed = {"resident_rating", "resident_feedback", "status"}
        if not set(updates).issubset(allowed) or ticket.resident_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Residents can only rate and give feedback on their own tickets",
            )
        if "status" in updates and updates["status"] != TicketStatus.Closed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Residents can only close a resolved ticket",
            )
    elif current_user.role == UserRole.maintenance_staff:
        allowed = {"status", "resolution_remarks", "resolution_proof_url"}
        if not set(updates).issubset(allowed) or ticket.worker_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Maintenance staff can only update progress on assigned tickets",
            )

    new_status = updates.get("status")
    old_status = ticket.status
    for field, value in updates.items():
        setattr(ticket, field, value)

    if new_status is not None and new_status != old_status:
        if new_status == TicketStatus.Resolved:
            ticket.date_of_resolution = datetime.now(timezone.utc)
        db.add(
            TicketHistory(
                ticket_id=ticket.id,
                old_status=old_status,
                new_status=new_status,
                remarks=updates.get("resolution_remarks") or "",
                actor_id=current_user.id,
            )
        )

    db.commit()
    db.refresh(ticket)
    return ticket


@router.get("/{ticket_id}/history", response_model=list[TicketHistoryRead])
def get_ticket_history(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TicketHistory]:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    ensure_ticket_access(ticket, current_user)
    return (
        db.query(TicketHistory)
        .filter(TicketHistory.ticket_id == ticket_id)
        .order_by(TicketHistory.changed_at.asc())
        .all()
    )
