from types import SimpleNamespace

import pytest

from app.core.gemini import GeminiError
from app.models.enums import UserRole


@pytest.fixture()
def category(make_category):
    return make_category(id="cat_plumbing", name="Plumbing", icon="water")


def test_analyze_complaint_uses_structured_result(
    client, auth_headers, resident_user, category, monkeypatch
):
    monkeypatch.setattr(
        "app.api.v1.endpoints.ai.generate_multimodal_json",
        lambda **_: {
            "ai_description": "A kitchen faucet is leaking.",
            "category_id": category.id,
            "priority": "High",
            "confidence": 0.91,
        },
    )

    response = client.post(
        "/api/v1/ai/analyze-complaint",
        json={"resident_note": "Water is leaking under the kitchen tap"},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 200, response.text
    assert response.json()["category_id"] == category.id
    assert response.json()["priority"] == "High"


def test_analyze_complaint_is_resident_only(client, auth_headers, employee_user, category):
    response = client.post(
        "/api/v1/ai/analyze-complaint",
        json={"resident_note": "Water is leaking"},
        headers=auth_headers(employee_user),
    )
    assert response.status_code == 403


def test_analyze_complaint_without_categories_configured(client, auth_headers, resident_user):
    response = client.post(
        "/api/v1/ai/analyze-complaint",
        json={"resident_note": "Water is leaking"},
        headers=auth_headers(resident_user),
    )
    assert response.status_code == 503


def test_analyze_complaint_gemini_error_becomes_503(
    client, auth_headers, resident_user, category, monkeypatch
):
    def _raise(**_):
        raise GeminiError("The AI service is currently unavailable. Please try again.")

    monkeypatch.setattr("app.api.v1.endpoints.ai.generate_multimodal_json", _raise)

    response = client.post(
        "/api/v1/ai/analyze-complaint",
        json={"resident_note": "Water is leaking"},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 503
    assert "currently unavailable" in response.json()["detail"]


def test_analyze_complaint_malformed_ai_result_becomes_503(
    client, auth_headers, resident_user, category, monkeypatch
):
    """The Gemini response can be valid JSON that still doesn't match our schema
    (e.g. priority outside the enum) - that must not surface as a raw 500."""
    monkeypatch.setattr(
        "app.api.v1.endpoints.ai.generate_multimodal_json",
        lambda **_: {"ai_description": "x", "category_id": category.id, "priority": "Not-A-Priority"},
    )

    response = client.post(
        "/api/v1/ai/analyze-complaint",
        json={"resident_note": "Water is leaking"},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 503


def test_resident_chat_only_returns_own_ticket_ids(
    client, auth_headers, resident_user, make_user, category, monkeypatch
):
    other_resident = make_user(role=UserRole.resident)
    monkeypatch.setattr(
        "app.api.v1.endpoints.ai.generate_json",
        lambda **_: {
            "reply": "Your newest complaint is being reviewed.",
            "related_ticket_id": "a-ticket-that-is-not-yours",
            "suggestions": ["Show active complaints"],
        },
    )

    response = client.post(
        "/api/v1/ai/resident-chat",
        json={"message": "What is my latest status?"},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 200, response.text
    assert response.json()["related_ticket_id"] is None


def test_resident_chat_accepts_valid_history_roles(
    client, auth_headers, resident_user, monkeypatch
):
    monkeypatch.setattr(
        "app.api.v1.endpoints.ai.generate_json",
        lambda **_: {"reply": "Sure thing.", "related_ticket_id": None, "suggestions": []},
    )

    response = client.post(
        "/api/v1/ai/resident-chat",
        json={
            "message": "Anything new?",
            "history": [
                {"role": "resident", "text": "Any update?"},
                {"role": "assistant", "text": "Not yet."},
            ],
        },
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 200, response.text


def test_resident_chat_is_resident_only(client, auth_headers, employee_user):
    response = client.post(
        "/api/v1/ai/resident-chat",
        json={"message": "What is my latest status?"},
        headers=auth_headers(employee_user),
    )
    assert response.status_code == 403


def test_resident_chat_gemini_error_becomes_503(client, auth_headers, resident_user, monkeypatch):
    def _raise(**_):
        raise GeminiError("AI is temporarily busy. Please try again in a minute.")

    monkeypatch.setattr("app.api.v1.endpoints.ai.generate_json", _raise)

    response = client.post(
        "/api/v1/ai/resident-chat",
        json={"message": "What is my latest status?"},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 503
    assert "temporarily busy" in response.json()["detail"]


def test_resident_chat_malformed_ai_result_becomes_503(client, auth_headers, resident_user, monkeypatch):
    """Missing the required 'reply' key - valid JSON, wrong shape."""
    monkeypatch.setattr(
        "app.api.v1.endpoints.ai.generate_json",
        lambda **_: {"related_ticket_id": None, "suggestions": []},
    )

    response = client.post(
        "/api/v1/ai/resident-chat",
        json={"message": "What is my latest status?"},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 503


def test_resident_chat_rejects_invalid_history_role(client, auth_headers, resident_user):
    response = client.post(
        "/api/v1/ai/resident-chat",
        json={
            "message": "What is my latest status?",
            "history": [{"role": "system", "text": "not a valid role"}],
        },
        headers=auth_headers(resident_user),
    )
    assert response.status_code == 422


class _FakeS3GetResponse:
    """Stands in for the urlopen() response media_part() reads from S3."""

    def __init__(self, content: bytes, content_type: str):
        self._content = content
        self.headers = SimpleNamespace(get_content_type=lambda: content_type)

    def read(self, size: int = -1) -> bytes:
        return self._content if size < 0 else self._content[:size]

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


def _upload(client, auth_headers, user, *, filename="photo.jpg", content_type="image/jpeg", kind="photo"):
    response = client.post(
        "/api/v1/uploads/",
        files={"file": (filename, b"fake-bytes", content_type)},
        data={"kind": kind},
        headers=auth_headers(user),
    )
    assert response.status_code == 200, response.text
    return response.json()["url"]


def test_analyze_complaint_rejects_another_users_photo_url(
    client, auth_headers, resident_user, make_user, category, mock_s3, monkeypatch
):
    """Regression test for a real gap: uploads used to have no owner recorded
    anywhere (a plain random uuid4 S3 key), so any resident could hand another
    resident's photo URL to analyze-complaint and have it analyzed. Fixed by
    embedding the uploader's id in the S3 key (upload_to_s3()) and checking it
    (upload_belongs_to()) before the endpoint touches the media."""
    other_resident = make_user(role=UserRole.resident)
    other_users_photo_url = _upload(client, auth_headers, other_resident)

    monkeypatch.setattr(
        "app.core.gemini.urlopen",
        lambda *args, **kwargs: _FakeS3GetResponse(b"fake-jpeg-bytes", "image/jpeg"),
    )
    monkeypatch.setattr(
        "app.api.v1.endpoints.ai.generate_multimodal_json",
        lambda **_: {
            "ai_description": "irrelevant to this test",
            "category_id": category.id,
            "priority": "Low",
            "confidence": 0.5,
        },
    )

    response = client.post(
        "/api/v1/ai/analyze-complaint",
        json={"resident_note": "test", "photo_urls": [other_users_photo_url]},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 403, response.text


def test_analyze_complaint_rejects_another_users_voice_note_url(
    client, auth_headers, resident_user, make_user, category, mock_s3, monkeypatch
):
    other_resident = make_user(role=UserRole.resident)
    other_users_voice_url = _upload(
        client, auth_headers, other_resident,
        filename="note.m4a", content_type="audio/m4a", kind="voice_note",
    )

    monkeypatch.setattr(
        "app.core.gemini.urlopen",
        lambda *args, **kwargs: _FakeS3GetResponse(b"fake-audio-bytes", "audio/m4a"),
    )
    monkeypatch.setattr("app.api.v1.endpoints.ai.generate_multimodal_json", lambda **_: {})

    response = client.post(
        "/api/v1/ai/analyze-complaint",
        json={"resident_note": "test", "voice_note_url": other_users_voice_url},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 403, response.text


def test_analyze_complaint_accepts_own_uploaded_photo_url(
    client, auth_headers, resident_user, category, mock_s3, monkeypatch
):
    """Happy-path coverage: the ownership check must not block a resident from
    analyzing their own just-uploaded photo - only someone else's."""
    own_photo_url = _upload(client, auth_headers, resident_user)

    monkeypatch.setattr(
        "app.core.gemini.urlopen",
        lambda *args, **kwargs: _FakeS3GetResponse(b"fake-jpeg-bytes", "image/jpeg"),
    )
    monkeypatch.setattr(
        "app.api.v1.endpoints.ai.generate_multimodal_json",
        lambda **_: {
            "ai_description": "A leaking pipe.",
            "category_id": category.id,
            "priority": "Medium",
            "confidence": 0.8,
        },
    )

    response = client.post(
        "/api/v1/ai/analyze-complaint",
        json={"resident_note": "test", "photo_urls": [own_photo_url]},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 200, response.text


def test_analyze_complaint_accepts_own_uploaded_voice_note_url(
    client, auth_headers, resident_user, category, mock_s3, monkeypatch
):
    own_voice_url = _upload(
        client, auth_headers, resident_user,
        filename="note.m4a", content_type="audio/m4a", kind="voice_note",
    )

    monkeypatch.setattr(
        "app.core.gemini.urlopen",
        lambda *args, **kwargs: _FakeS3GetResponse(b"fake-audio-bytes", "audio/m4a"),
    )
    monkeypatch.setattr(
        "app.api.v1.endpoints.ai.generate_multimodal_json",
        lambda **_: {
            "ai_description": "A noisy pipe.",
            "category_id": category.id,
            "priority": "Low",
            "confidence": 0.6,
        },
    )

    response = client.post(
        "/api/v1/ai/analyze-complaint",
        json={"resident_note": "test", "voice_note_url": own_voice_url},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 200, response.text


def test_dashboard_summary_resident(client, auth_headers, resident_user, monkeypatch):
    monkeypatch.setattr(
        "app.api.v1.endpoints.ai.generate_json",
        lambda **_: {"summary": "Test summary."},
    )
    response = client.get("/api/v1/ai/dashboard-summary", headers=auth_headers(resident_user))
    assert response.status_code == 200
    assert response.json() == {"summary": "Test summary."}


def test_dashboard_summary_employee(client, auth_headers, employee_user, monkeypatch):
    monkeypatch.setattr(
        "app.api.v1.endpoints.ai.generate_json",
        lambda **_: {"summary": "Test summary."},
    )
    response = client.get("/api/v1/ai/dashboard-summary", headers=auth_headers(employee_user))
    assert response.status_code == 200
    assert response.json() == {"summary": "Test summary."}


def test_dashboard_summary_manager(client, auth_headers, manager_user, monkeypatch):
    monkeypatch.setattr(
        "app.api.v1.endpoints.ai.generate_json",
        lambda **_: {"summary": "Test summary."},
    )
    response = client.get("/api/v1/ai/dashboard-summary", headers=auth_headers(manager_user))
    assert response.status_code == 200
    assert response.json() == {"summary": "Test summary."}


def test_dashboard_summary_maintenance(client, auth_headers, maintenance_user, monkeypatch):
    monkeypatch.setattr(
        "app.api.v1.endpoints.ai.generate_json",
        lambda **_: {"summary": "Test summary."},
    )
    response = client.get("/api/v1/ai/dashboard-summary", headers=auth_headers(maintenance_user))
    assert response.status_code == 200
    assert response.json() == {"summary": "Test summary."}


def test_dashboard_summary_unauthenticated(client):
    response = client.get("/api/v1/ai/dashboard-summary")
    assert response.status_code == 401


def test_dashboard_summary_resident_with_tickets(
    client, auth_headers, resident_user, category, monkeypatch
):
    """The four role-based tests above all use ticket-less users, so they never reach
    the 'if tickets:' branch (most-recent-ticket blurb) or the status-counting loop
    body - both require at least one real ticket to execute at all."""
    created = client.post(
        "/api/v1/tickets/",
        json={"title": "Leaking faucet", "category_id": category.id},
        headers=auth_headers(resident_user),
    )
    assert created.status_code == 201, created.text

    monkeypatch.setattr(
        "app.api.v1.endpoints.ai.generate_json",
        lambda **_: {"summary": "Test summary."},
    )
    response = client.get("/api/v1/ai/dashboard-summary", headers=auth_headers(resident_user))
    assert response.status_code == 200


def test_dashboard_summary_manager_with_resolved_tickets(
    client, auth_headers, resident_user, employee_user, manager_user, maintenance_user,
    category, monkeypatch,
):
    """Covers the manager-only average-resolution-time branch, which only runs when
    at least one ticket has actually been resolved (date_of_resolution is set)."""
    created = client.post(
        "/api/v1/tickets/",
        json={"title": "Leaking faucet", "category_id": category.id},
        headers=auth_headers(resident_user),
    ).json()
    client.patch(
        f"/api/v1/tickets/{created['id']}",
        json={"worker_id": maintenance_user.id, "status": "Assigned"},
        headers=auth_headers(employee_user),
    )
    resolved = client.patch(
        f"/api/v1/tickets/{created['id']}",
        json={"status": "Resolved", "resolution_remarks": "Fixed it."},
        headers=auth_headers(maintenance_user),
    )
    assert resolved.status_code == 200

    monkeypatch.setattr(
        "app.api.v1.endpoints.ai.generate_json",
        lambda **_: {"summary": "Test summary."},
    )
    response = client.get("/api/v1/ai/dashboard-summary", headers=auth_headers(manager_user))
    assert response.status_code == 200


def test_dashboard_summary_gemini_error_becomes_503(client, auth_headers, resident_user, monkeypatch):
    def _raise(**_):
        raise GeminiError("AI is temporarily busy. Please try again in a minute.")

    monkeypatch.setattr("app.api.v1.endpoints.ai.generate_json", _raise)

    response = client.get("/api/v1/ai/dashboard-summary", headers=auth_headers(resident_user))

    assert response.status_code == 503
    assert "temporarily busy" in response.json()["detail"]


def test_dashboard_summary_malformed_result_becomes_503(client, auth_headers, resident_user, monkeypatch):
    """Missing the required 'summary' key - valid JSON, wrong shape."""
    monkeypatch.setattr("app.api.v1.endpoints.ai.generate_json", lambda **_: {})

    response = client.get("/api/v1/ai/dashboard-summary", headers=auth_headers(resident_user))

    assert response.status_code == 503
