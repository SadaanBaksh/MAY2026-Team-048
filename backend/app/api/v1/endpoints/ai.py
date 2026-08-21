from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.api.response_docs import FORBIDDEN, RATE_LIMITED, SERVICE_UNAVAILABLE, UNAUTHORIZED
from app.core.ai_cache import get_cached_summary, make_cache_key, make_fingerprint, set_cached_summary
from app.core.gemini import GeminiError, generate_json, generate_multimodal_json, media_part
from app.core.limiter import limiter, rate_limit_key_for_user
from app.core.storage import upload_belongs_to
from app.db.session import get_db
from app.models.category import Category
from app.models.chat_message import ChatMessage
from app.models.enums import (
    AccountStatus,
    Priority,
    PublicServiceStatus,
    TicketStatus,
    UserRole,
)
from app.models.public_service import PublicService
from app.models.ticket import Ticket
from app.models.user import User
from app.models.apartment import Apartment
from datetime import datetime, timezone

from app.schemas.ai import (
    ChatMessageRead,
    ComplaintAnalysisRead,
    ComplaintAnalysisRequest,
    DashboardSummaryRead,
    ResidentChatRead,
    ResidentChatRequest,
)
from app.schemas.notice import NoticeDraftRead, NoticeDraftRequest

router = APIRouter()

_ANALYSIS_SCHEMA = {
    # `responseSchema` in the v1beta generateContent endpoint uses Gemini's legacy
    # Schema enum values (uppercase), rather than ordinary JSON Schema's lowercase ones.
    "type": "OBJECT",
    "properties": {
        "is_valid_complaint": {"type": "BOOLEAN"},
        "rejection_reason": {"type": "STRING"},
        "ai_description": {"type": "STRING"},
        "category_id": {"type": "STRING"},
        "priority": {"type": "STRING", "enum": ["Low", "Medium", "High", "Critical", "Emergency"]},
        "confidence": {"type": "NUMBER"},
    },
    "required": [
        "is_valid_complaint",
        "rejection_reason",
        "ai_description",
        "category_id",
        "priority",
        "confidence",
    ],
}

_CHAT_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "reply": {"type": "STRING"},
        "related_ticket_id": {"type": "STRING", "nullable": True},
        "suggestions": {"type": "ARRAY", "items": {"type": "STRING"}},
    },
    "required": ["reply", "related_ticket_id", "suggestions"],
}

_NOTICE_DRAFT_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "title": {"type": "STRING"},
        "body": {"type": "STRING"},
    },
    "required": ["title", "body"],
}


def _ai_error(exc: GeminiError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))


def _as_aware_utc(value: datetime) -> datetime:
    # Ticket.date_of_request/date_of_resolution are declared DateTime(timezone=True) and
    # always written as UTC (models/ticket.py), but SQLite - unlike Postgres - doesn't
    # actually persist tzinfo and hands back naive datetimes regardless of that flag.
    # Subtracting a naive DB value from an aware `now` raises TypeError, so normalize here.
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


@router.post(
    "/analyze-complaint",
    response_model=ComplaintAnalysisRead,
    responses={**FORBIDDEN, **RATE_LIMITED, **SERVICE_UNAVAILABLE},
)
@limiter.limit("6/minute", key_func=rate_limit_key_for_user)
def analyze_complaint(
    request: Request,
    payload: ComplaintAnalysisRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.resident)),
) -> ComplaintAnalysisRead:
    categories = db.query(Category).order_by(Category.name).all()
    if not categories:
        raise HTTPException(status_code=503, detail="Complaint categories are not configured.")
    category_list = ", ".join(f"{category.id} ({category.name})" for category in categories)

    for url in (*payload.photo_urls, payload.voice_note_url):
        if url is not None and not upload_belongs_to(str(url), current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only analyze media you uploaded yourself.",
            )

    media = [media_part(str(url), 5 * 1024 * 1024) for url in payload.photo_urls]
    if payload.voice_note_url:
        media.append(media_part(str(payload.voice_note_url), 6 * 1024 * 1024))
    prompt = (
        "You classify residential maintenance complaints. Analyze only the supplied complaint text "
        "and uploaded media. First decide whether the text and/or media actually describe a "
        "residential maintenance issue (e.g. plumbing, electrical, appliance, structural, pest, "
        "cleanliness, safety). If none of the supplied text or media relates to a maintenance "
        "complaint, set is_valid_complaint to false, give a short one-sentence rejection_reason "
        "explaining what was supplied instead, and set category_id to an empty string, priority to "
        "'Low', and confidence to 0. Do not reject something just because it's hard to classify or "
        "the issue isn't fully clear - only reject when it's unrelated to a maintenance complaint. "
        "Otherwise set is_valid_complaint to true, leave rejection_reason as an empty string, and "
        "return a concise factual description (max 80 words), exactly one category_id from this "
        "list, a priority, and confidence between 0 and 1. Emergency is only for immediate danger to "
        "life, fire, gas, severe electrical hazard, flooding, or security. "
        f"Categories: {category_list}.\nResident note: {payload.resident_note or '(none)'}"
    )
    try:
        result = generate_multimodal_json(prompt=prompt, media=media, schema=_ANALYSIS_SCHEMA)
        return ComplaintAnalysisRead.model_validate(result)
    except GeminiError as exc:
        raise _ai_error(exc) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=503, detail="The AI service returned an invalid response.") from exc


@router.post(
    "/resident-chat",
    response_model=ResidentChatRead,
    responses={**FORBIDDEN, **RATE_LIMITED, **SERVICE_UNAVAILABLE},
)
@limiter.limit("15/minute", key_func=rate_limit_key_for_user)
def resident_chat(
    request: Request,
    payload: ResidentChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.resident)),
) -> ResidentChatRead:
    tickets = (
        db.query(Ticket)
        .filter(Ticket.resident_id == current_user.id)
        .order_by(Ticket.date_of_request.desc())
        .limit(12)
        .all()
    )
    ticket_context = "\n".join(
        f"- id={ticket.id}; title={ticket.title[:120]}; status={ticket.status.value}; "
        f"priority={ticket.priority.value}; requested={ticket.date_of_request.date()}; "
        f"worker_id={ticket.worker_id or 'unassigned'}"
        for ticket in tickets
    ) or "No complaints found."
    history = "\n".join(f"{turn.role}: {turn.text}" for turn in payload.history)
    prompt = (
        "You are Simplifix's resident support assistant. Answer only about the resident's supplied "
        "complaint data and app workflow. Be concise, helpful, and do not invent assignments, dates, "
        "or policy. If there is danger, direct them to local emergency services. Set related_ticket_id "
        "only to an id listed below, otherwise null. Give up to three short useful next prompts.\n\n"
        f"Resident's tickets:\n{ticket_context}\n\nRecent conversation:\n{history or '(none)'}\n\n"
        f"resident: {payload.message.strip()}"
    )
    try:
        result = generate_json(prompt=prompt, schema=_CHAT_SCHEMA, max_output_tokens=250)
        result["related_ticket_id"] = (
            result.get("related_ticket_id") if result.get("related_ticket_id") in {ticket.id for ticket in tickets} else None
        )
        reply = ResidentChatRead.model_validate(result)
    except GeminiError as exc:
        raise _ai_error(exc) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=503, detail="The AI service returned an invalid response.") from exc

    db.add(ChatMessage(user_id=current_user.id, role="resident", text=payload.message.strip()))
    db.add(
        ChatMessage(
            user_id=current_user.id,
            role="assistant",
            text=reply.reply,
            related_ticket_id=reply.related_ticket_id,
            suggestions=reply.suggestions,
        )
    )
    db.commit()

    return reply


@router.get(
    "/chat-history",
    response_model=list[ChatMessageRead],
    responses={**FORBIDDEN, **UNAUTHORIZED},
)
def chat_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.resident)),
) -> list[ChatMessage]:
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == current_user.id)
        .order_by(ChatMessage.created_at.asc())
        .limit(200)
        .all()
    )


@router.delete(
    "/chat-history",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**FORBIDDEN, **UNAUTHORIZED},
)
def clear_chat_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.resident)),
) -> None:
    db.query(ChatMessage).filter(ChatMessage.user_id == current_user.id).delete()
    db.commit()


@router.post(
    "/draft-notice",
    response_model=NoticeDraftRead,
    responses={**FORBIDDEN, **RATE_LIMITED, **SERVICE_UNAVAILABLE},
)
@limiter.limit("8/minute", key_func=rate_limit_key_for_user)
def draft_notice(
    request: Request,
    payload: NoticeDraftRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.facility_manager)),
) -> NoticeDraftRead:
    known_buildings = {
        building
        for (building,) in db.query(Apartment.building)
        .filter(Apartment.building.in_(payload.target_buildings))
        .distinct()
        .all()
    }
    missing = sorted(set(payload.target_buildings) - known_buildings)
    if missing:
        raise HTTPException(status_code=422, detail=f"Unknown tower(s): {', '.join(missing)}")

    brief = "\n".join(f"- {point}" for point in payload.brief_points)
    timing = (
        f"Scheduled delivery: {payload.scheduled_at.isoformat() if payload.scheduled_at else 'immediate'}\n"
        f"Expiry: {payload.expires_at.isoformat() if payload.expires_at else 'none'}\n"
        f"Manager timezone: {payload.timezone}"
    )
    prompt = (
        "You write clear, professional notices from apartment facility management to residents. "
        "Use only the supplied facts; never invent dates, causes, contacts, safety claims, or work "
        "details. Mention the targeted towers naturally when relevant. Return a short descriptive "
        "title (max 100 characters) and a polished message (max 350 words). Preserve every material "
        "instruction and time from the brief. Delivery and expiry metadata below are context only; "
        "do not mention them unless the brief explicitly asks. Do not add markdown headings, "
        "signatures, or placeholders.\n\n"
        f"Target towers: {', '.join(payload.target_buildings)}\n{timing}\n\nBrief:\n{brief}"
    )
    try:
        result = generate_json(prompt=prompt, schema=_NOTICE_DRAFT_SCHEMA, max_output_tokens=600)
        return NoticeDraftRead.model_validate(result)
    except GeminiError as exc:
        raise _ai_error(exc) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=503, detail="The AI service returned an invalid response.") from exc


_SUMMARY_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "summary": {"type": "STRING"},
    },
    "required": ["summary"],
}


@router.get(
    "/dashboard-summary",
    response_model=DashboardSummaryRead,
    responses={**UNAUTHORIZED, **RATE_LIMITED, **SERVICE_UNAVAILABLE},
)
@limiter.limit("10/minute", key_func=rate_limit_key_for_user)
def dashboard_summary(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardSummaryRead:
    now = datetime.now(timezone.utc)
    today = now.date()

    if current_user.role == UserRole.resident:
        tickets = db.query(Ticket).filter(Ticket.resident_id == current_user.id).all()
    elif current_user.role in (UserRole.facility_employee, UserRole.facility_manager):
        tickets = db.query(Ticket).all()
    else:  # maintenance_staff
        tickets = db.query(Ticket).filter(Ticket.worker_id == current_user.id).all()

    status_counts = {}
    for t in tickets:
        status_counts[t.status.value] = status_counts.get(t.status.value, 0) + 1

    # Cancelled tickets were withdrawn by the resident before any work started, and rejected
    # ones were dismissed by staff as implausible - neither should count as outstanding work
    # in any of the "still needs attention" stats below.
    _INACTIVE_STATUSES = (
        TicketStatus.Resolved,
        TicketStatus.Closed,
        TicketStatus.Cancelled,
        TicketStatus.Rejected,
    )

    overdue = sum(1 for t in tickets if getattr(t, "is_overdue", False) and t.status not in _INACTIVE_STATUSES)
    
    stats_text = f"Total tickets: {len(tickets)}\nCounts by status: {status_counts}\nOverdue tickets: {overdue}\n"

    if current_user.role == UserRole.resident:
        awaiting_rating = sum(1 for t in tickets if t.status == TicketStatus.Resolved and t.resident_rating is None)
        stats_text += f"Resolved tickets awaiting rating: {awaiting_rating}\n"
        if tickets:
            most_recent = max(tickets, key=lambda t: t.date_of_request)
            days_ago = (now - _as_aware_utc(most_recent.date_of_request)).days
            stats_text += f"Most recent ticket: '{most_recent.title}' ({most_recent.status.value}), created {days_ago} days ago\n"
    elif current_user.role in (UserRole.facility_employee, UserRole.facility_manager):
        unassigned = sum(1 for t in tickets if t.worker_id is None and t.status not in _INACTIVE_STATUSES)
        high_priority_open = sum(1 for t in tickets if t.priority in (Priority.High, Priority.Critical, Priority.Emergency) and t.status not in _INACTIVE_STATUSES)
        created_today = sum(1 for t in tickets if t.date_of_request.date() == today)
        stats_text += (
            f"Unassigned tickets: {unassigned}\n"
            f"High/Critical/Emergency open tickets: {high_priority_open}\n"
            f"Tickets created today: {created_today}\n"
        )
        public_services = db.query(PublicService).filter(
            PublicService.status != PublicServiceStatus.Merged
        ).all()
        public_open = sum(
            1
            for item in public_services
            if item.status not in (PublicServiceStatus.Resolved, PublicServiceStatus.Rejected)
        )
        public_resolved = sum(
            1 for item in public_services if item.status == PublicServiceStatus.Resolved
        )
        merged_public = db.query(PublicService).filter(
            PublicService.status == PublicServiceStatus.Merged
        ).count()
        stats_text += (
            f"Public services: {len(public_services)}\n"
            f"Open public services: {public_open}\n"
            f"Resolved public services: {public_resolved}\n"
            f"Resident public pages merged: {merged_public}\n"
        )
        if current_user.role == UserRole.facility_manager:
            resolved_closed = status_counts.get(TicketStatus.Resolved.value, 0) + status_counts.get(TicketStatus.Closed.value, 0)
            # Cancelled tickets were withdrawn and rejected ones were never legitimate - excluding
            # both keeps the rate a measure of "of complaints we actually pursued, how many got
            # resolved."
            pursued_tickets = len(tickets) - status_counts.get(
                TicketStatus.Cancelled.value, 0
            ) - status_counts.get(TicketStatus.Rejected.value, 0)
            resolution_rate = f"{(resolved_closed / pursued_tickets * 100):.1f}%" if pursued_tickets else "0%"
            
            resolved_tickets = [t for t in tickets if t.status == TicketStatus.Resolved and t.date_of_resolution]
            if resolved_tickets:
                avg_res_time = sum((t.date_of_resolution - t.date_of_request).total_seconds() for t in resolved_tickets) / len(resolved_tickets)
                avg_time_str = f"{avg_res_time / 86400:.1f} days"
            else:
                avg_time_str = "N/A"
                
            pending_users = db.query(User).filter(User.account_status == AccountStatus.pending).count()
            
            stats_text += (
                f"Resolution rate: {resolution_rate}\n"
                f"Average resolution time: {avg_time_str}\n"
                f"Pending user approvals: {pending_users}\n"
            )
    else:  # maintenance_staff
        active_jobs = sum(1 for t in tickets if t.status in (TicketStatus.Assigned, TicketStatus.In_Progress))
        active_public_jobs = db.query(PublicService).filter(
            PublicService.worker_id == current_user.id,
            PublicService.status.in_(
                [PublicServiceStatus.Assigned, PublicServiceStatus.In_Progress]
            ),
        ).count()
        stats_text += (
            f"Active private jobs: {active_jobs}\n"
            f"Active public jobs: {active_public_jobs}\n"
        )

    # ── Cache layer ──────────────────────────────────────────────────────
    cache_key = make_cache_key(current_user.id, current_user.role.value)
    fingerprint = make_fingerprint(stats_text)

    cached = get_cached_summary(cache_key, fingerprint)
    if cached is not None:
        return DashboardSummaryRead.model_validate(cached)
    # ────────────────────────────────────────────────────────────────────

    prompt = (
        "You are an AI generating a dashboard summary for a residential maintenance app. "
        f"The user is a {current_user.role.value}. Based on the following stats, write exactly "
        "2-3 sentences to summarize the current state. Be concise and factual. Reference specific "
        "numbers from the data. Do not invent data not present in the stats. Use a friendly, "
        "professional tone. If there are no tickets or stats are all zeros, say something like 'No complaints on record yet.'\n\n"
        f"Stats:\n{stats_text}"
    )

    try:
        result = generate_json(prompt=prompt, schema=_SUMMARY_SCHEMA, max_output_tokens=150)
        set_cached_summary(cache_key, fingerprint, result)
        return DashboardSummaryRead.model_validate(result)
    except GeminiError as exc:
        raise _ai_error(exc) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=503, detail="The AI service returned an invalid response.") from exc
