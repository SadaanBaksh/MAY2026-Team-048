"""Seed a ready-to-review "duplicate public reports" scenario.

Duplicates are no longer a ticket concept - the current model handles them through
**public services** plus AI similarity suggestions. This script creates two public
service pages about the same real-world problem (a water leak on the pool deck),
each filed by a different resident, and the *pending* PublicSimilaritySuggestion
row linking them - exactly the state a facility employee sees as the "these look
like duplicates, merge?" popup, without needing a live Gemini call.

It also adds two clearly unrelated public services so the non-duplicate case is
visible in the same feed.

Deterministic IDs, so it is safe to run repeatedly. Run from ``backend/`` after
seeding categories and demo users::

    python -m scripts.seed_categories
    python -m scripts.seed_demo_users
    python -m scripts.seed_duplicate_complaints
"""

from datetime import datetime, timedelta, timezone
from uuid import NAMESPACE_URL, uuid5

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.category import Category
from app.models.enums import (
    Priority,
    PublicServiceStatus,
    SimilaritySuggestionStatus,
    UserRole,
)
from app.models.public_service import PublicReport, PublicService
from app.models.public_service_history import PublicServiceHistory
from app.models.public_similarity import PublicSimilaritySuggestion
from app.models.user import User
from app.api.deps import notify_user

CATEGORY_ID = "cat_plumbing"

# Two residents report the same pool-deck leak in different words.
DUPLICATE_REPORTS = [
    {
        "key": "dup-pool-deck-a",
        "resident": "demo.resident@simplifix.app",
        "title": "Water leakage near the swimming pool deck",
        "description": "A steady trickle of water is spreading across the pool deck near "
        "the loungers and pooling by the drain. It has been like this since yesterday.",
        "location": "Clubhouse - swimming pool deck (north side)",
        "priority": Priority.Medium,
        "status": PublicServiceStatus.Pending,
        "age_days": 2,
    },
    {
        "key": "dup-pool-deck-b",
        "resident": "rohan.mehta@simplifix.app",
        "title": "Slippery puddle by the pool changing rooms",
        "description": "Large puddle forming outside the pool changing rooms - the tiles "
        "are very slippery and someone almost fell this morning. Looks like a leak.",
        "location": "Clubhouse pool area, near the changing rooms",
        "priority": Priority.High,
        "status": PublicServiceStatus.Pending,
        "age_days": 1,
    },
]

# Not duplicates of the above or of each other - kept so the feed has obvious non-matches too.
UNRELATED_REPORTS = [
    {
        "key": "dup-gate2-streetlight",
        "resident": "arjun.iyer@simplifix.app",
        "title": "Street light out near Gate 2",
        "description": "The street light on the driveway just inside Gate 2 has been off for "
        "three nights, the stretch is very dark for pedestrians.",
        "location": "Internal driveway, just inside Gate 2",
        "category_id": "cat_electrical",
        "priority": Priority.Medium,
        "status": PublicServiceStatus.Pending,
        "age_days": 3,
    },
    {
        "key": "dup-visitor-barrier",
        "resident": "kavya.reddy@simplifix.app",
        "title": "Visitor parking boom barrier stuck open",
        "description": "The boom barrier at the visitor parking entry has been stuck in the "
        "up position since morning, so anyone can drive in unchecked.",
        "location": "Visitor parking entry, near the security cabin",
        "category_id": "cat_security",
        "priority": Priority.High,
        "status": PublicServiceStatus.Assigned,
        "worker": "demo.staff@simplifix.app",
        "age_days": 1,
    },
]

# Pending suggestions to raise. Each pair points at two DUPLICATE_REPORTS keys.
SUGGESTIONS = [
    {
        "pair": ("dup-pool-deck-a", "dup-pool-deck-b"),
        "score": 0.91,
        "rationale": "Both describe water spreading across the clubhouse pool deck from "
        "an apparent leak, within a day of each other. Same asset, same area.",
    },
]


def _id(key: str) -> str:
    """Stable UUID for a demo fixture, matching scripts.seed_demo_services."""
    return str(uuid5(NAMESPACE_URL, f"https://simplifix.app/demo/{key}"))


def _require_users(db) -> dict[str, User]:
    all_specs = [*DUPLICATE_REPORTS, *UNRELATED_REPORTS]
    emails = {spec["resident"] for spec in all_specs}
    emails |= {spec["worker"] for spec in all_specs if spec.get("worker")}
    users = {u.email: u for u in db.query(User).filter(User.email.in_(emails)).all()}
    missing = sorted(emails - set(users))
    if missing:
        raise RuntimeError(
            "Missing account(s): "
            + ", ".join(missing)
            + ". Run `python -m scripts.seed_demo_users` first."
        )
    return users


def _require_categories(db) -> None:
    needed = {CATEGORY_ID} | {spec["category_id"] for spec in UNRELATED_REPORTS}
    found = {row[0] for row in db.query(Category.id).filter(Category.id.in_(needed)).all()}
    missing = sorted(needed - found)
    if missing:
        raise RuntimeError(
            "Missing category/categories: "
            + ", ".join(missing)
            + ". Run `python -m scripts.seed_categories` first."
        )


def _create_service(db, spec: dict, users: dict[str, User], now: datetime) -> None:
    service_id = _id(spec["key"])
    if db.get(PublicService, service_id) is not None:
        return
    resident = users[spec["resident"]]
    worker = users.get(spec["worker"]) if spec.get("worker") else None
    created_at = now - timedelta(days=spec["age_days"])

    db.add(
        PublicService(
            id=service_id,
            created_by_id=resident.id,
            worker_id=worker.id if worker else None,
            category_id=spec.get("category_id", CATEGORY_ID),
            title=spec["title"],
            description=spec["description"],
            location=spec["location"],
            ai_summary=spec["description"],
            priority=spec["priority"],
            status=spec["status"],
            created_at=created_at,
            updated_at=created_at,
        )
    )
    db.add(
        PublicReport(
            id=_id(f"{spec['key']}-report"),
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
            id=_id(f"{spec['key']}-history-created"),
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
                id=_id(f"{spec['key']}-history-current"),
                service_id=service_id,
                old_status=PublicServiceStatus.Pending,
                new_status=spec["status"],
                remarks="Demo status updated",
                actor_id=worker.id if worker else resident.id,
                changed_at=created_at + timedelta(hours=4),
            )
        )


def seed() -> None:
    db = SessionLocal()
    try:
        users = _require_users(db)
        _require_categories(db)
        now = datetime.now(timezone.utc)

        for spec in (*DUPLICATE_REPORTS, *UNRELATED_REPORTS):
            _create_service(db, spec, users, now)
        db.flush()

        employees = db.query(User).filter(User.role == UserRole.facility_employee).all()
        title_by_id = {_id(s["key"]): s["title"] for s in DUPLICATE_REPORTS}
        suggestions_created = 0
        for spec in SUGGESTIONS:
            id_a, id_b = sorted(_id(key) for key in spec["pair"])
            exists = (
                db.query(PublicSimilaritySuggestion)
                .filter(
                    PublicSimilaritySuggestion.service_a_id == id_a,
                    PublicSimilaritySuggestion.service_b_id == id_b,
                )
                .first()
            )
            if exists is not None:
                continue

            db.add(
                PublicSimilaritySuggestion(
                    id=_id(f"suggestion-{spec['pair'][0]}-{spec['pair'][1]}"),
                    service_a_id=id_a,
                    service_b_id=id_b,
                    score=spec["score"],
                    rationale=spec["rationale"],
                    model_name=settings.GEMINI_MODEL,
                    status=SimilaritySuggestionStatus.Pending,
                    created_at=now,
                )
            )
            title_a = title_by_id[id_a]
            title_b = title_by_id[id_b]
            for employee in employees:
                notify_user(
                    db,
                    user_id=employee.id,
                    public_service_id=id_b,
                    title="Possible duplicate public reports",
                    message=(
                        f'AI found a {spec["score"]:.0%} match between "{title_a}" and '
                        f'"{title_b}". Review whether they should be merged.'
                    ),
                )
            suggestions_created += 1

        db.commit()
        print(
            f"Seeded pool-deck duplicate scenario: "
            f"{len(DUPLICATE_REPORTS)} similar + {len(UNRELATED_REPORTS)} unrelated "
            f"public service(s), {suggestions_created} new pending merge suggestion(s) "
            f"for {len(employees)} facility employee(s). Existing fixtures left unchanged."
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
