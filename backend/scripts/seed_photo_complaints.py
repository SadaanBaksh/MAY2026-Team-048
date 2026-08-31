"""Seed demo maintenance complaints (private tickets) that use the real photos in
``scripts/demo_photos/``.

Each image is uploaded to S3 exactly like a real in-app upload, then referenced by a
new ticket. The complaints are spread across the seeded resident accounts and cover a
range of categories, priorities and lifecycle states.

Safe to re-run: a ticket whose deterministic id already exists is skipped, and its
photo is not re-uploaded.

Prerequisites
-------------
* S3 configured in ``backend/.env`` (``AWS_ACCESS_KEY_ID`` / ``AWS_SECRET_ACCESS_KEY`` /
  ``AWS_REGION`` / ``S3_BUCKET_NAME``) - the photos live there, same as a real upload.
* Categories and demo users seeded::

      python -m scripts.seed_categories
      python -m scripts.seed_demo_users

Run from ``backend/``::

    python -m scripts.seed_photo_complaints
"""

import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

import boto3

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.category import Category
from app.models.enums import CostResponsibility, MediaType, Priority, TicketStatus
from app.models.ticket import Ticket
from app.models.ticket_history import TicketHistory
from app.models.ticket_media import TicketMedia
from app.models.user import User

PHOTO_DIR = Path(__file__).parent / "demo_photos"

_CONTENT_TYPE_BY_EXT = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}

# email -> role is only used for the "missing account" hint below.
_RESIDENTS = {
    "demo.resident@simplifix.app",
    "rohan.mehta@simplifix.app",
    "kavya.reddy@simplifix.app",
    "arjun.iyer@simplifix.app",
    "sneha.patel@simplifix.app",
}

# Each spec pins a photo file, the resident who filed it, and a lifecycle state.
# `worker` is the maintenance-staff email for anything past Pending; picked to match
# the staff member's specialization where there is one.
COMPLAINTS = [
    {
        "key": "photo-kitchen-sink",
        "photo": "kitchen-sink-draining-slowly.jpeg",
        "title": "Kitchen sink draining slowly",
        "category_id": "cat_plumbing",
        "resident": "demo.resident@simplifix.app",
        "resident_note": "Water pools in the sink for a few minutes before it clears.",
        "ai_description": "Partial blockage in the kitchen sink waste pipe. Recommend "
        "snaking the trap and the downstream line.",
        "priority": Priority.Medium,
        "status": TicketStatus.Pending,
        "age_days": 1,
    },
    {
        "key": "photo-faulty-ac",
        "photo": "faulty-ac-not-cooling.jpeg",
        "title": "Bedroom AC runs but does not cool",
        "category_id": "cat_hvac",
        "resident": "rohan.mehta@simplifix.app",
        "resident_note": "The indoor unit is on and the fan works, but the room stays warm.",
        "ai_description": "Likely low refrigerant or a clogged filter. Inspect the filter, "
        "gas pressure and the outdoor unit.",
        "priority": Priority.High,
        "status": TicketStatus.Assigned,
        "worker": "deepak.chauhan@simplifix.app",
        "age_days": 2,
    },
    {
        "key": "photo-sparking-socket",
        "photo": "sparking-socket-in-living-room.jpeg",
        "title": "Living room socket sparks when used",
        "category_id": "cat_electrical",
        "resident": "kavya.reddy@simplifix.app",
        "resident_note": "A visible spark and a faint burning smell when I plug in the TV.",
        "ai_description": "Loose connection or damaged socket in the living room. Isolate "
        "the circuit before inspection; replace the socket if the terminals are scorched.",
        "priority": Priority.Critical,
        "status": TicketStatus.In_Progress,
        "worker": "imran.sheikh@simplifix.app",
        "age_days": 3,
    },
    {
        "key": "photo-door-scrapes-floor",
        "photo": "door-scrapes-floor.jpeg",
        "title": "Main door scrapes the floor and won't latch",
        "category_id": "cat_carpentry",
        "resident": "arjun.iyer@simplifix.app",
        "resident_note": "The door drags on the tiles and the latch no longer lines up.",
        "ai_description": "Door has dropped on a worn top hinge. Realign the leaf and "
        "tighten or replace the hinge; check the strike plate alignment.",
        "priority": Priority.Low,
        "status": TicketStatus.Pending,
        "age_days": 1,
    },
    {
        "key": "photo-damp-patch-ceiling",
        "photo": "damp-patch-ceiling.png",
        "title": "Damp patch spreading on the ceiling",
        "category_id": "cat_civil",
        "resident": "sneha.patel@simplifix.app",
        "resident_note": "Brown stain near the bathroom, larger after every spell of rain.",
        "ai_description": "Water seepage from the slab above, consistent with a failed "
        "waterproofing joint. Trace the source before patching and repainting.",
        "priority": Priority.Medium,
        "status": TicketStatus.Assigned,
        "worker": "suresh.yadav@simplifix.app",
        "age_days": 4,
    },
    {
        "key": "photo-cockroach-kitchen",
        "photo": "cockroach-infested-kitchen.jpg",
        "title": "Cockroaches in the kitchen every night",
        "category_id": "cat_pest",
        "resident": "demo.resident@simplifix.app",
        "resident_note": "Seeing several near the sink cabinet after dark.",
        "ai_description": "Minor cockroach infestation localised to the kitchen. Schedule "
        "a licensed pest-control gel treatment with a follow-up visit.",
        "priority": Priority.Medium,
        "status": TicketStatus.Resolved,
        "worker": "demo.staff@simplifix.app",
        "resolution_remarks": "Gel bait applied to the kitchen cabinets and skirting; "
        "follow-up scheduled in two weeks.",
        "age_days": 9,
    },
    {
        "key": "photo-lift-stopping",
        "photo": "lift-stopping-between-floors.png",
        "title": "Wing A lift stops between floors",
        "category_id": "cat_lift",
        "resident": "rohan.mehta@simplifix.app",
        "resident_note": "The cabin jerks and stops misaligned with the landing.",
        "ai_description": "Irregular levelling in the Wing A lift. Requires the AMC "
        "elevator technician to check the levelling sensors and brake.",
        "priority": Priority.Critical,
        "status": TicketStatus.In_Progress,
        "worker": "demo.staff@simplifix.app",
        "age_days": 5,
    },
    {
        "key": "photo-cctv-camera",
        "photo": "cctc-camera-not-working.jpg",
        "title": "Wing A entrance CCTV camera offline",
        "category_id": "cat_security",
        "resident": "kavya.reddy@simplifix.app",
        "resident_note": "The guard desk monitor shows 'no signal' for the main entrance feed.",
        "ai_description": "CCTV feed loss at the Wing A entrance, likely a power or "
        "network fault at the camera junction box.",
        "priority": Priority.High,
        "status": TicketStatus.Pending,
        "age_days": 2,
    },
    {
        "key": "photo-garbage-uncollected",
        "photo": "garbage-bags-uncollected.jpeg",
        "title": "Garbage not collected on the 4th floor",
        "category_id": "cat_housekeeping",
        "resident": "arjun.iyer@simplifix.app",
        "resident_note": "Bags have been piling up in the corridor for two days.",
        "ai_description": "Missed housekeeping round on the Wing B 4th floor. Arrange an "
        "additional pickup and confirm the daily schedule with the agency.",
        "priority": Priority.Low,
        "status": TicketStatus.Resolved,
        "worker": "lakshmi.rao@simplifix.app",
        "resolution_remarks": "Corridor cleared and an extra evening pickup added for "
        "the B wing.",
        "age_days": 8,
    },
    {
        "key": "photo-gas-leak-stairwell",
        "photo": "gas-leak-smell-in-stairwell.png",
        "title": "Gas smell in the 2nd floor stairwell",
        "category_id": "cat_emergency",
        "resident": "sneha.patel@simplifix.app",
        "resident_note": "Strong LPG smell on the 2nd-floor landing right now.",
        "ai_description": "Suspected gas leak in the Wing B stairwell. Immediate hazard - "
        "isolate the riser, ventilate the area and dispatch the gas contractor.",
        "priority": Priority.Emergency,
        "status": TicketStatus.Assigned,
        "worker": "demo.staff@simplifix.app",
        "age_days": 0,
    },
]


def _id(key: str) -> str:
    """Stable UUID for a demo fixture, matching scripts.seed_demo_services."""
    return str(uuid5(NAMESPACE_URL, f"https://simplifix.app/demo/{key}"))


_s3_client = None


def _s3():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )
    return _s3_client


def _upload_photo(path: Path, uploader_id: str) -> str:
    """Upload one local image to S3 under the same key convention as app.core.storage."""
    content_type = _CONTENT_TYPE_BY_EXT.get(path.suffix.lower())
    if content_type is None:
        raise SystemExit(f"Unsupported photo type: {path.name}")
    key = f"photos/{uploader_id}/{uuid.uuid4()}{path.suffix.lower()}"
    _s3().put_object(
        Bucket=settings.S3_BUCKET_NAME,
        Key=key,
        Body=path.read_bytes(),
        ContentType=content_type,
    )
    return f"https://{settings.S3_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"


def _preflight(db) -> dict[str, User]:
    if not (
        settings.S3_BUCKET_NAME
        and settings.AWS_ACCESS_KEY_ID
        and settings.AWS_SECRET_ACCESS_KEY
    ):
        raise SystemExit(
            "S3 is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, "
            "AWS_REGION and S3_BUCKET_NAME in backend/.env (see docs/s3-setup.md)."
        )

    if not PHOTO_DIR.is_dir():
        raise SystemExit(f"Photo folder not found: {PHOTO_DIR}")
    for spec in COMPLAINTS:
        if not (PHOTO_DIR / spec["photo"]).is_file():
            raise SystemExit(f"Missing photo file: {PHOTO_DIR / spec['photo']}")

    needed_emails = {spec["resident"] for spec in COMPLAINTS}
    needed_emails |= {spec["worker"] for spec in COMPLAINTS if spec.get("worker")}
    users = {u.email: u for u in db.query(User).filter(User.email.in_(needed_emails)).all()}
    missing = sorted(needed_emails - set(users))
    if missing:
        raise SystemExit(
            "Missing account(s): "
            + ", ".join(missing)
            + ".\nRun `python -m scripts.seed_demo_users` first."
        )

    category_ids = {spec["category_id"] for spec in COMPLAINTS}
    found = {row[0] for row in db.query(Category.id).filter(Category.id.in_(category_ids)).all()}
    missing_categories = sorted(category_ids - found)
    if missing_categories:
        raise SystemExit(
            "Missing category/categories: "
            + ", ".join(missing_categories)
            + ".\nRun `python -m scripts.seed_categories` first."
        )

    return users


def seed() -> None:
    db = SessionLocal()
    try:
        users = _preflight(db)
        now = datetime.now(timezone.utc)
        created = 0
        skipped = 0

        for spec in COMPLAINTS:
            ticket_id = _id(spec["key"])
            if db.get(Ticket, ticket_id) is not None:
                skipped += 1
                print(f"  skip (exists): {spec['title']}")
                continue

            resident = users[spec["resident"]]
            worker = users.get(spec["worker"]) if spec.get("worker") else None
            requested_at = now - timedelta(days=spec["age_days"])
            resolved = spec["status"] == TicketStatus.Resolved

            media_url = _upload_photo(PHOTO_DIR / spec["photo"], resident.id)

            db.add(
                Ticket(
                    id=ticket_id,
                    title=spec["title"],
                    resident_id=resident.id,
                    worker_id=worker.id if worker else None,
                    category_id=spec["category_id"],
                    resident_note=spec["resident_note"],
                    image_url=media_url,
                    media_type=MediaType.Image,
                    ai_description=spec["ai_description"],
                    ai_confidence=0.9,
                    priority=spec["priority"],
                    status=spec["status"],
                    cost_responsibility=CostResponsibility.Society,
                    date_of_request=requested_at,
                    date_of_resolution=now - timedelta(hours=5) if resolved else None,
                    resolution_remarks=spec.get("resolution_remarks"),
                )
            )
            db.add(
                TicketMedia(
                    id=_id(f"{spec['key']}-media"),
                    ticket_id=ticket_id,
                    media_url=media_url,
                    media_type=MediaType.Image,
                    uploaded_at=requested_at,
                )
            )
            db.add(
                TicketHistory(
                    id=_id(f"{spec['key']}-history-created"),
                    ticket_id=ticket_id,
                    old_status=None,
                    new_status=TicketStatus.Pending,
                    remarks="Demo complaint submitted",
                    actor_id=resident.id,
                    changed_at=requested_at,
                )
            )
            if spec["status"] != TicketStatus.Pending:
                db.add(
                    TicketHistory(
                        id=_id(f"{spec['key']}-history-current"),
                        ticket_id=ticket_id,
                        old_status=TicketStatus.Pending,
                        new_status=spec["status"],
                        remarks=spec.get("resolution_remarks", "Demo status updated"),
                        actor_id=worker.id if worker else resident.id,
                        changed_at=requested_at + timedelta(hours=6),
                    )
                )

            created += 1
            worker_note = f" -> {worker.email}" if worker else ""
            print(
                f"  created: {spec['title']}  ({resident.email}{worker_note}) "
                f"[{spec['status'].value}]"
            )

        db.commit()
        print(f"\nSeeded {created} photo complaint(s); {skipped} already existed.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    try:
        seed()
    except SystemExit as exc:
        print(exc, file=sys.stderr)
        raise
