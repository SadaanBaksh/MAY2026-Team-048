"""Seed mock private tickets and community services for the demo accounts.

The records use deterministic IDs, so this script is safe to run repeatedly. Run
from ``backend/`` after seeding categories and demo users:

    docker compose exec api python -m scripts.seed_demo_services
"""

from datetime import datetime, timedelta, timezone
from uuid import NAMESPACE_URL, uuid5

from app.db.session import SessionLocal
from app.models.category import Category
from app.models.comment import Comment
from app.models.enums import (
    CostResponsibility,
    Priority,
    PublicServiceStatus,
    TicketStatus,
)
from app.models.public_service import PublicReport, PublicService
from app.models.public_service_comment import PublicServiceComment
from app.models.public_service_history import PublicServiceHistory
from app.models.ticket import Ticket
from app.models.ticket_history import TicketHistory
from app.models.user import User
from scripts.seed_demo_users import DEMO_USERS


def _id(key: str) -> str:
    """Return a stable UUID for a demo fixture."""
    return str(uuid5(NAMESPACE_URL, f"https://simplifix.app/demo/{key}"))


PRIVATE_SERVICES = [
    {
        "key": "private-kitchen-sink",
        "title": "Kitchen sink is draining slowly",
        "category_id": "cat_plumbing",
        "resident_note": "Water collects in the sink for several minutes before draining.",
        "ai_description": "Likely partial blockage in the kitchen sink waste pipe.",
        "priority": Priority.Medium,
        "status": TicketStatus.Pending,
        "age_days": 1,
    },
    {
        "key": "private-bedroom-ac",
        "title": "Bedroom AC is not cooling",
        "category_id": "cat_hvac",
        "resident_note": "The indoor unit runs, but the room remains warm.",
        "ai_description": "Inspect the AC filter, refrigerant level, and outdoor unit.",
        "priority": Priority.High,
        "status": TicketStatus.Assigned,
        "age_days": 2,
        "assigned": True,
    },
    {
        "key": "private-bathroom-tap",
        "title": "Bathroom tap keeps dripping",
        "category_id": "cat_plumbing",
        "resident_note": "The wash-basin tap drips continuously even when fully closed.",
        "ai_description": "The tap washer or cartridge likely needs replacement.",
        "priority": Priority.Low,
        "status": TicketStatus.In_Progress,
        "age_days": 4,
        "assigned": True,
    },
    {
        "key": "private-door-hinge",
        "title": "Main door hinge repaired",
        "category_id": "cat_carpentry",
        "resident_note": "The main door was scraping the floor and difficult to close.",
        "ai_description": "Realign the door and tighten or replace the upper hinge.",
        "priority": Priority.Medium,
        "status": TicketStatus.Resolved,
        "age_days": 8,
        "assigned": True,
        "resolution_remarks": "Realigned the door and replaced the worn upper hinge.",
    },
]


COMMUNITY_SERVICES = [
    {
        "key": "community-lobby-light",
        "title": "Lobby light near Wing A is flickering",
        "description": "The ceiling light beside the Wing A notice board flickers after sunset.",
        "location": "Wing A ground-floor lobby",
        "category_id": "cat_electrical",
        "priority": Priority.Medium,
        "status": PublicServiceStatus.Pending,
        "age_days": 1,
        "comment": "It was flickering again around 8 PM yesterday.",
    },
    {
        "key": "community-garden-sprinkler",
        "title": "Garden sprinkler is flooding the walkway",
        "description": "A damaged sprinkler sprays across the path and leaves it slippery.",
        "location": "Central garden east walkway",
        "category_id": "cat_plumbing",
        "priority": Priority.High,
        "status": PublicServiceStatus.Assigned,
        "age_days": 3,
        "assigned": True,
        "comment": "Please place a caution sign until this is repaired.",
    },
    {
        "key": "community-lift-button",
        "title": "Wing A lift call button is sticking",
        "description": "The ground-floor call button sometimes remains pressed after use.",
        "location": "Wing A ground-floor lift lobby",
        "category_id": "cat_lift",
        "priority": Priority.High,
        "status": PublicServiceStatus.In_Progress,
        "age_days": 5,
        "assigned": True,
        "comment": "Maintenance inspected it this morning.",
    },
    {
        "key": "community-parking-light",
        "title": "Basement parking light restored",
        "description": "Two lights near the Wing A ramp had stopped working.",
        "location": "Basement parking, Wing A ramp",
        "category_id": "cat_electrical",
        "priority": Priority.Medium,
        "status": PublicServiceStatus.Resolved,
        "age_days": 9,
        "assigned": True,
        "resolution_remarks": "Replaced both failed LED fittings and tested the circuit.",
        "comment": "The ramp is well lit again, thank you.",
    },
]


def _demo_users(db) -> dict[str, User]:
    expected = {entry["email"]: entry["role"] for entry in DEMO_USERS}
    users = db.query(User).filter(User.email.in_(expected)).all()
    by_email = {user.email: user for user in users}
    missing = sorted(set(expected) - set(by_email))
    if missing:
        raise RuntimeError(
            "Missing demo account(s): "
            + ", ".join(missing)
            + ". Run `python -m scripts.seed_demo_users` first."
        )
    return by_email


def _require_categories(db) -> None:
    required = {
        item["category_id"] for item in PRIVATE_SERVICES + COMMUNITY_SERVICES
    }
    found = {row[0] for row in db.query(Category.id).filter(Category.id.in_(required)).all()}
    missing = sorted(required - found)
    if missing:
        raise RuntimeError(
            "Missing category/categories: "
            + ", ".join(missing)
            + ". Run `python -m scripts.seed_categories` first."
        )


def seed() -> None:
    db = SessionLocal()
    try:
        users = _demo_users(db)
        _require_categories(db)
        resident = users["demo.resident@simplifix.app"]
        employee = users["demo.employee@simplifix.app"]
        worker = users["demo.staff@simplifix.app"]
        now = datetime.now(timezone.utc)
        private_created = 0
        community_created = 0

        for spec in PRIVATE_SERVICES:
            ticket_id = _id(spec["key"])
            if db.get(Ticket, ticket_id) is not None:
                continue
            requested_at = now - timedelta(days=spec["age_days"])
            ticket = Ticket(
                id=ticket_id,
                title=spec["title"],
                resident_id=resident.id,
                worker_id=worker.id if spec.get("assigned") else None,
                category_id=spec["category_id"],
                resident_note=spec["resident_note"],
                ai_description=spec["ai_description"],
                ai_confidence=0.91,
                priority=spec["priority"],
                status=spec["status"],
                cost_responsibility=CostResponsibility.Society,
                date_of_request=requested_at,
                date_of_resolution=now - timedelta(hours=6)
                if spec["status"] == TicketStatus.Resolved
                else None,
                resolution_remarks=spec.get("resolution_remarks"),
            )
            db.add(ticket)
            db.add(
                TicketHistory(
                    id=_id(f'{spec["key"]}-history-created'),
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
                        id=_id(f'{spec["key"]}-history-current'),
                        ticket_id=ticket_id,
                        old_status=TicketStatus.Pending,
                        new_status=spec["status"],
                        remarks=spec.get("resolution_remarks", "Demo service status updated"),
                        actor_id=worker.id if spec.get("assigned") else employee.id,
                        changed_at=requested_at + timedelta(hours=4),
                    )
                )
            db.add(
                Comment(
                    id=_id(f'{spec["key"]}-comment'),
                    ticket_id=ticket_id,
                    user_id=employee.id,
                    message="This demo request has been reviewed by the facility team.",
                    posted_at=requested_at + timedelta(hours=2),
                )
            )
            private_created += 1

        for spec in COMMUNITY_SERVICES:
            service_id = _id(spec["key"])
            if db.get(PublicService, service_id) is not None:
                continue
            created_at = now - timedelta(days=spec["age_days"])
            resolved = spec["status"] == PublicServiceStatus.Resolved
            service = PublicService(
                id=service_id,
                created_by_id=resident.id,
                worker_id=worker.id if spec.get("assigned") else None,
                category_id=spec["category_id"],
                title=spec["title"],
                description=spec["description"],
                location=spec["location"],
                ai_summary=spec["description"],
                priority=spec["priority"],
                status=spec["status"],
                created_at=created_at,
                updated_at=now - timedelta(hours=2),
                resolved_at=now - timedelta(hours=2) if resolved else None,
                resolution_remarks=spec.get("resolution_remarks"),
            )
            db.add(service)
            db.add(
                PublicReport(
                    id=_id(f'{spec["key"]}-report'),
                    service_id=service_id,
                    author_id=resident.id,
                    title=spec["title"],
                    description=spec["description"],
                    location=spec["location"],
                    created_at=created_at,
                )
            )
            db.add(
                PublicServiceHistory(
                    id=_id(f'{spec["key"]}-history-created'),
                    service_id=service_id,
                    old_status=None,
                    new_status=PublicServiceStatus.Pending,
                    remarks="Demo community report submitted",
                    actor_id=resident.id,
                    changed_at=created_at,
                )
            )
            if spec["status"] != PublicServiceStatus.Pending:
                db.add(
                    PublicServiceHistory(
                        id=_id(f'{spec["key"]}-history-current'),
                        service_id=service_id,
                        old_status=PublicServiceStatus.Pending,
                        new_status=spec["status"],
                        remarks=spec.get("resolution_remarks", "Demo service status updated"),
                        actor_id=worker.id if spec.get("assigned") else employee.id,
                        changed_at=created_at + timedelta(hours=4),
                    )
                )
            db.add(
                PublicServiceComment(
                    id=_id(f'{spec["key"]}-comment'),
                    service_id=service_id,
                    user_id=resident.id,
                    message=spec["comment"],
                    posted_at=created_at + timedelta(hours=3),
                )
            )
            community_created += 1

        db.commit()
        print(
            f"Seeded {private_created} private and {community_created} community demo "
            "service(s). Existing demo fixtures were left unchanged."
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
