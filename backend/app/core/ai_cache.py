"""In-memory AI response cache to avoid redundant Gemini API calls.

The dashboard-summary endpoint is the primary consumer.  Cached responses are
keyed by (user_id, role) and validated against a SHA-256 fingerprint of the
statistics text that was fed to the model.  A cached result is returned **only**
when the fingerprint still matches (i.e. no relevant database change has
occurred) *and* the entry hasn't exceeded the safety-net TTL.

Any ticket or user mutation that could affect summary content should call
``invalidate_summaries()`` to eagerly clear the entire cache.
"""

import hashlib
import logging
import threading
import time

logger = logging.getLogger(__name__)

_CACHE_TTL_SECONDS = 600  # 10-minute safety net

_lock = threading.Lock()
_store: dict[str, tuple[dict, str, float]] = {}  # key -> (response, fingerprint, timestamp)


def make_fingerprint(data: str) -> str:
    """Return a SHA-256 hex digest suitable for cache-staleness checks."""
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def make_cache_key(user_id: str, role: str) -> str:
    return f"{role}:{user_id}"


def get_cached_summary(cache_key: str, fingerprint: str) -> dict | None:
    """Return the cached response if the fingerprint matches and TTL is valid."""
    with _lock:
        entry = _store.get(cache_key)
        if entry is None:
            return None
        response, stored_fp, ts = entry
        if stored_fp != fingerprint:
            logger.debug("AI cache MISS (fingerprint changed) for %s", cache_key)
            del _store[cache_key]
            return None
        if (time.monotonic() - ts) > _CACHE_TTL_SECONDS:
            logger.debug("AI cache MISS (TTL expired) for %s", cache_key)
            del _store[cache_key]
            return None
        logger.debug("AI cache HIT for %s", cache_key)
        return response


def set_cached_summary(cache_key: str, fingerprint: str, response: dict) -> None:
    """Store a response in the cache with its fingerprint."""
    with _lock:
        _store[cache_key] = (response, fingerprint, time.monotonic())


def invalidate_summaries() -> None:
    """Clear the entire summary cache.

    Call this after any database mutation that could affect dashboard stats
    (ticket create/update, user account-status change, etc.).
    """
    with _lock:
        cleared = len(_store)
        _store.clear()
    if cleared:
        logger.debug("AI cache invalidated (%d entries cleared)", cleared)
