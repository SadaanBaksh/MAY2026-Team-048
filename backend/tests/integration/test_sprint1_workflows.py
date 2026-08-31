"""Cross-endpoint API integration tests.

These tests deliberately exercise workflows spanning multiple HTTP endpoints.  They
are separate from schema/OpenAPI contract checks and from the narrower endpoint
tests in ``tests/test_*.py``.
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.models.enums import UserRole


pytestmark = pytest.mark.integration


def _create_ticket(client, auth_headers, resident, category, **overrides) -> dict:
    payload = {
        "title": "Water leaking below kitchen sink",
        "category_id": category.id,
        "resident_note": "Leak started this morning and is getting worse.",
    }
    payload.update(overrides)
    response = client.post(
        "/api/v1/tickets/",
        json=payload,
        headers=auth_headers(resident),
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_int_001_resident_registration_login_and_profile_workflow(client, register_user):
    registration = {
        "name": "Sprint Resident",
        "email": "sprint.resident@example.com",
        "phone": "+91 98765 43210",
        "role": "resident",
        "password": "Testpass123",
        "building": "Wing S",
        "unit_number": "301",
    }

    register_response = register_user(registration)
    assert register_response.status_code == 201
    assert register_response.json()["account_status"] == "active"

    login_response = client.post(
        "/api/v1/auth/login",
        data={"username": registration["email"], "password": registration["password"]},
    )
    assert login_response.status_code == 200
    access_token = login_response.json()["access_token"]

    profile_response = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert profile_response.status_code == 200
    assert profile_response.json()["email"] == registration["email"]
    assert profile_response.json()["apartment_id"] is not None


def test_int_002_complete_ticket_lifecycle_updates_history_and_worker_rating(
    client,
    auth_headers,
    resident_user,
    employee_user,
    maintenance_user,
    make_category,
):
    category = make_category()
    ticket = _create_ticket(client, auth_headers, resident_user, category)
    ticket_url = f"/api/v1/tickets/{ticket['id']}"

    assign_response = client.patch(
        ticket_url,
        json={"worker_id": maintenance_user.id, "status": "Assigned"},
        headers=auth_headers(employee_user),
    )
    assert assign_response.status_code == 200
    assert assign_response.json()["worker_id"] == maintenance_user.id

    progress_response = client.patch(
        ticket_url,
        json={"status": "In_Progress"},
        headers=auth_headers(maintenance_user),
    )
    assert progress_response.status_code == 200

    resolve_response = client.patch(
        ticket_url,
        json={"status": "Resolved", "resolution_remarks": "Replaced the inlet hose."},
        headers=auth_headers(maintenance_user),
    )
    assert resolve_response.status_code == 200
    assert resolve_response.json()["date_of_resolution"] is not None

    close_response = client.patch(
        ticket_url,
        json={
            "status": "Closed",
            "resident_rating": 5,
            "resident_feedback": "Fixed well.",
            "cost_responsibility": "Society",
        },
        headers=auth_headers(resident_user),
    )
    assert close_response.status_code == 200
    assert close_response.json()["status"] == "Closed"
    assert close_response.json()["cost_responsibility"] == "Society"

    history_response = client.get(
        f"{ticket_url}/history", headers=auth_headers(resident_user)
    )
    assert history_response.status_code == 200
    assert [entry["new_status"] for entry in history_response.json()] == [
        "Pending",
        "Assigned",
        "In_Progress",
        "Resolved",
        "Closed",
    ]

    worker_response = client.get(
        f"/api/v1/users/{maintenance_user.id}", headers=auth_headers(employee_user)
    )
    assert worker_response.status_code == 200
    assert worker_response.json()["rating"] == 5.0


def test_int_003_comment_creates_worker_notification_and_can_be_marked_read(
    client,
    auth_headers,
    resident_user,
    employee_user,
    maintenance_user,
    make_category,
):
    ticket = _create_ticket(client, auth_headers, resident_user, make_category())
    client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"worker_id": maintenance_user.id, "status": "Assigned"},
        headers=auth_headers(employee_user),
    )

    comment_response = client.post(
        f"/api/v1/tickets/{ticket['id']}/comments",
        json={"message": "The water supply is now turned off."},
        headers=auth_headers(resident_user),
    )
    assert comment_response.status_code == 201

    notifications_response = client.get(
        "/api/v1/notifications/me", headers=auth_headers(maintenance_user)
    )
    assert notifications_response.status_code == 200
    message_notification = next(
        item for item in notifications_response.json() if item["title"] == "New message"
    )
    assert message_notification["ticket_id"] == ticket["id"]
    assert message_notification["is_read"] is False

    read_response = client.patch(
        f"/api/v1/notifications/{message_notification['id']}/read",
        headers=auth_headers(maintenance_user),
    )
    assert read_response.status_code == 200
    assert read_response.json()["is_read"] is True


def test_int_004_ticket_and_comment_access_is_isolated_between_residents(
    client,
    auth_headers,
    resident_user,
    make_user,
    make_category,
):
    ticket = _create_ticket(client, auth_headers, resident_user, make_category())
    other_resident = make_user(role=UserRole.resident)

    list_response = client.get("/api/v1/tickets/", headers=auth_headers(other_resident))
    ticket_response = client.get(
        f"/api/v1/tickets/{ticket['id']}", headers=auth_headers(other_resident)
    )
    comments_response = client.get(
        f"/api/v1/tickets/{ticket['id']}/comments", headers=auth_headers(other_resident)
    )

    assert list_response.status_code == 200
    assert list_response.json() == []
    assert ticket_response.status_code == 403
    assert comments_response.status_code == 403


def test_int_005_uploaded_photo_is_attached_to_new_ticket(
    client,
    auth_headers,
    resident_user,
    make_category,
    mock_s3,
):
    upload_response = client.post(
        "/api/v1/uploads/",
        files={"file": ("leak.jpg", b"integration-test-image", "image/jpeg")},
        data={"kind": "photo"},
        headers=auth_headers(resident_user),
    )
    assert upload_response.status_code == 200
    uploaded_url = upload_response.json()["url"]

    ticket = _create_ticket(
        client,
        auth_headers,
        resident_user,
        make_category(),
        photo_urls=[uploaded_url],
    )
    ticket_response = client.get(
        f"/api/v1/tickets/{ticket['id']}", headers=auth_headers(resident_user)
    )

    assert ticket_response.status_code == 200
    assert ticket_response.json()["image_url"] == uploaded_url
    assert ticket_response.json()["media"][0]["media_url"] == uploaded_url
    assert len(mock_s3) == 1


def test_int_006_resident_cannot_close_ticket_before_resolution(
    client,
    auth_headers,
    resident_user,
    make_category,
):
    ticket = _create_ticket(client, auth_headers, resident_user, make_category())

    response = client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"status": "Closed", "resident_rating": 5},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Only resolved tickets can be closed"


def test_int_007_public_service_assignment_resolution_and_history_workflow(
    client,
    auth_headers,
    resident_user,
    employee_user,
    maintenance_user,
    make_category,
    monkeypatch,
):
    category = make_category(id="cat_electrical", name="Electrical")
    monkeypatch.setattr(
        "app.api.v1.endpoints.public_services._score_candidates", lambda *_: []
    )

    create_response = client.post(
        "/api/v1/public-services/",
        json={
            "title": "Corridor light keeps flickering",
            "description": "The common corridor light switches off every few seconds.",
            "location": "Wing A, third floor",
            "category_id": category.id,
            "priority": "Medium",
        },
        headers=auth_headers(resident_user),
    )
    assert create_response.status_code == 201, create_response.text
    service = create_response.json()
    service_url = f"/api/v1/public-services/{service['id']}"

    employee_notifications = client.get(
        "/api/v1/notifications/me", headers=auth_headers(employee_user)
    )
    assert employee_notifications.status_code == 200
    assert any(
        item["public_service_id"] == service["id"]
        and item["title"] == "New public service report"
        for item in employee_notifications.json()
    )

    assign_response = client.patch(
        service_url,
        json={"worker_id": maintenance_user.id},
        headers=auth_headers(employee_user),
    )
    assert assign_response.status_code == 200, assign_response.text
    assert assign_response.json()["status"] == "Assigned"

    assigned_jobs = client.get(
        "/api/v1/public-services/", headers=auth_headers(maintenance_user)
    )
    assert assigned_jobs.status_code == 200
    assert [item["id"] for item in assigned_jobs.json()] == [service["id"]]

    progress_response = client.patch(
        service_url,
        json={"status": "In_Progress"},
        headers=auth_headers(maintenance_user),
    )
    assert progress_response.status_code == 200

    comment_response = client.post(
        f"{service_url}/comments",
        json={"message": "The issue affects the full corridor."},
        headers=auth_headers(resident_user),
    )
    assert comment_response.status_code == 201

    resolve_response = client.patch(
        service_url,
        json={
            "status": "Resolved",
            "resolution_remarks": "Replaced the faulty LED driver.",
        },
        headers=auth_headers(maintenance_user),
    )
    assert resolve_response.status_code == 200, resolve_response.text
    assert resolve_response.json()["resolved_at"] is not None

    history_response = client.get(
        f"{service_url}/history", headers=auth_headers(resident_user)
    )
    assert history_response.status_code == 200
    assert [entry["new_status"] for entry in history_response.json()] == [
        "Pending",
        "Assigned",
        "In_Progress",
        "Resolved",
    ]


def test_int_008_targeted_notice_delivery_and_notification_workflow(
    client,
    auth_headers,
    manager_user,
    make_apartment,
    make_user,
):
    target_apartment = make_apartment(building="Tower N", unit_number="101")
    other_apartment = make_apartment(building="Tower S", unit_number="202")
    target_resident = make_user(
        role=UserRole.resident, apartment_id=target_apartment.id
    )
    other_resident = make_user(
        role=UserRole.resident, apartment_id=other_apartment.id
    )

    create_response = client.post(
        "/api/v1/notices/",
        json={
            "title": "Water supply interruption",
            "body": "Water will be unavailable from 10 AM to noon.",
            "brief_points": ["Store water before 10 AM"],
            "target_buildings": ["Tower N"],
            "timezone": "Asia/Kolkata",
            "expires_at": (
                datetime.now(timezone.utc) + timedelta(days=1)
            ).isoformat(),
        },
        headers=auth_headers(manager_user),
    )
    assert create_response.status_code == 201, create_response.text
    notice = create_response.json()

    hidden_response = client.get(
        "/api/v1/notices/", headers=auth_headers(target_resident)
    )
    assert hidden_response.status_code == 200
    assert hidden_response.json() == []

    send_response = client.post(
        f"/api/v1/notices/{notice['id']}/send",
        headers=auth_headers(manager_user),
    )
    assert send_response.status_code == 200, send_response.text
    assert send_response.json()["recipient_count"] == 1

    target_notices = client.get(
        "/api/v1/notices/", headers=auth_headers(target_resident)
    )
    other_notices = client.get(
        "/api/v1/notices/", headers=auth_headers(other_resident)
    )
    assert [item["id"] for item in target_notices.json()] == [notice["id"]]
    assert other_notices.json() == []

    notifications = client.get(
        "/api/v1/notifications/me", headers=auth_headers(target_resident)
    )
    assert notifications.status_code == 200
    delivered = next(
        item for item in notifications.json() if item["notice_id"] == notice["id"]
    )
    assert delivered["is_read"] is False

    read_response = client.patch(
        f"/api/v1/notifications/{delivered['id']}/read",
        headers=auth_headers(target_resident),
    )
    assert read_response.status_code == 200
    assert read_response.json()["is_read"] is True


def test_int_009_forgot_password_otp_reset_and_login_workflow(
    client, register_user, monkeypatch
):
    registration = {
        "name": "Password Reset Resident",
        "email": "password.reset@example.com",
        "phone": "+91 98765 43211",
        "role": "resident",
        "password": "OldPassword123",
        "building": "Wing R",
        "unit_number": "909",
    }
    assert register_user(registration).status_code == 201
    monkeypatch.setattr("app.api.v1.endpoints.auth.send_otp_email", lambda *_: None)

    send_response = client.post(
        "/api/v1/auth/send-otp",
        json={"email": registration["email"], "purpose": "forgot_password"},
    )
    assert send_response.status_code == 200, send_response.text

    from app.services.otp import _otp_store

    otp = _otp_store[(registration["email"], "forgot_password")][0]
    verify_response = client.post(
        "/api/v1/auth/verify-otp",
        json={
            "email": registration["email"],
            "otp": otp,
            "purpose": "forgot_password",
        },
    )
    assert verify_response.status_code == 200, verify_response.text
    reset_token = verify_response.json()["reset_token"]

    reset_response = client.post(
        "/api/v1/auth/reset-password",
        json={"reset_token": reset_token, "new_password": "NewPassword123"},
    )
    assert reset_response.status_code == 200, reset_response.text

    old_login = client.post(
        "/api/v1/auth/login",
        data={"username": registration["email"], "password": registration["password"]},
    )
    new_login = client.post(
        "/api/v1/auth/login",
        data={"username": registration["email"], "password": "NewPassword123"},
    )
    assert old_login.status_code == 401
    assert new_login.status_code == 200


def test_int_010_ai_chat_persists_and_clears_conversation(
    client, auth_headers, resident_user, monkeypatch
):
    monkeypatch.setattr(
        "app.api.v1.endpoints.ai.generate_json",
        lambda **_: {
            "reply": "Your plumbing request is still pending.",
            "related_ticket_id": None,
            "suggestions": ["View requests"],
        },
    )

    chat_response = client.post(
        "/api/v1/ai/resident-chat",
        json={"message": "What is happening with my request?"},
        headers=auth_headers(resident_user),
    )
    assert chat_response.status_code == 200, chat_response.text

    history_response = client.get(
        "/api/v1/ai/chat-history", headers=auth_headers(resident_user)
    )
    assert history_response.status_code == 200
    assert [entry["role"] for entry in history_response.json()] == [
        "resident",
        "assistant",
    ]
    assert history_response.json()[1]["suggestions"] == ["View requests"]

    clear_response = client.delete(
        "/api/v1/ai/chat-history", headers=auth_headers(resident_user)
    )
    assert clear_response.status_code == 204
    assert client.get(
        "/api/v1/ai/chat-history", headers=auth_headers(resident_user)
    ).json() == []


def test_int_011_resident_cancellation_updates_history_and_employee_notification(
    client,
    auth_headers,
    resident_user,
    employee_user,
    make_category,
):
    ticket = _create_ticket(
        client, auth_headers, resident_user, make_category(id="cat_cancellation")
    )
    ticket_url = f"/api/v1/tickets/{ticket['id']}"

    cancel_response = client.patch(
        ticket_url,
        json={"status": "Cancelled"},
        headers=auth_headers(resident_user),
    )
    assert cancel_response.status_code == 200, cancel_response.text
    assert cancel_response.json()["status"] == "Cancelled"

    history_response = client.get(
        f"{ticket_url}/history", headers=auth_headers(resident_user)
    )
    assert [entry["new_status"] for entry in history_response.json()] == [
        "Pending",
        "Cancelled",
    ]

    notifications = client.get(
        "/api/v1/notifications/me", headers=auth_headers(employee_user)
    )
    assert notifications.status_code == 200
    assert any(
        item["ticket_id"] == ticket["id"] and "cancel" in item["title"].lower()
        for item in notifications.json()
    )
