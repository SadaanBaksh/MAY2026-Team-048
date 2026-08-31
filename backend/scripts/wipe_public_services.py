"""Delete every public / community service and everything hanging off it.

Removes, in FK-safe order: public-service-linked notifications, public report media,
similarity suggestions, public-service history, public-service comments, public
reports, then the public services themselves. Private tickets, users, categories,
notices and apartments are left completely untouched.

Everything runs in one transaction - a failure rolls the whole thing back rather
than leaving a half-deleted feed.

Defaults to a DRY RUN that only prints row counts. Run from backend/ with the venv
active, pointed at whichever database you mean to clear via DATABASE_URL:

    python -m scripts.wipe_public_services              # dry run, no changes
    python -m scripts.wipe_public_services --execute    # actually deletes, after a typed confirmation
"""

import argparse
from urllib.parse import urlsplit, urlunsplit

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.notification import Notification
from app.models.public_service import PublicReport, PublicReportMedia, PublicService
from app.models.public_service_comment import PublicServiceComment
from app.models.public_service_history import PublicServiceHistory
from app.models.public_similarity import PublicSimilaritySuggestion

# Child-to-parent: each query only references rows deleted at or after its own step.
_DELETE_STEPS = [
    (
        "notifications (public-service)",
        lambda db: db.query(Notification).filter(Notification.public_service_id.isnot(None)),
    ),
    ("public_report_media", lambda db: db.query(PublicReportMedia)),
    ("public_similarity_suggestions", lambda db: db.query(PublicSimilaritySuggestion)),
    ("public_service_history", lambda db: db.query(PublicServiceHistory)),
    ("public_service_comments", lambda db: db.query(PublicServiceComment)),
    ("public_reports", lambda db: db.query(PublicReport)),
    ("public_services", lambda db: db.query(PublicService)),
]


def _masked_db_url() -> str:
    parts = urlsplit(settings.DATABASE_URL)
    netloc = parts.netloc
    if "@" in netloc:
        _, host = netloc.rsplit("@", 1)
        netloc = f"***:***@{host}"
    return urlunsplit((parts.scheme, netloc, parts.path, "", ""))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--execute", action="store_true", help="Actually delete rows (default: dry run only)."
    )
    args = parser.parse_args()

    print(f"Target database: {_masked_db_url()}\n")

    db = SessionLocal()
    try:
        print("Rows that would be deleted:")
        total = 0
        for label, query_for in _DELETE_STEPS:
            count = query_for(db).count()
            total += count
            print(f"  {label}: {count}")
        print(f"  ---\n  total: {total}")

        if not args.execute:
            print("\nDry run only - nothing changed. Re-run with --execute to apply.")
            return

        if total == 0:
            print("\nNothing to delete.")
            return

        typed = input(
            f"\nType DELETE to permanently remove all public services from "
            f"{_masked_db_url()}: "
        )
        if typed != "DELETE":
            print("Confirmation did not match - aborted, nothing changed.")
            return

        for _label, query_for in _DELETE_STEPS:
            query_for(db).delete(synchronize_session=False)

        db.commit()
        print(f"\nDone. Deleted {total} row(s). Private tickets and everything else untouched.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
