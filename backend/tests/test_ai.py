import pytest

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
