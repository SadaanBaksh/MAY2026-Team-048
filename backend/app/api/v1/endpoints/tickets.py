from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import ensure_ticket_access, get_current_user, notify_user, require_roles
from app.api.response_docs import FORBIDDEN, NOT_FOUND, UNAUTHORIZED
from app.core.ai_cache import invalidate_summaries
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
    responses={**UNAUTHORIZED, **FORBIDDEN},
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

    if ticket.priority == Priority.Emergency:
        employee_title = "Emergency service request"
        employee_message = f"{current_user.name} needs emergency assistance: {ticket.title}"
    else:
        employee_title = "New complaint submitted"
        employee_message = f"{current_user.name} reported: {ticket.title}"
    employees = db.query(User).filter(User.role == UserRole.facility_employee).all()
    for employee in employees:
        notify_user(
            db,
            user_id=employee.id,
            ticket_id=ticket.id,
            title=employee_title,
            message=employee_message,
        )

    db.commit()
    invalidate_summaries()
    db.refresh(ticket)
    return ticket


@router.get("/{ticket_id}", response_model=TicketRead, responses={**FORBIDDEN, **NOT_FOUND})
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


@router.patch("/{ticket_id}", response_model=TicketRead, responses={**FORBIDDEN, **NOT_FOUND})
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
        if "status" in updates:
            new_status_value = updates["status"]
            if new_status_value == TicketStatus.Cancelled:
                if ticket.status != TicketStatus.Pending:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Only a pending complaint can be cancelled - it's already being worked on",
                    )
            elif new_status_value == TicketStatus.Closed:
                if ticket.status != TicketStatus.Resolved:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Only resolved tickets can be closed",
                    )
            else:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Residents can only close a resolved ticket or cancel a pending one",
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

        if new_status == TicketStatus.Assigned:
            worker = db.get(User, ticket.worker_id) if ticket.worker_id else None
            if worker is not None:
                notify_user(
                    db,
                    user_id=worker.id,
                    ticket_id=ticket.id,
                    title="New assignment",
                    message=f"You have been assigned: {ticket.title}.",
                )
            notify_user(
                db,
                user_id=ticket.resident_id,
                ticket_id=ticket.id,
                title="Complaint assigned",
                message=(
                    f"{worker.name if worker else 'A technician'} has been assigned to your "
                    "complaint."
                ),
            )
        elif new_status == TicketStatus.In_Progress:
            notify_user(
                db,
                user_id=ticket.resident_id,
                ticket_id=ticket.id,
                title="Work started",
                message=f"{current_user.name} has started work on: {ticket.title}.",
            )
        elif new_status == TicketStatus.Resolved:
            notify_user(
                db,
                user_id=ticket.resident_id,
                ticket_id=ticket.id,
                title="Complaint resolved",
                message=(
                    f'Your complaint "{ticket.title}" has been marked resolved. Please verify '
                    "and rate."
                ),
            )
            employees = db.query(User).filter(User.role == UserRole.facility_employee).all()
            for employee in employees:
                notify_user(
                    db,
                    user_id=employee.id,
                    ticket_id=ticket.id,
                    title="Work completed",
                    message=f"{current_user.name} completed: {ticket.title}.",
                )
        elif new_status == TicketStatus.Cancelled:
            employees = db.query(User).filter(User.role == UserRole.facility_employee).all()
            for employee in employees:
                notify_user(
                    db,
                    user_id=employee.id,
                    ticket_id=ticket.id,
                    title="Complaint cancelled",
                    message=f"{current_user.name} cancelled: {ticket.title}.",
                )
        elif new_status == TicketStatus.Closed and "resident_rating" in updates:
            if ticket.worker_id:
                # Recompute the worker's displayed rating (`User.rating`) as the average of
                # `resident_rating` across every ticket they've been rated on — this field was
                # otherwise only ever set once at registration (to 0.0) and never updated again.
                # Flush first so this ticket's own just-set `resident_rating` (still pending in
                # the session, not yet visible to a fresh SELECT) is included in the average.
                db.flush()
                avg_rating = (
                    db.query(func.avg(Ticket.resident_rating))
                    .filter(Ticket.worker_id == ticket.worker_id, Ticket.resident_rating.isnot(None))
                    .scalar()
                )
                worker = db.get(User, ticket.worker_id)
                if worker is not None and avg_rating is not None:
                    worker.rating = round(float(avg_rating), 2)

                notify_user(
                    db,
                    user_id=ticket.worker_id,
                    ticket_id=ticket.id,
                    title="Resident feedback received",
                    message=(
                        f"You were rated {updates['resident_rating']}/5 for: {ticket.title}."
                    ),
                )

    db.commit()
    invalidate_summaries()
    db.refresh(ticket)
    return ticket


@router.get(
    "/{ticket_id}/history",
    response_model=list[TicketHistoryRead],
    responses={**FORBIDDEN, **NOT_FOUND},
)
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
