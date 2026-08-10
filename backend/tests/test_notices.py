from datetime import datetime, timedelta, timezone

from app.models.enums import NoticeStatus, UserRole
from app.models.notice import Notice
from app.services.notices import process_due_notices


def _draft(client, auth_headers, manager, building: str, **overrides):
    payload = {
        "title": "Electricity shutdown",
        "body": "Electricity will be unavailable from 2 PM to 4 PM.",
        "brief_points": ["Electricity will be unavailable from 2 PM to 4 PM"],
        "target_buildings": [building],
        "timezone": "Asia/Kolkata",
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
    }
    payload.update(overrides)
    response = client.post("/api/v1/notices/", json=payload, headers=auth_headers(manager))
    assert response.status_code == 201, response.text
    return response.json()


def test_only_managers_can_create_notices(
    client, auth_headers, employee_user, resident_user, make_apartment
):
    apartment = make_apartment(building="Tower A")
    payload = {"brief_points": ["Test"], "target_buildings": [apartment.building]}
    for user in (employee_user, resident_user):
        response = client.post("/api/v1/notices/", json=payload, headers=auth_headers(user))
        assert response.status_code == 403


def test_tower_list_includes_active_resident_count(
    client, auth_headers, manager_user, make_apartment, make_user
):
    apartment = make_apartment(building="Tower A")
    make_user(role=UserRole.resident, apartment_id=apartment.id)
    make_user(role=UserRole.resident, apartment_id=apartment.id)

    response = client.get("/api/v1/notices/towers", headers=auth_headers(manager_user))

    assert response.status_code == 200
    tower = next(row for row in response.json() if row["building"] == "Tower A")
    assert tower["resident_count"] == 2


def test_draft_is_saved_but_hidden_from_residents(
    client, auth_headers, manager_user, resident_user, make_apartment
):
    building = make_apartment(building="Tower A").building
    draft = _draft(client, auth_headers, manager_user, building)
    assert draft["status"] == "Draft"

    resident_list = client.get("/api/v1/notices/", headers=auth_headers(resident_user))
    assert resident_list.status_code == 200
    assert resident_list.json() == []


def test_send_targets_only_selected_tower_and_creates_deep_linked_notification(
    client, auth_headers, manager_user, make_apartment, make_user
):
    tower_a = make_apartment(building="Tower A")
    tower_b = make_apartment(building="Tower B")
    resident_a = make_user(role=UserRole.resident, apartment_id=tower_a.id)
    resident_b = make_user(role=UserRole.resident, apartment_id=tower_b.id)
    draft = _draft(client, auth_headers, manager_user, "Tower A")

    response = client.post(
        f"/api/v1/notices/{draft['id']}/send", headers=auth_headers(manager_user)
    )

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "Sent"
    assert response.json()["recipient_count"] == 1
    assert [row["id"] for row in client.get(
        "/api/v1/notices/", headers=auth_headers(resident_a)
    ).json()] == [draft["id"]]
    assert client.get("/api/v1/notices/", headers=auth_headers(resident_b)).json() == []
    notifications = client.get(
        "/api/v1/notifications/me", headers=auth_headers(resident_a)
    ).json()
    assert notifications[0]["notice_id"] == draft["id"]


def test_scheduled_notice_dispatches_once_when_server_time_is_due(
    client, auth_headers, manager_user, make_apartment, make_user, db_session
):
    tower = make_apartment(building="Tower A")
    resident = make_user(role=UserRole.resident, apartment_id=tower.id)
    draft = _draft(client, auth_headers, manager_user, "Tower A")
    scheduled_at = datetime.now(timezone.utc) + timedelta(hours=1)

    response = client.post(
        f"/api/v1/notices/{draft['id']}/schedule",
        json={"scheduled_at": scheduled_at.isoformat()},
        headers=auth_headers(manager_user),
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "Scheduled"

    due_time = scheduled_at + timedelta(seconds=1)
    assert process_due_notices(db_session, now=due_time) == 1
    assert process_due_notices(db_session, now=due_time + timedelta(seconds=1)) == 0
    notifications = client.get(
        "/api/v1/notifications/me", headers=auth_headers(resident)
    ).json()
    assert len([row for row in notifications if row["notice_id"] == draft["id"]]) == 1


def test_sent_notice_expires_using_server_time(
    client, auth_headers, manager_user, make_apartment, make_user, db_session
):
    tower = make_apartment(building="Tower A")
    make_user(role=UserRole.resident, apartment_id=tower.id)
    expiry = datetime.now(timezone.utc) + timedelta(hours=2)
    draft = _draft(
        client,
        auth_headers,
        manager_user,
        "Tower A",
        expires_at=expiry.isoformat(),
    )
    client.post(f"/api/v1/notices/{draft['id']}/send", headers=auth_headers(manager_user))

    process_due_notices(db_session, now=expiry + timedelta(seconds=1))

    assert db_session.get(Notice, draft["id"]).status == NoticeStatus.Expired


def test_ai_draft_receives_selected_towers(
    client, auth_headers, manager_user, employee_user, make_apartment, monkeypatch
):
    make_apartment(building="Tower A")
    captured = {}

    def fake_generate(**kwargs):
        captured.update(kwargs)
        return {"title": "Power maintenance", "body": "Electricity will be unavailable."}

    monkeypatch.setattr("app.api.v1.endpoints.ai.generate_json", fake_generate)
    payload = {
        "brief_points": ["Electricity will be down from 2 PM to 4 PM"],
        "target_buildings": ["Tower A"],
        # Browsers may return this valid legacy IANA alias; slim containers do not ship
        # zoneinfo data, and the name is metadata because timestamps carry their UTC offset.
        "timezone": "Asia/Calcutta",
    }
    response = client.post(
        "/api/v1/ai/draft-notice", json=payload, headers=auth_headers(manager_user)
    )

    assert response.status_code == 200, response.text
    assert "Target towers: Tower A" in captured["prompt"]
    forbidden = client.post(
        "/api/v1/ai/draft-notice", json=payload, headers=auth_headers(employee_user)
    )
    assert forbidden.status_code == 403
