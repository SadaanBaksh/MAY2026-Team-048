import asyncio
from unittest.mock import MagicMock

import pytest

from app import scheduler


class _StopLoop(Exception):
    """Escapes notice_scheduler's `while True` after however many ticks a test needs."""


def test_process_notices_once_calls_process_due_notices_and_closes_session(monkeypatch):
    fake_db = MagicMock()
    monkeypatch.setattr(scheduler, "SessionLocal", lambda: fake_db)
    calls = []
    monkeypatch.setattr(scheduler, "process_due_notices", lambda db: calls.append(db))

    scheduler.process_notices_once()

    assert calls == [fake_db]
    fake_db.close.assert_called_once()


def test_process_notices_once_closes_session_even_if_processing_raises(monkeypatch):
    fake_db = MagicMock()
    monkeypatch.setattr(scheduler, "SessionLocal", lambda: fake_db)

    def _boom(db):
        raise RuntimeError("db exploded")

    monkeypatch.setattr(scheduler, "process_due_notices", _boom)

    with pytest.raises(RuntimeError, match="db exploded"):
        scheduler.process_notices_once()

    fake_db.close.assert_called_once()


def test_notice_scheduler_runs_process_notices_once_each_tick(monkeypatch):
    calls = []
    monkeypatch.setattr(scheduler, "process_notices_once", lambda: calls.append(1))

    tick_count = {"n": 0}

    async def _fake_sleep(seconds):
        assert seconds == 30
        tick_count["n"] += 1
        if tick_count["n"] > 1:
            raise _StopLoop

    monkeypatch.setattr(scheduler.asyncio, "sleep", _fake_sleep)

    with pytest.raises(_StopLoop):
        asyncio.run(scheduler.notice_scheduler())

    assert calls == [1]


def test_notice_scheduler_survives_process_notices_once_raising(monkeypatch):
    def _boom():
        raise RuntimeError("db outage")

    monkeypatch.setattr(scheduler, "process_notices_once", _boom)

    tick_count = {"n": 0}

    async def _fake_sleep(seconds):
        tick_count["n"] += 1
        if tick_count["n"] > 1:
            raise _StopLoop

    monkeypatch.setattr(scheduler.asyncio, "sleep", _fake_sleep)

    # A RuntimeError from process_notices_once must be swallowed by "except Exception:
    # continue" - only _StopLoop (raised from the second sleep call) should escape.
    with pytest.raises(_StopLoop):
        asyncio.run(scheduler.notice_scheduler())

    assert tick_count["n"] == 2
