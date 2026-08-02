from starlette.requests import Request

from app.core.limiter import limiter, rate_limit_key_for_user
from app.core.security import create_access_token


def _request(headers: dict[str, str]) -> Request:
    encoded_headers = [(k.lower().encode(), v.encode()) for k, v in headers.items()]
    scope = {
        "type": "http",
        "headers": encoded_headers,
        "client": ("1.2.3.4", 12345),
    }
    return Request(scope)


def test_rate_limit_key_uses_user_id_from_token():
    token = create_access_token(subject="user-123")
    request = _request({"Authorization": f"Bearer {token}"})
    assert rate_limit_key_for_user(request) == "user:user-123"


def test_rate_limit_key_is_stable_across_different_client_ips():
    """A stolen token must not get a fresh budget just by switching source IP."""
    token = create_access_token(subject="user-123")
    request_a = _request({"Authorization": f"Bearer {token}"})
    request_a.scope["client"] = ("1.1.1.1", 1)
    request_b = _request({"Authorization": f"Bearer {token}"})
    request_b.scope["client"] = ("9.9.9.9", 2)
    assert rate_limit_key_for_user(request_a) == rate_limit_key_for_user(request_b)


def test_rate_limit_key_falls_back_to_ip_without_a_valid_token():
    assert rate_limit_key_for_user(_request({})) == "1.2.3.4"
    assert rate_limit_key_for_user(_request({"Authorization": "Bearer not-a-real-token"})) == "1.2.3.4"


def test_analyze_complaint_rate_limit_is_per_user_not_per_ip(
    client, auth_headers, resident_user, make_user, make_category, monkeypatch
):
    """Two residents calling from the same TestClient (same address) must get
    independent 6/minute budgets, since the limiter is now keyed by user id."""
    category = make_category(id="cat_plumbing", name="Plumbing", icon="water")
    monkeypatch.setattr(
        "app.api.v1.endpoints.ai.generate_multimodal_json",
        lambda **_: {
            "ai_description": "A kitchen faucet is leaking.",
            "category_id": category.id,
            "priority": "High",
            "confidence": 0.91,
        },
    )
    other_resident = make_user()
    limiter.enabled = True
    try:
        for _ in range(6):
            response = client.post(
                "/api/v1/ai/analyze-complaint",
                json={"resident_note": "Water is leaking under the kitchen tap"},
                headers=auth_headers(resident_user),
            )
            assert response.status_code == 200, response.text

        exhausted = client.post(
            "/api/v1/ai/analyze-complaint",
            json={"resident_note": "Water is leaking under the kitchen tap"},
            headers=auth_headers(resident_user),
        )
        assert exhausted.status_code == 429

        # Same "IP" (the TestClient), different user - must not be blocked by
        # resident_user's exhausted budget.
        other_response = client.post(
            "/api/v1/ai/analyze-complaint",
            json={"resident_note": "Water is leaking under the kitchen tap"},
            headers=auth_headers(other_resident),
        )
        assert other_response.status_code == 200, other_response.text
    finally:
        limiter.enabled = False
