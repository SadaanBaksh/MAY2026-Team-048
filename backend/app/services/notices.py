from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.apartment import Apartment
from app.models.enums import AccountStatus, NoticeStatus, UserRole
from app.models.notice import Notice
from app.models.notification import Notification
from app.models.user import User


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def aware_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def targeted_residents(db: Session, notice: Notice) -> list[User]:
    buildings = [target.building for target in notice.targets]
    if not buildings:
        return []
    return (
        db.query(User)
        .join(Apartment, User.apartment_id == Apartment.id)
        .filter(
            User.role == UserRole.resident,
            User.account_status == AccountStatus.active,
            Apartment.building.in_(buildings),
        )
        .all()
    )


def validate_ready(notice: Notice, *, delivery_at: datetime) -> None:
    if not notice.title.strip():
        raise ValueError("Add a notice title before sending")
    if not notice.body.strip():
        raise ValueError("Add a notice message before sending")
    if not notice.targets:
        raise ValueError("Select at least one tower before sending")
    if notice.expires_at is not None and aware_utc(notice.expires_at) <= delivery_at:
        raise ValueError("Expiry must be after the delivery time")


def send_notice(db: Session, notice: Notice, *, now: datetime | None = None) -> Notice:
    now = now or utc_now()
    validate_ready(notice, delivery_at=now)
    if notice.status not in (NoticeStatus.Draft, NoticeStatus.Scheduled):
        raise ValueError("Only draft or scheduled notices can be sent")

    residents = targeted_residents(db, notice)
    existing_user_ids = {
        user_id
        for (user_id,) in db.query(Notification.user_id)
        .filter(Notification.notice_id == notice.id)
        .all()
    }
    for resident in residents:
        if resident.id not in existing_user_ids:
            db.add(
                Notification(
                    user_id=resident.id,
                    notice_id=notice.id,
                    title=notice.title,
                    message=notice.body,
                )
            )

    notice.status = NoticeStatus.Sent
    notice.sent_at = now
    notice.scheduled_at = None
    notice.recipient_count = len(residents)
    notice.updated_at = now
    return notice


def process_due_notices(db: Session, *, now: datetime | None = None) -> int:
    now = now or utc_now()
    due = (
        db.query(Notice)
        .filter(Notice.status == NoticeStatus.Scheduled, Notice.scheduled_at <= now)
        .with_for_update(skip_locked=True)
        .all()
    )
    dispatched = 0
    for notice in due:
        try:
            send_notice(db, notice, now=now)
            dispatched += 1
        except ValueError:
            notice.status = NoticeStatus.Cancelled
            notice.updated_at = now

    expired = db.query(Notice).filter(
        Notice.status == NoticeStatus.Sent,
        Notice.expires_at.is_not(None),
        Notice.expires_at <= now,
    )
    for notice in expired.all():
        notice.status = NoticeStatus.Expired
        notice.updated_at = now

    db.commit()
    return dispatched
