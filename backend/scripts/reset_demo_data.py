"""Wipe all ticket/community/notice content from the database except the seeded demo accounts.

Empties every content table - tickets, comments, history, media, notifications, chat
messages, notices, public services and everything hanging off them - then deletes every
user that isn't one of DEMO_EMAILS (imported from scripts.seed_demo_users, so it tracks
every account that script creates) and every apartment not referenced by a remaining
(demo) user. Categories are left untouched - they're app configuration, not content.

The content tables are discovered from Base.metadata and deleted children-first, so this
stays correct as the schema grows. Everything runs in one transaction: a failure rolls
the whole thing back rather than leaving the database half-wiped.

Defaults to a DRY RUN that only prints what would happen. Run from backend/ with the venv
active, pointed at whichever database you mean to clear via DATABASE_URL:

    python -m scripts.reset_demo_data            # dry run, no changes
    python -m scripts.reset_demo_data --execute   # actually deletes, after a typed confirmation

To wipe the demo accounts as well (a full factory reset), use scripts.wipe_database instead.
"""

import argparse
from urllib.parse import urlsplit, urlunsplit

from sqlalchemy import func, text

from app.core.config import settings
from app.db.base import Base  # noqa: F401 - imports every model onto Base.metadata
from app.db.session import SessionLocal
from app.models.apartment import Apartment
from app.models.user import User
from scripts.seed_demo_users import SEED_EMAILS as DEMO_EMAILS

# Tables handled specially below (kept, or filtered) - everything else is content to clear.
_KEEP_TABLES = {"users", "apartments", "categories"}

# Base.metadata.sorted_tables is parent-to-child; reverse it for FK-safe deletes.
CONTENT_TABLES = [t for t in reversed(Base.metadata.sorted_tables) if t.name not in _KEEP_TABLES]


def _masked_db_url() -> str:
    parts = urlsplit(settings.DATABASE_URL)
    netloc = parts.netloc
    if "@" in netloc:
        _, host = netloc.rsplit("@", 1)
        netloc = f"***:***@{host}"
    return urlunsplit((parts.scheme, netloc, parts.path, "", ""))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--execute", action="store_true", help="Actually delete rows (default: dry run only)."
    )
    args = parser.parse_args()

    print(f"Target database: {_masked_db_url()}\n")

    db = SessionLocal()
    try:
        kept_users = (
            db.query(User)
            .filter(func.lower(User.email).in_([e.lower() for e in DEMO_EMAILS]))
            .all()
        )
        kept_ids = {u.id for u in kept_users}
        kept_apartment_ids = {u.apartment_id for u in kept_users if u.apartment_id}

        counts = {
            table.name: db.execute(text(f'SELECT count(*) FROM "{table.name}"')).scalar() or 0
            for table in CONTENT_TABLES
        }
        counts["users (non-demo)"] = (
            db.query(User).filter(~User.id.in_(kept_ids)).count()
            if kept_ids
            else db.query(User).count()
        )
        counts["apartments (unreferenced)"] = (
            db.query(Apartment).filter(~Apartment.id.in_(kept_apartment_ids)).count()
            if kept_apartment_ids
            else db.query(Apartment).count()
        )

        print(f"Demo accounts found and kept ({len(kept_users)}/{len(DEMO_EMAILS)} expected):")
        found_emails = {u.email.lower() for u in kept_users}
        for email in DEMO_EMAILS:
            marker = "OK" if email.lower() in found_emails else "MISSING"
            print(f"  [{marker}] {email}")

        print("\nWould delete:")
        for label, count in counts.items():
            print(f"  {label}: {count}")

        if not args.execute:
            print("\nDry run only — nothing changed. Re-run with --execute to apply.")
            return

        typed = input(
            f"\nType DELETE to permanently wipe the above from {_masked_db_url()}: "
        )
        if typed != "DELETE":
            print("Confirmation did not match — aborted, nothing changed.")
            return

        for table in CONTENT_TABLES:
            db.execute(table.delete())
        if kept_ids:
            db.query(User).filter(~User.id.in_(kept_ids)).delete(synchronize_session=False)
        else:
            db.query(User).delete(synchronize_session=False)
        if kept_apartment_ids:
            db.query(Apartment).filter(~Apartment.id.in_(kept_apartment_ids)).delete(
                synchronize_session=False
            )
        else:
            db.query(Apartment).delete(synchronize_session=False)

        db.commit()
        print("\nDone. Demo accounts and categories were preserved.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
