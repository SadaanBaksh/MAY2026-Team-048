from datetime import datetime, timedelta, timezone

from app.models.enums import NoticeStatus, UserRole
from app.models.notice import Notice, NoticeTarget
from app.services.notices import process_due_notices, send_notice, targeted_residents, validate_ready


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


# --- NoticeCreate/NoticeUpdate schema validation ------------------------------------


def test_create_notice_rejects_blank_brief_point(client, auth_headers, manager_user):
    response = client.post(
        "/api/v1/notices/",
        json={"brief_points": ["   "], "target_buildings": []},
        headers=auth_headers(manager_user),
    )
    assert response.status_code == 422


def test_create_notice_rejects_overlong_brief_point(client, auth_headers, manager_user):
    response = client.post(
        "/api/v1/notices/",
        json={"brief_points": ["x" * 501], "target_buildings": []},
        headers=auth_headers(manager_user),
    )
    assert response.status_code == 422


def test_create_notice_rejects_invalid_timezone(client, auth_headers, manager_user):
    response = client.post(
        "/api/v1/notices/",
        json={"brief_points": ["Test"], "target_buildings": [], "timezone": "not a tz!"},
        headers=auth_headers(manager_user),
    )
    assert response.status_code == 422


def test_create_notice_rejects_naive_expires_at(client, auth_headers, manager_user):
    response = client.post(
        "/api/v1/notices/",
        json={
            "brief_points": ["Test"],
            "target_buildings": [],
            "expires_at": "2027-01-01T00:00:00",
        },
        headers=auth_headers(manager_user),
    )
    assert response.status_code == 422


def test_create_notice_with_no_target_buildings_succeeds(client, auth_headers, manager_user):
    response = client.post(
        "/api/v1/notices/",
        json={"brief_points": ["Test"], "target_buildings": []},
        headers=auth_headers(manager_user),
    )
    assert response.status_code == 201, response.text
    assert response.json()["target_buildings"] == []


def test_create_notice_rejects_unknown_tower(client, auth_headers, manager_user):
    response = client.post(
        "/api/v1/notices/",
        json={"brief_points": ["Test"], "target_buildings": ["Nonexistent Tower"]},
        headers=auth_headers(manager_user),
    )
    assert response.status_code == 422
    assert "Unknown tower" in response.json()["detail"]


def test_notice_404_for_unknown_id(client, auth_headers, manager_user):
    response = client.get("/api/v1/notices/does-not-exist", headers=auth_headers(manager_user))
    assert response.status_code == 404


def test_manager_sees_all_notices_in_list(client, auth_headers, manager_user, make_apartment):
    building = make_apartment(building="Tower A").building
    _draft(client, auth_headers, manager_user, building)

    response = client.get("/api/v1/notices/", headers=auth_headers(manager_user))

    assert response.status_code == 200
    assert len(response.json()) == 1


def test_other_roles_see_no_notices_in_list(client, auth_headers, employee_user):
    response = client.get("/api/v1/notices/", headers=auth_headers(employee_user))

    assert response.status_code == 200
    assert response.json() == []


def test_manager_can_view_any_notice_by_id(client, auth_headers, manager_user, make_apartment):
    building = make_apartment(building="Tower A").building
    draft = _draft(client, auth_headers, manager_user, building)

    response = client.get(f"/api/v1/notices/{draft['id']}", headers=auth_headers(manager_user))

    assert response.status_code == 200
    assert response.json()["id"] == draft["id"]


def test_resident_can_view_sent_notice_targeted_to_them(
    client, auth_headers, manager_user, make_apartment, make_user
):
    tower = make_apartment(building="Tower A")
    resident = make_user(role=UserRole.resident, apartment_id=tower.id)
    draft = _draft(client, auth_headers, manager_user, "Tower A")
    client.post(f"/api/v1/notices/{draft['id']}/send", headers=auth_headers(manager_user))

    response = client.get(f"/api/v1/notices/{draft['id']}", headers=auth_headers(resident))

    assert response.status_code == 200


def test_resident_cannot_view_draft_notice(
    client, auth_headers, manager_user, make_apartment, make_user
):
    tower = make_apartment(building="Tower A")
    resident = make_user(role=UserRole.resident, apartment_id=tower.id)
    draft = _draft(client, auth_headers, manager_user, "Tower A")

    response = client.get(f"/api/v1/notices/{draft['id']}", headers=auth_headers(resident))

    assert response.status_code == 403


def test_update_draft_notice_edits_every_field(
    client, auth_headers, manager_user, make_apartment
):
    make_apartment(building="Tower A")
    make_apartment(building="Tower B")
    draft = _draft(client, auth_headers, manager_user, "Tower A")

    new_expiry = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    response = client.patch(
        f"/api/v1/notices/{draft['id']}",
        json={
            "title": "Updated title",
            "body": "Updated body",
            "brief_points": ["Updated point"],
            "target_buildings": ["Tower B"],
            "timezone": "Asia/Kolkata",
            "expires_at": new_expiry,
        },
        headers=auth_headers(manager_user),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["title"] == "Updated title"
    assert body["target_buildings"] == ["Tower B"]


def test_update_notice_rejects_editing_sent_notice(
    client, auth_headers, manager_user, make_apartment, make_user
):
    tower = make_apartment(building="Tower A")
    make_user(role=UserRole.resident, apartment_id=tower.id)
    draft = _draft(client, auth_headers, manager_user, "Tower A")
    client.post(f"/api/v1/notices/{draft['id']}/send", headers=auth_headers(manager_user))

    response = client.patch(
        f"/api/v1/notices/{draft['id']}",
        json={"title": "New title"},
        headers=auth_headers(manager_user),
    )

    assert response.status_code == 409


def test_update_notice_rejects_null_non_expiry_field(
    client, auth_headers, manager_user, make_apartment
):
    make_apartment(building="Tower A")
    draft = _draft(client, auth_headers, manager_user, "Tower A")

    response = client.patch(
        f"/api/v1/notices/{draft['id']}",
        json={"title": None},
        headers=auth_headers(manager_user),
    )

    assert response.status_code == 422
    assert "cannot be null" in response.json()["detail"]


def test_update_notice_rejects_null_brief_points(
    client, auth_headers, manager_user, make_apartment
):
    make_apartment(building="Tower A")
    draft = _draft(client, auth_headers, manager_user, "Tower A")

    response = client.patch(
        f"/api/v1/notices/{draft['id']}",
        json={"brief_points": None},
        headers=auth_headers(manager_user),
    )

    assert response.status_code == 422
    assert "cannot be null" in response.json()["detail"]


def test_update_notice_accepts_null_target_buildings_as_no_change(
    client, auth_headers, manager_user, make_apartment
):
    make_apartment(building="Tower A")
    draft = _draft(client, auth_headers, manager_user, "Tower A")

    response = client.patch(
        f"/api/v1/notices/{draft['id']}",
        json={"target_buildings": None},
        headers=auth_headers(manager_user),
    )

    assert response.status_code == 200
    assert response.json()["target_buildings"] == ["Tower A"]


def test_update_scheduled_notice_revalidates_and_rejects_if_now_invalid(
    client, auth_headers, manager_user, make_apartment
):
    make_apartment(building="Tower A")
    draft = _draft(client, auth_headers, manager_user, "Tower A")
    scheduled_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    client.post(
        f"/api/v1/notices/{draft['id']}/schedule",
        json={"scheduled_at": scheduled_at},
        headers=auth_headers(manager_user),
    )

    response = client.patch(
        f"/api/v1/notices/{draft['id']}",
        json={"title": "   "},
        headers=auth_headers(manager_user),
    )

    assert response.status_code == 422
    assert "title" in response.json()["detail"].lower()


def test_send_notice_rejects_when_not_ready(client, auth_headers, manager_user):
    draft = _draft(client, auth_headers, manager_user, "Tower A", target_buildings=[])

    response = client.post(
        f"/api/v1/notices/{draft['id']}/send", headers=auth_headers(manager_user)
    )

    assert response.status_code == 422
    assert "tower" in response.json()["detail"].lower()


def test_schedule_notice_rejects_non_draft_or_scheduled_status(
    client, auth_headers, manager_user, make_apartment, make_user
):
    tower = make_apartment(building="Tower A")
    make_user(role=UserRole.resident, apartment_id=tower.id)
    draft = _draft(client, auth_headers, manager_user, "Tower A")
    client.post(f"/api/v1/notices/{draft['id']}/send", headers=auth_headers(manager_user))

    response = client.post(
        f"/api/v1/notices/{draft['id']}/schedule",
        json={"scheduled_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()},
        headers=auth_headers(manager_user),
    )

    assert response.status_code == 409


def test_schedule_notice_rejects_past_datetime(client, auth_headers, manager_user, make_apartment):
    make_apartment(building="Tower A")
    draft = _draft(client, auth_headers, manager_user, "Tower A")

    response = client.post(
        f"/api/v1/notices/{draft['id']}/schedule",
        json={"scheduled_at": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()},
        headers=auth_headers(manager_user),
    )

    assert response.status_code == 422
    assert "future" in response.json()["detail"].lower()


def test_schedule_notice_rejects_when_not_ready(client, auth_headers, manager_user):
    draft = _draft(client, auth_headers, manager_user, "Tower A", target_buildings=[])

    response = client.post(
        f"/api/v1/notices/{draft['id']}/schedule",
        json={"scheduled_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()},
        headers=auth_headers(manager_user),
    )

    assert response.status_code == 422
    assert "tower" in response.json()["detail"].lower()


def test_schedule_notice_rejects_naive_datetime(client, auth_headers, manager_user, make_apartment):
    make_apartment(building="Tower A")
    draft = _draft(client, auth_headers, manager_user, "Tower A")

    response = client.post(
        f"/api/v1/notices/{draft['id']}/schedule",
        json={"scheduled_at": "2027-01-01T10:00:00"},
        headers=auth_headers(manager_user),
    )

    assert response.status_code == 422


def test_cancel_draft_notice_succeeds(client, auth_headers, manager_user, make_apartment):
    make_apartment(building="Tower A")
    draft = _draft(client, auth_headers, manager_user, "Tower A")

    response = client.post(
        f"/api/v1/notices/{draft['id']}/cancel", headers=auth_headers(manager_user)
    )

    assert response.status_code == 200
    assert response.json()["status"] == "Cancelled"


def test_cancel_notice_rejects_non_cancellable_status(
    client, auth_headers, manager_user, make_apartment, make_user
):
    tower = make_apartment(building="Tower A")
    make_user(role=UserRole.resident, apartment_id=tower.id)
    draft = _draft(client, auth_headers, manager_user, "Tower A")
    client.post(f"/api/v1/notices/{draft['id']}/send", headers=auth_headers(manager_user))

    response = client.post(
        f"/api/v1/notices/{draft['id']}/cancel", headers=auth_headers(manager_user)
    )

    assert response.status_code == 409


def test_ai_draft_notice_rejects_naive_scheduled_at(
    client, auth_headers, manager_user, make_apartment
):
    make_apartment(building="Tower A")
    response = client.post(
        "/api/v1/ai/draft-notice",
        json={
            "brief_points": ["Test point"],
            "target_buildings": ["Tower A"],
            "scheduled_at": "2027-01-01T10:00:00",
        },
        headers=auth_headers(manager_user),
    )
    assert response.status_code == 422


def test_ai_draft_notice_accepts_aware_scheduled_at(
    client, auth_headers, manager_user, make_apartment, monkeypatch
):
    make_apartment(building="Tower A")
    monkeypatch.setattr(
        "app.api.v1.endpoints.ai.generate_json",
        lambda **kwargs: {"title": "Power maintenance", "body": "Electricity will be unavailable."},
    )

    response = client.post(
        "/api/v1/ai/draft-notice",
        json={
            "brief_points": ["Test point"],
            "target_buildings": ["Tower A"],
            "scheduled_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        },
        headers=auth_headers(manager_user),
    )
    assert response.status_code == 200, response.text


# --- services/notices.py direct unit coverage ---------------------------------------


def test_targeted_residents_returns_empty_list_when_notice_has_no_targets(
    db_session, manager_user
):
    notice = Notice(created_by_id=manager_user.id, title="T", body="B", brief_points=[])
    db_session.add(notice)
    db_session.commit()

    assert targeted_residents(db_session, notice) == []


def test_validate_ready_rejects_blank_title():
    notice = Notice(title="   ", body="Body", brief_points=[])
    notice.targets = [NoticeTarget(building="Tower A")]
    try:
        validate_ready(notice, delivery_at=datetime.now(timezone.utc))
        assert False, "expected ValueError"
    except ValueError as exc:
        assert "title" in str(exc).lower()


def test_validate_ready_rejects_blank_body():
    notice = Notice(title="Title", body="   ", brief_points=[])
    notice.targets = [NoticeTarget(building="Tower A")]
    try:
        validate_ready(notice, delivery_at=datetime.now(timezone.utc))
        assert False, "expected ValueError"
    except ValueError as exc:
        assert "message" in str(exc).lower()


def test_validate_ready_rejects_no_targets():
    notice = Notice(title="Title", body="Body", brief_points=[])
    notice.targets = []
    try:
        validate_ready(notice, delivery_at=datetime.now(timezone.utc))
        assert False, "expected ValueError"
    except ValueError as exc:
        assert "tower" in str(exc).lower()


def test_validate_ready_rejects_expiry_before_delivery():
    delivery_at = datetime.now(timezone.utc)
    notice = Notice(
        title="Title", body="Body", brief_points=[], expires_at=delivery_at - timedelta(minutes=1)
    )
    notice.targets = [NoticeTarget(building="Tower A")]
    try:
        validate_ready(notice, delivery_at=delivery_at)
        assert False, "expected ValueError"
    except ValueError as exc:
        assert "expiry" in str(exc).lower()


def test_send_notice_rejects_notice_that_is_already_sent(db_session, manager_user):
    notice = Notice(
        created_by_id=manager_user.id,
        title="Title",
        body="Body",
        brief_points=[],
        status=NoticeStatus.Sent,
    )
    notice.targets = [NoticeTarget(building="Tower A")]
    db_session.add(notice)
    db_session.commit()

    try:
        send_notice(db_session, notice)
        assert False, "expected ValueError"
    except ValueError as exc:
        assert "draft or scheduled" in str(exc).lower()


def test_process_due_notices_cancels_notice_that_fails_revalidation(db_session, manager_user):
    # Bypasses the /schedule endpoint's own validate_ready check to simulate a notice
    # that became invalid after being scheduled (e.g. targets removed by other means).
    notice = Notice(
        created_by_id=manager_user.id,
        title="",
        body="",
        brief_points=[],
        status=NoticeStatus.Scheduled,
        scheduled_at=datetime.now(timezone.utc) - timedelta(minutes=1),
    )
    db_session.add(notice)
    db_session.commit()

    dispatched = process_due_notices(db_session, now=datetime.now(timezone.utc))

    assert dispatched == 0
    assert db_session.get(Notice, notice.id).status == NoticeStatus.Cancelled
