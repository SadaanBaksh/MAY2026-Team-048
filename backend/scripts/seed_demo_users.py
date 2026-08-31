"""Seed demo accounts, all active, sharing a known password.

`DEMO_USERS` is one account per role and backs the frontend's "demo account"
quick-login chips. `ADDITIONAL_USERS` adds extra residents, maintenance staff and
facility employees so assignment, workload and notice-targeting demos have more
than one person per role to work with. Run from backend/ with the venv active:

    python -m scripts.seed_demo_users
"""

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.apartment import Apartment
from app.models.enums import AccountStatus, UserRole
from app.models.user import User

DEMO_PASSWORD = "Demo@1234"

# Exactly one account per role - the frontend's DEMO_CREDENTIALS and
# scripts.seed_demo_services both look these up by email, so don't grow this list;
# add extra people to ADDITIONAL_USERS below instead.
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

# Extra roster depth. Same shared password and active status. Residents give a
# building + unit_number; the apartment row is created on demand (and Wing B here
# gives the manager's notice-targeting a second tower to aim at).
ADDITIONAL_USERS = [
    # Residents
    {
        "email": "rohan.mehta@simplifix.app",
        "name": "Rohan Mehta",
        "phone": "+91 98200 44556",
        "role": UserRole.resident,
        "avatar_color": "#2563EB",
        "building": "Wing A",
        "unit_number": "A-204",
    },
    {
        "email": "kavya.reddy@simplifix.app",
        "name": "Kavya Reddy",
        "phone": "+91 98200 66778",
        "role": UserRole.resident,
        "avatar_color": "#DB2777",
        "building": "Wing A",
        "unit_number": "A-312",
    },
    {
        "email": "arjun.iyer@simplifix.app",
        "name": "Arjun Iyer",
        "phone": "+91 98200 88990",
        "role": UserRole.resident,
        "avatar_color": "#0D9488",
        "building": "Wing B",
        "unit_number": "B-105",
    },
    {
        "email": "sneha.patel@simplifix.app",
        "name": "Sneha Patel",
        "phone": "+91 98200 12131",
        "role": UserRole.resident,
        "avatar_color": "#9333EA",
        "building": "Wing B",
        "unit_number": "B-408",
    },
    # Maintenance staff
    {
        "email": "suresh.yadav@simplifix.app",
        "name": "Suresh Yadav",
        "phone": "+91 90210 77889",
        "role": UserRole.maintenance_staff,
        "avatar_color": "#B45309",
        "specialization": "Plumbing",
    },
    {
        "email": "imran.sheikh@simplifix.app",
        "name": "Imran Sheikh",
        "phone": "+91 90210 99001",
        "role": UserRole.maintenance_staff,
        "avatar_color": "#1D4ED8",
        "specialization": "Electrical",
    },
    {
        "email": "deepak.chauhan@simplifix.app",
        "name": "Deepak Chauhan",
        "phone": "+91 90210 21324",
        "role": UserRole.maintenance_staff,
        "avatar_color": "#0F766E",
        "specialization": "HVAC & Appliances",
    },
    {
        "email": "lakshmi.rao@simplifix.app",
        "name": "Lakshmi Rao",
        "phone": "+91 90210 43546",
        "role": UserRole.maintenance_staff,
        "avatar_color": "#BE123C",
        "specialization": "Carpentry",
    },
    # Facility employees
    {
        "email": "vikram.desai@simplifix.app",
        "name": "Vikram Desai",
        "phone": "+91 90210 65768",
        "role": UserRole.facility_employee,
        "avatar_color": "#6D28D9",
        "title": "Facility Coordinator",
    },
    {
        "email": "anjali.menon@simplifix.app",
        "name": "Anjali Menon",
        "phone": "+91 90210 87980",
        "role": UserRole.facility_employee,
        "avatar_color": "#C2410C",
        "title": "Facility Supervisor",
    },
]

# The platform admin. Not tied to any role chip in the frontend - it signs in through the
# normal employee login page and lands on the admin-only manager CRUD screen.
ADMIN_USER = {
    "email": "admin@simplifix.app",
    "name": "Platform Admin",
    "phone": "+91 90210 00000",
    "role": UserRole.admin,
    "avatar_color": "#5B5F6D",
}

# Every email this script is responsible for - reset_demo_data imports this so a
# reset keeps all seeded accounts, not just the original four.
SEED_EMAILS = [entry["email"] for entry in DEMO_USERS + ADDITIONAL_USERS + [ADMIN_USER]]


def _get_or_create_apartment(db, building: str, unit_number: str) -> Apartment:
    existing = (
        db.query(Apartment)
        .filter(
            Apartment.building.ilike(building),
            Apartment.unit_number.ilike(unit_number),
        )
        .first()
    )
    if existing is not None:
        return existing
    apartment = Apartment(building=building, unit_number=unit_number)
    db.add(apartment)
    db.flush()
    return apartment


def seed() -> None:
    db = SessionLocal()
    try:
        hashed_password = hash_password(DEMO_PASSWORD)
        created = 0

        for entry in DEMO_USERS + ADDITIONAL_USERS + [ADMIN_USER]:
            if db.query(User).filter(User.email == entry["email"]).first() is not None:
                continue

            apartment_id = None
            if entry["role"] == UserRole.resident:
                apartment = _get_or_create_apartment(
                    db,
                    entry.get("building", "Wing A"),
                    entry.get("unit_number", "A-101"),
                )
                apartment_id = apartment.id

            is_staff = entry["role"] == UserRole.maintenance_staff
            user = User(
                name=entry["name"],
                email=entry["email"],
                phone=entry["phone"],
                role=entry["role"],
                avatar_color=entry["avatar_color"],
                hashed_password=hashed_password,
                account_status=AccountStatus.active,
                apartment_id=apartment_id,
                title=entry.get("title"),
                specialization=entry.get("specialization"),
                active_jobs=0 if is_staff else None,
                rating=0.0 if is_staff else None,
            )
            db.add(user)
            created += 1

        db.commit()
        print(
            f"Seeded {created} demo account(s) "
            f"({len(SEED_EMAILS)} total defined). Shared password: {DEMO_PASSWORD}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    seed()
