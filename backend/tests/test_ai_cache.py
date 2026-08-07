"""Tests for the AI response cache (app.core.ai_cache).

Covers: fingerprint computation, cache hit/miss, TTL expiry, and invalidation.
"""

import time

from app.core.ai_cache import (
    _CACHE_TTL_SECONDS,
    _lock,
    _store,
    get_cached_summary,
    invalidate_summaries,
    make_cache_key,
    make_fingerprint,
    set_cached_summary,
)


def _clear_cache():
    """Reset module-level cache state between tests."""
    with _lock:
        _store.clear()


# ── make_fingerprint ────────────────────────────────────────────────────


def test_make_fingerprint_deterministic():
    assert make_fingerprint("hello") == make_fingerprint("hello")


def test_make_fingerprint_changes_with_input():
    assert make_fingerprint("a") != make_fingerprint("b")


def test_make_fingerprint_returns_hex_string():
    fp = make_fingerprint("test")
    assert isinstance(fp, str)
    assert len(fp) == 64  # SHA-256 hex digest


# ── make_cache_key ──────────────────────────────────────────────────────


def test_make_cache_key_format():
    assert make_cache_key("user-123", "resident") == "resident:user-123"


# ── get / set round-trip ────────────────────────────────────────────────


def test_cache_hit_on_matching_fingerprint():
    _clear_cache()
    key = make_cache_key("u1", "resident")
    fp = make_fingerprint("stats-text")
    response = {"summary": "All good."}

    set_cached_summary(key, fp, response)
    assert get_cached_summary(key, fp) == response


def test_cache_miss_on_different_fingerprint():
    _clear_cache()
    key = make_cache_key("u1", "resident")
    set_cached_summary(key, make_fingerprint("old-stats"), {"summary": "Old."})

    assert get_cached_summary(key, make_fingerprint("new-stats")) is None


def test_cache_miss_when_empty():
    _clear_cache()
    assert get_cached_summary("nonexistent", "fp") is None


def test_cache_miss_after_ttl_expiry(monkeypatch):
    _clear_cache()
    key = make_cache_key("u1", "resident")
    fp = make_fingerprint("data")
    set_cached_summary(key, fp, {"summary": "Cached."})

    # Monkey-patch time.monotonic to simulate TTL expiry
    original_monotonic = time.monotonic
    monkeypatch.setattr(
        "app.core.ai_cache.time.monotonic",
        lambda: original_monotonic() + _CACHE_TTL_SECONDS + 1,
    )

    assert get_cached_summary(key, fp) is None


# ── invalidate_summaries ────────────────────────────────────────────────


def test_invalidate_clears_all_entries():
    _clear_cache()
    for i in range(5):
        set_cached_summary(f"key-{i}", "fp", {"summary": f"S{i}"})

    invalidate_summaries()

    for i in range(5):
        assert get_cached_summary(f"key-{i}", "fp") is None


def test_invalidate_on_empty_cache_is_safe():
    _clear_cache()
    invalidate_summaries()  # should not raise
