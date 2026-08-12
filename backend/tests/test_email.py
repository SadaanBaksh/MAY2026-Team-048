import logging

import requests

from app.services.email import send_otp_email


def _configure_sendgrid(monkeypatch):
    monkeypatch.setattr("app.services.email.settings.SENDGRID_API_KEY", "SG.test-key")
    monkeypatch.setattr("app.services.email.settings.SENDGRID_FROM_EMAIL", "sender@example.com")


class _FakeResponse:
    def __init__(self, status_code=202):
        self.status_code = status_code

    def raise_for_status(self):
        pass


def test_send_otp_email_skips_when_api_key_missing(monkeypatch, caplog):
    monkeypatch.setattr("app.services.email.settings.SENDGRID_API_KEY", "")
    monkeypatch.setattr("app.services.email.settings.SENDGRID_FROM_EMAIL", "sender@example.com")

    def _unexpected_post(*args, **kwargs):
        raise AssertionError("requests.post should not be called without credentials")

    monkeypatch.setattr("app.services.email.requests.post", _unexpected_post)

    with caplog.at_level(logging.WARNING):
        send_otp_email("resident@example.com", "1234", "register")

    assert "SendGrid credentials not configured" in caplog.text


def test_send_otp_email_skips_when_from_email_missing(monkeypatch):
    monkeypatch.setattr("app.services.email.settings.SENDGRID_API_KEY", "SG.test-key")
    monkeypatch.setattr("app.services.email.settings.SENDGRID_FROM_EMAIL", "")

    def _unexpected_post(*args, **kwargs):
        raise AssertionError("requests.post should not be called without credentials")

    monkeypatch.setattr("app.services.email.requests.post", _unexpected_post)

    send_otp_email("resident@example.com", "1234", "register")


def test_send_otp_email_register_purpose_builds_expected_payload(monkeypatch):
    _configure_sendgrid(monkeypatch)
    captured = {}

    def _fake_post(url, headers, json, timeout):
        captured["url"] = url
        captured["headers"] = headers
        captured["json"] = json
        captured["timeout"] = timeout
        return _FakeResponse()

    monkeypatch.setattr("app.services.email.requests.post", _fake_post)

    send_otp_email("resident@example.com", "4242", "register")

    assert captured["url"] == "https://api.sendgrid.com/v3/mail/send"
    assert captured["headers"]["Authorization"] == "Bearer SG.test-key"
    assert captured["json"]["personalizations"] == [{"to": [{"email": "resident@example.com"}]}]
    assert captured["json"]["from"] == {"email": "sender@example.com", "name": "Simplifix"}
    assert "Welcome to Simplifix" in captured["json"]["subject"]
    assert "4242" in captured["json"]["content"][0]["value"]


def test_send_otp_email_forgot_password_purpose(monkeypatch):
    _configure_sendgrid(monkeypatch)
    captured = {}
    monkeypatch.setattr(
        "app.services.email.requests.post",
        lambda url, headers, json, timeout: captured.update(json=json) or _FakeResponse(),
    )

    send_otp_email("resident@example.com", "4242", "forgot_password")

    assert "Password Reset Request" in captured["json"]["subject"]
    assert "reset your password" in captured["json"]["content"][0]["value"]


def test_send_otp_email_change_password_purpose(monkeypatch):
    _configure_sendgrid(monkeypatch)
    captured = {}
    monkeypatch.setattr(
        "app.services.email.requests.post",
        lambda url, headers, json, timeout: captured.update(json=json) or _FakeResponse(),
    )

    send_otp_email("resident@example.com", "4242", "change_password")

    assert "Password Change Request" in captured["json"]["subject"]
    assert "change your password" in captured["json"]["content"][0]["value"]


def test_send_otp_email_unknown_purpose_uses_generic_body(monkeypatch):
    _configure_sendgrid(monkeypatch)
    captured = {}
    monkeypatch.setattr(
        "app.services.email.requests.post",
        lambda url, headers, json, timeout: captured.update(json=json) or _FakeResponse(),
    )

    send_otp_email("resident@example.com", "4242", "some_other_purpose")

    assert captured["json"]["subject"] == "Simplifix - OTP Verification"
    assert captured["json"]["content"][0]["value"] == "<p>Your OTP code is: <strong>4242</strong></p>"


def test_send_otp_email_logs_success(monkeypatch, caplog):
    _configure_sendgrid(monkeypatch)
    monkeypatch.setattr(
        "app.services.email.requests.post",
        lambda url, headers, json, timeout: _FakeResponse(),
    )

    with caplog.at_level(logging.INFO):
        send_otp_email("resident@example.com", "4242", "register")

    assert "OTP email sent successfully" in caplog.text


def test_send_otp_email_logs_error_with_response_body(monkeypatch, caplog):
    _configure_sendgrid(monkeypatch)

    error_response = _FakeResponse(status_code=403)
    error_response.text = "Forbidden: verify a sender identity"
    error = requests.exceptions.HTTPError("403 Forbidden")
    error.response = error_response

    def _raise(*args, **kwargs):
        raise error

    monkeypatch.setattr("app.services.email.requests.post", _raise)

    with caplog.at_level(logging.ERROR):
        send_otp_email("resident@example.com", "4242", "register")

    assert "Forbidden: verify a sender identity" in caplog.text


def test_send_otp_email_logs_error_without_response(monkeypatch, caplog):
    _configure_sendgrid(monkeypatch)

    def _raise(*args, **kwargs):
        raise requests.exceptions.ConnectionError("network unreachable")

    monkeypatch.setattr("app.services.email.requests.post", _raise)

    with caplog.at_level(logging.ERROR):
        send_otp_email("resident@example.com", "4242", "register")

    assert "network unreachable" in caplog.text
