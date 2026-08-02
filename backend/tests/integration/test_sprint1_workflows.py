"""Sprint 1 API integration tests.

These tests deliberately exercise workflows spanning multiple HTTP endpoints.  They
are separate from schema/OpenAPI contract checks and from the narrower endpoint
tests in ``tests/test_*.py``.
"""

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


def test_int_001_resident_registration_login_and_profile_workflow(client):
    registration = {
        "name": "Sprint Resident",
        "email": "sprint.resident@example.com",
        "phone": "+91 98765 43210",
        "role": "resident",
        "password": "Testpass123",
        "building": "Wing S",
        "unit_number": "301",
    }

    register_response = client.post("/api/v1/auth/register", json=registration)
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
        json={"status": "Closed", "resident_rating": 5, "resident_feedback": "Fixed well."},
        headers=auth_headers(resident_user),
    )
    assert close_response.status_code == 200
    assert close_response.json()["status"] == "Closed"

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


@pytest.mark.xfail(
    strict=True,
    reason="Expected HTTP 409, but the API currently returns 200 and closes a Pending ticket",
)
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
