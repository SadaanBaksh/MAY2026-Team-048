"""Seed one demo account per role, all active, sharing a known password.

Backs the frontend's "demo account" quick-login chips. Run from backend/ with
the venv active: python -m scripts.seed_demo_users
"""

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.apartment import Apartment
from app.models.enums import AccountStatus, UserRole
from app.models.user import User

DEMO_PASSWORD = "Demo@1234"

DEMO_USERS = [
    {
        "email": "demo.resident@simplifix.app",
        "name": "Aditi Sharma",
        "phone": "+91 98200 11223",
        "role": UserRole.resident,
        "avatar_color": "#0c2d35",
    },
    {
        "email": "demo.employee@simplifix.app",
        "name": "Neha Kulkarni",
        "phone": "+91 90210 11223",
        "role": UserRole.facility_employee,
        "avatar_color": "#7A3FC2",
        "title": "Facility Coordinator",
    },
    {
        "email": "demo.staff@simplifix.app",
        "name": "Ravi Prasad",
        "phone": "+91 90210 33445",
        "role": UserRole.maintenance_staff,
        "avatar_color": "#C2740F",
        "specialization": "General Maintenance",
    },
    {
        "email": "demo.manager@simplifix.app",
        "name": "Priya Nair",
        "phone": "+91 90210 55667",
        "role": UserRole.facility_manager,
        "avatar_color": "#1C7A5A",
        "title": "Facility Manager",
    },
]


def seed() -> None:
    db = SessionLocal()
    try:
        existing_apartment = (
            db.query(Apartment)
            .filter(Apartment.building.ilike("Wing A"), Apartment.unit_number.ilike("A-101"))
            .first()
        )
        apartment = existing_apartment or Apartment(building="Wing A", unit_number="A-101")
        if existing_apartment is None:
            db.add(apartment)
            db.flush()

        created = 0
        for entry in DEMO_USERS:
            if db.query(User).filter(User.email == entry["email"]).first() is not None:
                continue

            user = User(
                name=entry["name"],
                email=entry["email"],
                phone=entry["phone"],
                role=entry["role"],
                avatar_color=entry["avatar_color"],
                hashed_password=hash_password(DEMO_PASSWORD),
                account_status=AccountStatus.active,
                apartment_id=apartment.id if entry["role"] == UserRole.resident else None,
                title=entry.get("title"),
                specialization=entry.get("specialization"),
                active_jobs=0 if entry["role"] == UserRole.maintenance_staff else None,
                rating=0.0 if entry["role"] == UserRole.maintenance_staff else None,
            )
            db.add(user)
            created += 1

        db.commit()
        print(f"Seeded {created} demo account(s). Shared password: {DEMO_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
