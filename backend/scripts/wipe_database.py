"""Wipe every row from every application table - a full factory reset of the data.

This empties all tables defined on ``Base.metadata`` (users, tickets, public
services, notices, chat, notifications, categories, apartments, ...) while leaving
the schema and Alembic's ``alembic_version`` row intact, so the database is ready
to be re-seeded without re-running migrations.

On PostgreSQL this is a single ``TRUNCATE ... RESTART IDENTITY CASCADE``; on other
backends it falls back to ``DELETE`` per table in reverse-dependency order.

Defaults to a DRY RUN that only prints row counts. Run from backend/ with the venv
active, pointed at whichever database you mean to clear via DATABASE_URL:

    python -m scripts.wipe_database              # dry run, no changes
    python -m scripts.wipe_database --execute    # actually wipes, after a typed confirmation

After wiping you typically want:

    python -m scripts.seed_categories
    python -m scripts.seed_demo_users
    python -m scripts.seed_demo_services   # optional
"""

import argparse
from urllib.parse import urlsplit, urlunsplit

from sqlalchemy import text

from app.core.config import settings
from app.db.base import Base  # noqa: F401 - imports every model onto Base.metadata
from app.db.session import SessionLocal

# Parent-to-child order from SQLAlchemy; reverse it for a FK-safe DELETE fallback.
ALL_TABLES = list(Base.metadata.sorted_tables)


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
        "--execute", action="store_true", help="Actually wipe rows (default: dry run only)."
    )
    args = parser.parse_args()

    print(f"Target database: {_masked_db_url()}\n")

    db = SessionLocal()
    try:
        print("Rows that would be deleted:")
        total = 0
        for table in ALL_TABLES:
            count = db.execute(text(f'SELECT count(*) FROM "{table.name}"')).scalar() or 0
            total += count
            print(f"  {table.name}: {count}")
        print(f"  ---\n  total: {total}")

        if not args.execute:
            print("\nDry run only - nothing changed. Re-run with --execute to apply.")
            return

        typed = input(
            f"\nType WIPE to permanently empty ALL {len(ALL_TABLES)} tables in "
            f"{_masked_db_url()}: "
        )
        if typed != "WIPE":
            print("Confirmation did not match - aborted, nothing changed.")
            return

        dialect = db.bind.dialect.name
        if dialect == "postgresql":
            names = ", ".join(f'"{table.name}"' for table in ALL_TABLES)
            db.execute(text(f"TRUNCATE TABLE {names} RESTART IDENTITY CASCADE"))
        else:
            # Children before parents. Wrap in the session transaction so a failure
            # rolls the whole thing back rather than leaving a half-empty database.
            for table in reversed(ALL_TABLES):
                db.execute(table.delete())

        db.commit()
        print(
            f"\nDone. Emptied {len(ALL_TABLES)} tables ({total} rows). "
            "Schema and alembic_version are untouched - re-seed as needed."
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
