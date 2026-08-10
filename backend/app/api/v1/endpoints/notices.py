from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.api.response_docs import FORBIDDEN, NOT_FOUND, UNAUTHORIZED
from app.db.session import get_db
from app.models.apartment import Apartment
from app.models.enums import AccountStatus, NoticeStatus, UserRole
from app.models.notice import Notice, NoticeTarget
from app.models.user import User
from app.schemas.notice import (
    NoticeCreate,
    NoticeRead,
    NoticeSchedule,
    NoticeTowerRead,
    NoticeUpdate,
)
from app.services.notices import aware_utc, process_due_notices, send_notice, utc_now, validate_ready

router = APIRouter()


def _read(notice: Notice) -> NoticeRead:
    return NoticeRead(
        id=notice.id,
        created_by_id=notice.created_by_id,
        title=notice.title,
        body=notice.body,
        brief_points=notice.brief_points,
        target_buildings=sorted(target.building for target in notice.targets),
        status=notice.status,
        timezone=notice.timezone,
        scheduled_at=notice.scheduled_at,
        sent_at=notice.sent_at,
        expires_at=notice.expires_at,
        recipient_count=notice.recipient_count,
        created_at=notice.created_at,
        updated_at=notice.updated_at,
    )


def _get_notice(db: Session, notice_id: str) -> Notice:
    notice = db.get(Notice, notice_id)
    if notice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notice not found")
    return notice


def _validated_buildings(db: Session, buildings: list[str]) -> list[str]:
    if not buildings:
        return []
    existing = {
        building
        for (building,) in db.query(Apartment.building)
        .filter(Apartment.building.in_(buildings))
        .distinct()
        .all()
    }
    missing = sorted(set(buildings) - existing)
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown tower(s): {', '.join(missing)}",
        )
    return list(dict.fromkeys(buildings))


def _replace_targets(notice: Notice, buildings: list[str]) -> None:
    notice.targets = [NoticeTarget(building=building) for building in buildings]


@router.get(
    "/towers",
    response_model=list[NoticeTowerRead],
    dependencies=[Depends(require_roles(UserRole.facility_manager))],
    responses={**UNAUTHORIZED, **FORBIDDEN},
)
def list_notice_towers(db: Session = Depends(get_db)) -> list[NoticeTowerRead]:
    rows = (
        db.query(Apartment.building, func.count(User.id))
        .outerjoin(
            User,
            (User.apartment_id == Apartment.id)
            & (User.role == UserRole.resident)
            & (User.account_status == AccountStatus.active),
        )
        .group_by(Apartment.building)
        .order_by(Apartment.building)
        .all()
    )
    return [NoticeTowerRead(building=building, resident_count=count) for building, count in rows]


@router.get("/", response_model=list[NoticeRead], responses={**UNAUTHORIZED})
def list_notices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[NoticeRead]:
    process_due_notices(db)
    query = db.query(Notice).order_by(Notice.created_at.desc())
    if current_user.role == UserRole.facility_manager:
        notices = query.all()
    elif current_user.role == UserRole.resident and current_user.apartment is not None:
        notices = (
            query.join(NoticeTarget)
            .filter(
                NoticeTarget.building == current_user.apartment.building,
                Notice.status == NoticeStatus.Sent,
            )
            .all()
        )
    else:
        notices = []
    return [_read(notice) for notice in notices]


@router.post(
    "/",
    response_model=NoticeRead,
    status_code=status.HTTP_201_CREATED,
    responses={**FORBIDDEN},
)
def create_notice(
    payload: NoticeCreate,
    db: Session = Depends(get_db),
    manager: User = Depends(require_roles(UserRole.facility_manager)),
) -> NoticeRead:
    buildings = _validated_buildings(db, payload.target_buildings)
    notice = Notice(
        created_by_id=manager.id,
        title=payload.title,
        body=payload.body,
        brief_points=payload.brief_points,
        timezone=payload.timezone,
        expires_at=payload.expires_at,
    )
    _replace_targets(notice, buildings)
    db.add(notice)
    db.commit()
    db.refresh(notice)
    return _read(notice)


@router.get("/{notice_id}", response_model=NoticeRead, responses={**NOT_FOUND, **FORBIDDEN})
def get_notice(
    notice_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NoticeRead:
    process_due_notices(db)
    notice = _get_notice(db, notice_id)
    if current_user.role == UserRole.facility_manager:
        return _read(notice)
    targeted = (
        current_user.role == UserRole.resident
        and current_user.apartment is not None
        and current_user.apartment.building in {target.building for target in notice.targets}
        and notice.status in (NoticeStatus.Sent, NoticeStatus.Expired)
    )
    if not targeted:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Notice is not available")
    return _read(notice)


@router.patch("/{notice_id}", response_model=NoticeRead, responses={**NOT_FOUND, **FORBIDDEN})
def update_notice(
    notice_id: str,
    payload: NoticeUpdate,
    db: Session = Depends(get_db),
    manager: User = Depends(require_roles(UserRole.facility_manager)),
) -> NoticeRead:
    notice = _get_notice(db, notice_id)
    if notice.status not in (NoticeStatus.Draft, NoticeStatus.Scheduled):
        raise HTTPException(status_code=409, detail="Sent, expired, or cancelled notices cannot be edited")

    updates = payload.model_dump(exclude_unset=True)
    buildings = updates.pop("target_buildings", None)
    if buildings is not None:
        _replace_targets(notice, _validated_buildings(db, buildings))
    for field, value in updates.items():
        if field != "expires_at" and value is None:
            raise HTTPException(status_code=422, detail=f"{field} cannot be null")
        setattr(notice, field, value)
    notice.updated_at = utc_now()

    if notice.status == NoticeStatus.Scheduled:
        try:
            validate_ready(notice, delivery_at=aware_utc(notice.scheduled_at))
        except ValueError as exc:
            db.rollback()
            raise HTTPException(status_code=422, detail=str(exc)) from exc
    db.commit()
    db.refresh(notice)
    return _read(notice)


@router.post("/{notice_id}/send", response_model=NoticeRead, responses={**NOT_FOUND, **FORBIDDEN})
def send_notice_now(
    notice_id: str,
    db: Session = Depends(get_db),
    manager: User = Depends(require_roles(UserRole.facility_manager)),
) -> NoticeRead:
    notice = _get_notice(db, notice_id)
    try:
        send_notice(db, notice)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    db.commit()
    db.refresh(notice)
    return _read(notice)


@router.post("/{notice_id}/schedule", response_model=NoticeRead, responses={**NOT_FOUND, **FORBIDDEN})
def schedule_notice(
    notice_id: str,
    payload: NoticeSchedule,
    db: Session = Depends(get_db),
    manager: User = Depends(require_roles(UserRole.facility_manager)),
) -> NoticeRead:
    notice = _get_notice(db, notice_id)
    if notice.status not in (NoticeStatus.Draft, NoticeStatus.Scheduled):
        raise HTTPException(status_code=409, detail="Only draft or scheduled notices can be scheduled")
    scheduled_at = payload.scheduled_at.astimezone(timezone.utc)
    if scheduled_at <= utc_now():
        raise HTTPException(status_code=422, detail="Scheduled delivery must be in the future")
    try:
        validate_ready(notice, delivery_at=scheduled_at)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    notice.status = NoticeStatus.Scheduled
    notice.scheduled_at = scheduled_at
    notice.updated_at = utc_now()
    db.commit()
    db.refresh(notice)
    return _read(notice)


@router.post("/{notice_id}/cancel", response_model=NoticeRead, responses={**NOT_FOUND, **FORBIDDEN})
def cancel_notice(
    notice_id: str,
    db: Session = Depends(get_db),
    manager: User = Depends(require_roles(UserRole.facility_manager)),
) -> NoticeRead:
    notice = _get_notice(db, notice_id)
    if notice.status not in (NoticeStatus.Draft, NoticeStatus.Scheduled):
        raise HTTPException(status_code=409, detail="Only draft or scheduled notices can be cancelled")
    notice.status = NoticeStatus.Cancelled
    notice.scheduled_at = None
    notice.updated_at = utc_now()
    db.commit()
    db.refresh(notice)
    return _read(notice)
