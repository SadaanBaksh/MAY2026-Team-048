import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, notify_user, require_roles
from app.api.response_docs import FORBIDDEN, NOT_FOUND, SERVICE_UNAVAILABLE, UNAUTHORIZED
from app.core.config import settings
from app.core.gemini import GeminiError, generate_json
from app.core.storage import upload_belongs_to
from app.db.session import get_db
from app.models.category import Category
from app.models.enums import (
    AccountStatus,
    Priority,
    PublicServiceStatus,
    SimilaritySuggestionStatus,
    UserRole,
)
from app.models.notification import Notification
from app.models.public_service import PublicReport, PublicReportMedia, PublicService
from app.models.public_service_comment import PublicServiceComment
from app.models.public_service_history import PublicServiceHistory
from app.models.public_similarity import PublicSimilaritySuggestion
from app.models.user import User
from app.schemas.public_service import (
    PublicCommentCreate,
    PublicCommentRead,
    PublicHistoryRead,
    PublicServiceCreate,
    PublicServiceMerge,
    PublicServiceRead,
    PublicServiceUpdate,
    SimilarityReview,
    SimilaritySuggestionRead,
)

logger = logging.getLogger(__name__)
router = APIRouter()

_SIMILARITY_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "matches": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "service_id": {"type": "STRING"},
                    "score": {"type": "NUMBER"},
                    "rationale": {"type": "STRING"},
                },
                "required": ["service_id", "score", "rationale"],
            },
        }
    },
    "required": ["matches"],
}

_PRIORITY_RANK = {
    Priority.Low: 0,
    Priority.Medium: 1,
    Priority.High: 2,
    Priority.Critical: 3,
    Priority.Emergency: 4,
}


def _building_for(user: User | None) -> str | None:
    return user.apartment.building if user and user.apartment else None


def _service_dict(db: Session, service: PublicService) -> dict:
    creator = db.get(User, service.created_by_id)
    reports = []
    for report in sorted(service.reports, key=lambda item: item.created_at):
        author = report.author
        reports.append(
            {
                "id": report.id,
                "author_id": report.author_id,
                "author_name": author.name,
                "author_building": _building_for(author),
                "title": report.title,
                "description": report.description,
                "location": report.location,
                "created_at": report.created_at,
                "media": report.media,
            }
        )
    return {
        "id": service.id,
        "created_by_id": service.created_by_id,
        "creator_name": creator.name if creator else "Resident",
        "creator_building": _building_for(creator),
        "worker_id": service.worker_id,
        "category_id": service.category_id,
        "title": service.title,
        "description": service.description,
        "location": service.location,
        "ai_summary": service.ai_summary,
        "priority": service.priority,
        "status": service.status,
        "created_at": service.created_at,
        "updated_at": service.updated_at,
        "resolved_at": service.resolved_at,
        "resolution_remarks": service.resolution_remarks,
        "resolution_proof_url": service.resolution_proof_url,
        "merged_into_id": service.merged_into_id,
        "merged_from_count": (
            db.query(PublicService).filter(PublicService.merged_into_id == service.id).count()
        ),
        "reports": reports,
        "comment_count": len(service.comments),
    }


def _ensure_service_access(service: PublicService, current_user: User) -> None:
    # Residents, employees, and managers can read the society-wide feed. Maintenance staff
    # only receive the public jobs assigned to them.
    if current_user.role == UserRole.maintenance_staff and service.worker_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not assigned to you")


def _is_report_author(db: Session, service_id: str, user_id: str) -> bool:
    return (
        db.query(PublicReport)
        .filter(PublicReport.service_id == service_id, PublicReport.author_id == user_id)
        .first()
        is not None
    )


def _record_status(
    db: Session,
    service: PublicService,
    old_status: PublicServiceStatus | None,
    new_status: PublicServiceStatus,
    actor_id: str | None,
    remarks: str = "",
) -> None:
    db.add(
        PublicServiceHistory(
            service_id=service.id,
            old_status=old_status,
            new_status=new_status,
            actor_id=actor_id,
            remarks=remarks,
        )
    )


_MERGE_LOCKED_STATUSES = (
    PublicServiceStatus.Resolved,
    PublicServiceStatus.Merged,
    PublicServiceStatus.Rejected,
)


def _merge_services(
    db: Session,
    services: list[PublicService],
    actor: User,
    *,
    ai_summary: str,
    keep_suggestion_id: str | None = None,
) -> PublicService:
    """Fold two or more public services into a single new combined page.

    Callers must have already checked that every service exists and that none is in a
    locked state (see `_MERGE_LOCKED_STATUSES`). Reports and comments are re-parented
    onto the new page, each source is marked `Merged` and pointed at it, still-pending
    similarity suggestions that reference a source are declined, and report authors plus
    any inherited worker are notified. Returns the new merged service; the caller commits.
    """
    now = datetime.now(timezone.utc)
    ordered = sorted(services, key=lambda item: item.created_at)
    older = ordered[0]
    source_ids = [item.id for item in services]

    # Gather report authors before re-parenting, while `source.reports` still holds them.
    author_ids = {report.author_id for item in services for report in item.reports}

    worker_ids = {item.worker_id for item in services if item.worker_id}
    worker_id = next(iter(worker_ids)) if len(worker_ids) == 1 else None
    priority = max((item.priority for item in services), key=lambda item: _PRIORITY_RANK[item])

    merged = PublicService(
        created_by_id=older.created_by_id,
        worker_id=worker_id,
        category_id=older.category_id,
        title=older.title,
        description=older.description,
        location=older.location,
        ai_summary=ai_summary,
        priority=priority,
        status=PublicServiceStatus.Assigned if worker_id else PublicServiceStatus.Pending,
    )
    db.add(merged)
    db.flush()

    for source in services:
        for report in list(source.reports):
            if report.original_service_id is None:
                report.original_service_id = report.service_id
            report.service_id = merged.id
        for comment in list(source.comments):
            if comment.original_service_id is None:
                comment.original_service_id = comment.service_id
            comment.service_id = merged.id
        old_status = source.status
        source.status = PublicServiceStatus.Merged
        source.merged_into_id = merged.id
        source.updated_at = now
        _record_status(
            db,
            source,
            old_status,
            PublicServiceStatus.Merged,
            actor.id,
            f"Merged into public service {merged.id}",
        )
    _record_status(
        db,
        merged,
        None,
        merged.status,
        actor.id,
        "Created by merging public services " + ", ".join(source_ids),
    )

    stale_query = db.query(PublicSimilaritySuggestion).filter(
        PublicSimilaritySuggestion.status == SimilaritySuggestionStatus.Pending,
        or_(
            PublicSimilaritySuggestion.service_a_id.in_(source_ids),
            PublicSimilaritySuggestion.service_b_id.in_(source_ids),
        ),
    )
    if keep_suggestion_id is not None:
        stale_query = stale_query.filter(PublicSimilaritySuggestion.id != keep_suggestion_id)
    for stale in stale_query.all():
        stale.status = SimilaritySuggestionStatus.Declined
        stale.reviewed_by_id = actor.id
        stale.reviewed_at = now

    for author_id in author_ids:
        notify_user(
            db,
            user_id=author_id,
            public_service_id=merged.id,
            title="Public reports merged",
            message=f'Your report is now part of the combined service page "{merged.title}".',
        )
    if merged.worker_id:
        notify_user(
            db,
            user_id=merged.worker_id,
            public_service_id=merged.id,
            title="Merged public service assignment",
            message=f'The combined public service "{merged.title}" is assigned to you.',
        )
    return merged


def _score_candidates(service: PublicService, candidates: list[PublicService]) -> list[dict]:
    """Ask Gemini once for all shortlisted candidates; callers treat failure as non-fatal."""
    if not candidates:
        return []
    candidate_text = "\n".join(
        f"- id={item.id}; title={item.title}; location={item.location}; "
        f"description={item.description[:1000]}"
        for item in candidates
    )
    prompt = (
        "You compare public maintenance reports from one apartment society. Score whether each "
        "candidate describes the same real-world problem as the new report, from 0 to 1. Merge "
        "semantic duplicates even when one contains extra information. Do not match merely because "
        "the issue type is similar. Different physical assets or conflicting towers, landmarks, "
        "pool areas, lift numbers, or street-light locations mean different problems. Return every "
        "candidate id exactly once with a concise evidence-based rationale.\n\n"
        f"New report: title={service.title}; location={service.location}; "
        f"description={service.description}\n\nCandidates:\n{candidate_text}"
    )
    result = generate_json(prompt=prompt, schema=_SIMILARITY_SCHEMA, max_output_tokens=2500)
    allowed_ids = {candidate.id for candidate in candidates}
    matches = []
    for match in result.get("matches", []):
        service_id = str(match.get("service_id", ""))
        if service_id not in allowed_ids:
            continue
        try:
            score = max(0.0, min(1.0, float(match.get("score", 0))))
        except (TypeError, ValueError):
            continue
        matches.append(
            {
                "service_id": service_id,
                "score": score,
                "rationale": str(match.get("rationale", ""))[:1000],
            }
        )
    return matches


def _create_similarity_suggestions(db: Session, service: PublicService) -> None:
    candidates = (
        db.query(PublicService)
        .filter(
            PublicService.id != service.id,
            PublicService.status.notin_(
                [PublicServiceStatus.Resolved, PublicServiceStatus.Merged, PublicServiceStatus.Rejected]
            ),
            PublicService.merged_into_id.is_(None),
        )
        .order_by(PublicService.created_at.desc())
        .limit(settings.PUBLIC_SIMILARITY_CANDIDATE_LIMIT)
        .all()
    )
    try:
        matches = _score_candidates(service, candidates)
    except GeminiError as exc:
        # Reporting an issue must never fail just because similarity scoring is unavailable.
        logger.warning("Public similarity scoring skipped for %s: %s", service.id, exc)
        return

    employees = db.query(User).filter(User.role == UserRole.facility_employee).all()
    by_id = {candidate.id: candidate for candidate in candidates}
    for match in matches:
        if match["score"] <= settings.PUBLIC_SIMILARITY_THRESHOLD:
            continue
        other = by_id[match["service_id"]]
        first_id, second_id = sorted((other.id, service.id))
        exists = (
            db.query(PublicSimilaritySuggestion)
            .filter(
                PublicSimilaritySuggestion.service_a_id == first_id,
                PublicSimilaritySuggestion.service_b_id == second_id,
            )
            .first()
        )
        if exists:
            continue
        suggestion = PublicSimilaritySuggestion(
            service_a_id=first_id,
            service_b_id=second_id,
            score=match["score"],
            rationale=match["rationale"],
            model_name=settings.GEMINI_MODEL,
        )
        db.add(suggestion)
        for employee in employees:
            notify_user(
                db,
                user_id=employee.id,
                public_service_id=service.id,
                title="Possible duplicate public reports",
                message=(
                    f'AI found a {match["score"]:.0%} match between "{other.title}" and '
                    f'"{service.title}". Review whether they should be merged.'
                ),
            )
    db.commit()


@router.get("/", response_model=list[PublicServiceRead])
def list_public_services(
    status_filter: PublicServiceStatus | None = None,
    include_merged: bool = False,
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    query = db.query(PublicService)
    if current_user.role == UserRole.maintenance_staff:
        query = query.filter(PublicService.worker_id == current_user.id)
    if status_filter is not None:
        query = query.filter(PublicService.status == status_filter)
    elif not include_merged:
        query = query.filter(PublicService.status != PublicServiceStatus.Merged)
    services = query.order_by(PublicService.created_at.desc()).limit(limit).all()
    return [_service_dict(db, service) for service in services]


@router.post(
    "/",
    response_model=PublicServiceRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.resident))],
    responses={**UNAUTHORIZED, **FORBIDDEN, **SERVICE_UNAVAILABLE},
)
def create_public_service(
    payload: PublicServiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if db.get(Category, payload.category_id) is None:
        raise HTTPException(status_code=422, detail="Category not found")
    for url in payload.photo_urls:
        if not upload_belongs_to(url, current_user.id):
            raise HTTPException(
                status_code=403, detail="You can only attach media you uploaded yourself"
            )
    service = PublicService(
        created_by_id=current_user.id,
        category_id=payload.category_id,
        title=payload.title,
        description=payload.description,
        location=payload.location,
        priority=payload.priority,
        ai_summary=payload.description,
    )
    db.add(service)
    db.flush()
    report = PublicReport(
        service_id=service.id,
        author_id=current_user.id,
        title=payload.title,
        description=payload.description,
        location=payload.location,
    )
    db.add(report)
    db.flush()
    for url in payload.photo_urls:
        db.add(PublicReportMedia(report_id=report.id, media_url=url))
    _record_status(
        db,
        service,
        None,
        PublicServiceStatus.Pending,
        current_user.id,
        "Public report submitted",
    )
    employees = db.query(User).filter(User.role == UserRole.facility_employee).all()
    for employee in employees:
        notify_user(
            db,
            user_id=employee.id,
            public_service_id=service.id,
            title="New public service report",
            message=f'{current_user.name} reported "{service.title}" at {service.location}.',
        )
    db.commit()
    db.refresh(service)
    _create_similarity_suggestions(db, service)
    db.refresh(service)
    return _service_dict(db, service)


@router.get("/{service_id}", response_model=PublicServiceRead, responses={**FORBIDDEN, **NOT_FOUND})
def get_public_service(
    service_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    service = db.get(PublicService, service_id)
    if service is None:
        raise HTTPException(status_code=404, detail="Public service not found")
    _ensure_service_access(service, current_user)
    return _service_dict(db, service)


@router.patch("/{service_id}", response_model=PublicServiceRead, responses={**FORBIDDEN, **NOT_FOUND})
def update_public_service(
    service_id: str,
    payload: PublicServiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    service = db.get(PublicService, service_id)
    if service is None:
        raise HTTPException(status_code=404, detail="Public service not found")
    if service.status in (
        PublicServiceStatus.Resolved,
        PublicServiceStatus.Merged,
        PublicServiceStatus.Rejected,
    ):
        raise HTTPException(
            status_code=409, detail="Resolved, merged, or rejected public services are locked"
        )

    updates = payload.model_dump(exclude_unset=True)
    old_status = service.status
    old_worker_id = service.worker_id
    if current_user.role == UserRole.resident:
        if set(updates) - {"status", "resolution_remarks"}:
            raise HTTPException(status_code=403, detail="Residents can only resolve their reports")
        if updates.get("status") != PublicServiceStatus.Resolved or not _is_report_author(
            db, service.id, current_user.id
        ):
            raise HTTPException(status_code=403, detail="Only a contributing resident can resolve this report")
    elif current_user.role == UserRole.maintenance_staff:
        if service.worker_id != current_user.id or set(updates) - {
            "status",
            "resolution_remarks",
            "resolution_proof_url",
        }:
            raise HTTPException(status_code=403, detail="Not assigned to this public service")
        allowed = {
            PublicServiceStatus.Assigned: {PublicServiceStatus.In_Progress, PublicServiceStatus.Resolved},
            PublicServiceStatus.In_Progress: {PublicServiceStatus.Resolved},
        }
        if updates.get("status") not in allowed.get(old_status, set()):
            raise HTTPException(status_code=409, detail="Invalid public service status transition")
    elif current_user.role == UserRole.facility_manager:
        raise HTTPException(status_code=403, detail="Managers have read-only public service access")

    if current_user.role == UserRole.facility_employee:
        worker_id = updates.get("worker_id")
        if worker_id is not None:
            worker = db.get(User, worker_id)
            if (
                worker is None
                or worker.role != UserRole.maintenance_staff
                or worker.account_status != AccountStatus.active
            ):
                raise HTTPException(status_code=422, detail="Worker must be active maintenance staff")
            updates.setdefault("status", PublicServiceStatus.Assigned)

    if updates.get("status") == PublicServiceStatus.Rejected:
        if current_user.role != UserRole.facility_employee:
            raise HTTPException(
                status_code=403, detail="Only facility employees can reject a public service report"
            )
        if old_status != PublicServiceStatus.Pending:
            raise HTTPException(
                status_code=409,
                detail="Only a pending public service report can be rejected - it's already being worked on",
            )
        if not (updates.get("resolution_remarks") or "").strip():
            raise HTTPException(
                status_code=422, detail="A reason is required to reject a public service report"
            )

    new_status = updates.get("status")
    if new_status == PublicServiceStatus.Merged:
        raise HTTPException(status_code=403, detail="Use an accepted merge suggestion")
    if new_status == PublicServiceStatus.Resolved:
        service.resolved_at = datetime.now(timezone.utc)
    for field, value in updates.items():
        setattr(service, field, value)
    service.updated_at = datetime.now(timezone.utc)

    if new_status is not None and new_status != old_status:
        _record_status(
            db,
            service,
            old_status,
            new_status,
            current_user.id,
            updates.get("resolution_remarks") or "",
        )
        recipient_ids = {report.author_id for report in service.reports}
        if service.worker_id:
            recipient_ids.add(service.worker_id)
        for recipient_id in recipient_ids - {current_user.id}:
            notify_user(
                db,
                user_id=recipient_id,
                public_service_id=service.id,
                title="Public service updated",
                message=f'"{service.title}" is now {new_status.value.replace("_", " ")}.',
            )
    if (
        service.status == PublicServiceStatus.Assigned
        and service.worker_id
        and (old_status != PublicServiceStatus.Assigned or old_worker_id != service.worker_id)
    ):
        notify_user(
            db,
            user_id=service.worker_id,
            public_service_id=service.id,
            title="New public service assignment",
            message=f'You have been assigned "{service.title}" at {service.location}.',
        )
    db.commit()
    db.refresh(service)
    return _service_dict(db, service)


@router.post(
    "/merge",
    response_model=PublicServiceRead,
    dependencies=[Depends(require_roles(UserRole.facility_employee))],
    responses={**FORBIDDEN, **NOT_FOUND},
)
def merge_public_services(
    payload: PublicServiceMerge,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Manually fold a facility employee's chosen set of open public services into one
    combined page. Unlike the AI-suggested pairwise merge, the employee picks the set."""
    unique_ids = list(dict.fromkeys(payload.service_ids))
    if len(unique_ids) < 2:
        raise HTTPException(
            status_code=422, detail="Pick at least two different public services to merge"
        )

    services: list[PublicService] = []
    for service_id in unique_ids:
        service = db.get(PublicService, service_id)
        if service is None:
            raise HTTPException(status_code=404, detail=f"Public service {service_id} not found")
        if service.status in _MERGE_LOCKED_STATUSES:
            raise HTTPException(
                status_code=409,
                detail=f'"{service.title}" is {service.status.value.lower()} and cannot be merged',
            )
        services.append(service)

    merged = _merge_services(
        db,
        services,
        current_user,
        ai_summary=(
            f"Merged from {sum(len(item.reports) for item in services)} resident reports across "
            f"{len(services)} public service pages, combined by {current_user.name}."
        ),
    )
    db.commit()
    db.refresh(merged)
    return _service_dict(db, merged)


@router.post(
    "/{service_id}/unmerge",
    response_model=list[PublicServiceRead],
    dependencies=[Depends(require_roles(UserRole.facility_employee))],
    responses={**FORBIDDEN, **NOT_FOUND},
)
def unmerge_public_service(
    service_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Reverse a merge: move every report/comment back to the page it came from, reopen the
    source pages, and delete the combined page. Only allowed while the combined page is still
    unassigned and pending — once a worker is on it, history has to be preserved."""
    combined = db.get(PublicService, service_id)
    if combined is None:
        raise HTTPException(status_code=404, detail="Public service not found")

    sources = (
        db.query(PublicService).filter(PublicService.merged_into_id == combined.id).all()
    )
    if not sources:
        raise HTTPException(status_code=409, detail="This page was not created by a merge")
    if combined.status != PublicServiceStatus.Pending or combined.worker_id is not None:
        raise HTTPException(
            status_code=409,
            detail="Only an unassigned, still-pending combined page can be unmerged",
        )

    source_ids = {source.id for source in sources}
    reports = list(combined.reports)
    comments = list(combined.comments)

    if any(report.original_service_id is None for report in reports):
        raise HTTPException(
            status_code=409,
            detail="This combined page predates unmerge support and can't be split automatically",
        )
    if any(report.original_service_id not in source_ids for report in reports) or any(
        comment.original_service_id is not None and comment.original_service_id not in source_ids
        for comment in comments
    ):
        raise HTTPException(
            status_code=409,
            detail="This page was built from an earlier merge - unmerge that one first",
        )

    pending_against_combined = (
        db.query(PublicSimilaritySuggestion)
        .filter(
            PublicSimilaritySuggestion.status == SimilaritySuggestionStatus.Pending,
            or_(
                PublicSimilaritySuggestion.service_a_id == combined.id,
                PublicSimilaritySuggestion.service_b_id == combined.id,
            ),
        )
        .first()
    )
    if pending_against_combined is not None:
        raise HTTPException(
            status_code=409, detail="Resolve the pending duplicate suggestion for this page first"
        )

    now = datetime.now(timezone.utc)
    oldest_source = min(sources, key=lambda source: source.created_at)

    for report in reports:
        report.service_id = report.original_service_id
        report.original_service_id = None
    for comment in comments:
        # Comments authored on the combined page itself have no origin - keep them on the
        # oldest source so nothing is lost.
        comment.service_id = comment.original_service_id or oldest_source.id
        comment.original_service_id = None

    for source in sources:
        old_status = source.status
        source.status = PublicServiceStatus.Pending
        source.merged_into_id = None
        source.updated_at = now
        _record_status(
            db,
            source,
            old_status,
            PublicServiceStatus.Pending,
            current_user.id,
            f"Unmerged from public service {combined.id}",
        )

    # An AI suggestion that was accepted into this page goes back to Pending to re-decide.
    for suggestion in db.query(PublicSimilaritySuggestion).filter(
        PublicSimilaritySuggestion.merged_service_id == combined.id
    ):
        suggestion.status = SimilaritySuggestionStatus.Pending
        suggestion.merged_service_id = None
        suggestion.reviewed_by_id = None
        suggestion.reviewed_at = None

    for author_id in {report.author_id for report in reports}:
        notify_user(
            db,
            user_id=author_id,
            public_service_id=oldest_source.id,
            title="Combined report split",
            message=(
                "A facility employee split the combined page - your report is back on its "
                "own page."
            ),
        )

    # The combined page is about to be deleted; detach notifications that point at it
    # (nullable FK, no ON DELETE rule).
    db.query(Notification).filter(Notification.public_service_id == combined.id).update(
        {Notification.public_service_id: None}, synchronize_session=False
    )

    db.flush()
    # Reload the (now empty) collections so the delete-orphan cascade doesn't take the
    # re-parented reports/comments down with the combined page.
    db.expire(combined, ["reports", "comments"])
    db.delete(combined)
    db.commit()

    return [_service_dict(db, db.get(PublicService, source_id)) for source_id in source_ids]


@router.get("/{service_id}/comments", response_model=list[PublicCommentRead])
def list_public_comments(
    service_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    service = db.get(PublicService, service_id)
    if service is None:
        raise HTTPException(status_code=404, detail="Public service not found")
    _ensure_service_access(service, current_user)
    return [
        {
            "id": comment.id,
            "service_id": comment.service_id,
            "user_id": comment.user_id,
            "author_name": comment.user.name,
            "author_role": comment.user.role.value,
            "message": comment.message,
            "posted_at": comment.posted_at,
        }
        for comment in sorted(service.comments, key=lambda item: item.posted_at)
    ]


@router.post(
    "/{service_id}/comments",
    response_model=PublicCommentRead,
    status_code=status.HTTP_201_CREATED,
)
def create_public_comment(
    service_id: str,
    payload: PublicCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    service = db.get(PublicService, service_id)
    if service is None:
        raise HTTPException(status_code=404, detail="Public service not found")
    _ensure_service_access(service, current_user)
    if service.status in (
        PublicServiceStatus.Resolved,
        PublicServiceStatus.Merged,
        PublicServiceStatus.Rejected,
    ):
        raise HTTPException(status_code=409, detail="Discussion is closed for this public service")
    comment = PublicServiceComment(
        service_id=service.id, user_id=current_user.id, message=payload.message
    )
    db.add(comment)
    recipient_ids = {report.author_id for report in service.reports}
    recipient_ids.update(comment.user_id for comment in service.comments)
    if service.worker_id:
        recipient_ids.add(service.worker_id)
    for recipient_id in recipient_ids - {current_user.id}:
        notify_user(
            db,
            user_id=recipient_id,
            public_service_id=service.id,
            title="New public discussion comment",
            message=f'{current_user.name} commented on "{service.title}".',
        )
    db.commit()
    db.refresh(comment)
    return {
        "id": comment.id,
        "service_id": comment.service_id,
        "user_id": comment.user_id,
        "author_name": current_user.name,
        "author_role": current_user.role.value,
        "message": comment.message,
        "posted_at": comment.posted_at,
    }


@router.get("/{service_id}/history", response_model=list[PublicHistoryRead])
def list_public_history(
    service_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[PublicServiceHistory]:
    service = db.get(PublicService, service_id)
    if service is None:
        raise HTTPException(status_code=404, detail="Public service not found")
    _ensure_service_access(service, current_user)
    return (
        db.query(PublicServiceHistory)
        .filter(PublicServiceHistory.service_id == service.id)
        .order_by(PublicServiceHistory.changed_at)
        .all()
    )


def _suggestion_dict(db: Session, suggestion: PublicSimilaritySuggestion) -> dict:
    return {
        "id": suggestion.id,
        "service_a": _service_dict(db, db.get(PublicService, suggestion.service_a_id)),
        "service_b": _service_dict(db, db.get(PublicService, suggestion.service_b_id)),
        "score": suggestion.score,
        "rationale": suggestion.rationale,
        "model_name": suggestion.model_name,
        "status": suggestion.status,
        "reviewed_by_id": suggestion.reviewed_by_id,
        "reviewed_at": suggestion.reviewed_at,
        "merged_service_id": suggestion.merged_service_id,
        "created_at": suggestion.created_at,
    }


@router.get(
    "/similarity/suggestions",
    response_model=list[SimilaritySuggestionRead],
    dependencies=[Depends(require_roles(UserRole.facility_employee))],
)
def list_similarity_suggestions(
    suggestion_status: SimilaritySuggestionStatus = SimilaritySuggestionStatus.Pending,
    db: Session = Depends(get_db),
) -> list[dict]:
    suggestions = (
        db.query(PublicSimilaritySuggestion)
        .filter(PublicSimilaritySuggestion.status == suggestion_status)
        .order_by(PublicSimilaritySuggestion.score.desc(), PublicSimilaritySuggestion.created_at)
        .all()
    )
    return [_suggestion_dict(db, suggestion) for suggestion in suggestions]


@router.post(
    "/similarity/suggestions/{suggestion_id}/review",
    response_model=SimilaritySuggestionRead,
    dependencies=[Depends(require_roles(UserRole.facility_employee))],
)
def review_similarity_suggestion(
    suggestion_id: str,
    payload: SimilarityReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    suggestion = db.get(PublicSimilaritySuggestion, suggestion_id)
    if suggestion is None:
        raise HTTPException(status_code=404, detail="Similarity suggestion not found")
    if suggestion.status != SimilaritySuggestionStatus.Pending:
        raise HTTPException(status_code=409, detail="Similarity suggestion has already been reviewed")
    now = datetime.now(timezone.utc)
    suggestion.reviewed_by_id = current_user.id
    suggestion.reviewed_at = now
    if not payload.accept:
        suggestion.status = SimilaritySuggestionStatus.Declined
        db.commit()
        db.refresh(suggestion)
        return _suggestion_dict(db, suggestion)

    first = db.get(PublicService, suggestion.service_a_id)
    second = db.get(PublicService, suggestion.service_b_id)
    if first is None or second is None:
        raise HTTPException(status_code=404, detail="One of the public services no longer exists")
    if first.status in (PublicServiceStatus.Resolved, PublicServiceStatus.Merged) or second.status in (
        PublicServiceStatus.Resolved,
        PublicServiceStatus.Merged,
    ):
        raise HTTPException(status_code=409, detail="Resolved or already merged services cannot be merged")

    merged = _merge_services(
        db,
        [first, second],
        current_user,
        ai_summary=(
            f"Merged from {len(first.reports) + len(second.reports)} resident reports. "
            f"AI review: {suggestion.rationale}"
        ),
        keep_suggestion_id=suggestion.id,
    )
    suggestion.status = SimilaritySuggestionStatus.Accepted
    suggestion.merged_service_id = merged.id
    db.commit()
    db.refresh(suggestion)
    return _suggestion_dict(db, suggestion)
