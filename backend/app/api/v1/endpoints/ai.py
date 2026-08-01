from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.gemini import GeminiError, generate_json, generate_multimodal_json, media_part
from app.core.limiter import limiter
from app.db.session import get_db
from app.models.category import Category
from app.models.enums import UserRole
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.ai import (
    ComplaintAnalysisRead,
    ComplaintAnalysisRequest,
    ResidentChatRead,
    ResidentChatRequest,
)

router = APIRouter()

_ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "ai_description": {"type": "string"},
        "category_id": {"type": "string"},
        "priority": {"type": "string", "enum": ["Low", "Medium", "High", "Critical", "Emergency"]},
        "confidence": {"type": "number"},
    },
    "required": ["ai_description", "category_id", "priority", "confidence"],
}

_CHAT_SCHEMA = {
    "type": "object",
    "properties": {
        "reply": {"type": "string"},
        "related_ticket_id": {"type": ["string", "null"]},
        "suggestions": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["reply", "related_ticket_id", "suggestions"],
}


def _ai_error(exc: GeminiError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))


@router.post("/analyze-complaint", response_model=ComplaintAnalysisRead)
@limiter.limit("6/minute")
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
    media = [media_part(str(url), 5 * 1024 * 1024) for url in payload.photo_urls]
    if payload.voice_note_url:
        media.append(media_part(str(payload.voice_note_url), 6 * 1024 * 1024))
    prompt = (
        "You classify residential maintenance complaints. Analyze only the supplied complaint text "
        "and uploaded media. Return a concise factual description (max 80 words), exactly one "
        "category_id from this list, a priority, and confidence between 0 and 1. Emergency is only "
        "for immediate danger to life, fire, gas, severe electrical hazard, flooding, or security. "
        f"Categories: {category_list}.\nResident note: {payload.resident_note or '(none)'}"
    )
    try:
        result = generate_multimodal_json(prompt=prompt, media=media, schema=_ANALYSIS_SCHEMA)
        return ComplaintAnalysisRead.model_validate(result)
    except GeminiError as exc:
        raise _ai_error(exc) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=503, detail="The AI service returned an invalid response.") from exc


@router.post("/resident-chat", response_model=ResidentChatRead)
@limiter.limit("15/minute")
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
        return ResidentChatRead.model_validate(result)
    except GeminiError as exc:
        raise _ai_error(exc) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=503, detail="The AI service returned an invalid response.") from exc
