import asyncio

from app.db.session import SessionLocal
from app.services.notices import process_due_notices


def process_notices_once() -> None:
    db = SessionLocal()
    try:
        process_due_notices(db)
    finally:
        db.close()


async def notice_scheduler() -> None:
    """Dispatch due notices using server time, independently of connected devices."""
    while True:
        await asyncio.sleep(30)
        try:
            await asyncio.to_thread(process_notices_once)
        except Exception:
            # A temporary database outage must not permanently stop future scheduled deliveries.
            continue
