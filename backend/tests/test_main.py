import logging

from fastapi.testclient import TestClient

from app.main import app


def test_lifespan_warns_when_sendgrid_not_configured(monkeypatch, caplog):
    # Overrides the real (populated) values loaded from backend/.env, so this
    # exercises the "nobody configured SendGrid" branch regardless of local setup.
    monkeypatch.setattr("app.main.settings.SENDGRID_API_KEY", "")
    monkeypatch.setattr("app.main.settings.SENDGRID_FROM_EMAIL", "")

    with caplog.at_level(logging.WARNING):
        with TestClient(app):
            pass

    assert "SENDGRID_API_KEY / SENDGRID_FROM_EMAIL are not set" in caplog.text
