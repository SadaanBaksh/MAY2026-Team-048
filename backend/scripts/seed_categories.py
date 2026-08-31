"""Seed the categories table with the fixed category list used by the frontend.

Run from backend/ with the venv active: python -m scripts.seed_categories
"""

from app.db.session import SessionLocal
from app.models.category import Category

CATEGORIES = [
    {"id": "cat_emergency", "name": "Emergency Services", "icon": "warning-outline"},
    {"id": "cat_plumbing", "name": "Plumbing", "icon": "water-outline"},
    {"id": "cat_electrical", "name": "Electrical", "icon": "flash-outline"},
    {"id": "cat_civil", "name": "Civil & Structural", "icon": "construct-outline"},
    {"id": "cat_carpentry", "name": "Carpentry", "icon": "hammer-outline"},
    {"id": "cat_hvac", "name": "HVAC & Appliances", "icon": "snow-outline"},
    {"id": "cat_pest", "name": "Pest Control", "icon": "bug-outline"},
    {"id": "cat_lift", "name": "Lift & Elevator", "icon": "swap-vertical-outline"},
    {"id": "cat_security", "name": "Security & Common Area", "icon": "shield-checkmark-outline"},
    {"id": "cat_housekeeping", "name": "Cleaning & Housekeeping", "icon": "sparkles-outline"},
    # Neutral bucket for a genuine maintenance issue that fits none of the specific
    # categories above. It is NOT a bypass for non-maintenance input - the AI's
    # is_valid_complaint gate still rejects that before a ticket is ever created.
    {"id": "cat_general", "name": "General / Other", "icon": "ellipsis-horizontal-outline"},
]


def seed() -> None:
    db = SessionLocal()
    try:
        for entry in CATEGORIES:
            if db.get(Category, entry["id"]) is None:
                db.add(Category(**entry))
        db.commit()
        print(f"Seeded {len(CATEGORIES)} categories")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
