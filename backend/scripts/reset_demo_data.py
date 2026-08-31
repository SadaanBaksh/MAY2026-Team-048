"""Wipe all ticket/user content from the database except the seeded demo accounts.

Deletes (in FK-safe order): notifications, ticket_media, ticket_history, comments, tickets,
then every user that isn't one of DEMO_EMAILS (imported from scripts.seed_demo_users, so it
tracks every account that script creates), then every apartment not referenced by a
remaining (demo) user. Categories are left untouched — they're app configuration, not content.

Defaults to a DRY RUN that only prints what would happen. Run from backend/ with the venv
active, pointed at whichever database you mean to clear via DATABASE_URL:

    python -m scripts.reset_demo_data            # dry run, no changes
    python -m scripts.reset_demo_data --execute   # actually deletes, after a typed confirmation
"""

import argparse
from urllib.parse import urlsplit, urlunsplit

from sqlalchemy import func

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.apartment import Apartment
from app.models.comment import Comment
from app.models.notification import Notification
from app.models.ticket import Ticket
from app.models.ticket_history import TicketHistory
from app.models.ticket_media import TicketMedia
from app.models.user import User
from scripts.seed_demo_users import SEED_EMAILS as DEMO_EMAILS


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
            "notifications": db.query(Notification).count(),
            "comments": db.query(Comment).count(),
            "ticket_history": db.query(TicketHistory).count(),
            "ticket_media": db.query(TicketMedia).count(),
            "tickets": db.query(Ticket).count(),
            "users (non-demo)": db.query(User).filter(~User.id.in_(kept_ids)).count()
            if kept_ids
            else db.query(User).count(),
            "apartments (unreferenced)": db.query(Apartment)
            .filter(~Apartment.id.in_(kept_apartment_ids))
            .count()
            if kept_apartment_ids
            else db.query(Apartment).count(),
        }

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

        db.query(Notification).delete(synchronize_session=False)
        db.query(Comment).delete(synchronize_session=False)
        db.query(TicketHistory).delete(synchronize_session=False)
        db.query(TicketMedia).delete(synchronize_session=False)
        db.query(Ticket).delete(synchronize_session=False)
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
    finally:
        db.close()


if __name__ == "__main__":
    main()
