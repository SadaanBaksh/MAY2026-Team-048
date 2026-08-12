import pytest

from app.models.enums import UserRole


@pytest.fixture()
def category(make_category):
    return make_category(id="cat_plumbing", name="Plumbing", icon="water")


def _ticket_payload(category_id: str, **overrides) -> dict:
    payload = {
        "title": "Leaking faucet",
        "category_id": category_id,
        "resident_note": "Kitchen faucet is leaking",
    }
    payload.update(overrides)
    return payload


def _create_ticket(client, auth_headers, resident_user, category, **overrides) -> dict:
    response = client.post(
        "/api/v1/tickets/",
        json=_ticket_payload(category.id, **overrides),
        headers=auth_headers(resident_user),
    )
    assert response.status_code == 201, response.text
    return response.json()


# --- create -----------------------------------------------------------------


def test_create_ticket_success(client, auth_headers, resident_user, category):
    body = _create_ticket(client, auth_headers, resident_user, category)

    assert body["status"] == "Pending"
    assert body["resident_id"] == resident_user.id
    assert body["priority"] == "Medium"
    assert body["cost_responsibility"] == "Pending Review"


def test_create_ticket_forbidden_for_non_resident(client, auth_headers, employee_user, category):
    response = client.post(
        "/api/v1/tickets/",
        json=_ticket_payload(category.id),
        headers=auth_headers(employee_user),
    )
    assert response.status_code == 403


def test_create_ticket_requires_auth(client, category):
    response = client.post("/api/v1/tickets/", json=_ticket_payload(category.id))
    assert response.status_code == 401


def test_create_ticket_with_photo_urls_creates_media_rows(
    client, auth_headers, resident_user, category
):
    photo_urls = ["https://example.com/a.jpg", "https://example.com/b.jpg"]
    body = _create_ticket(client, auth_headers, resident_user, category, photo_urls=photo_urls)

    assert body["image_url"] == photo_urls[0]
    assert body["media_type"] == "Image"
    assert {m["media_url"] for m in body["media"]} == set(photo_urls)


def test_create_ticket_rejects_overlong_title(client, auth_headers, resident_user, category):
    response = client.post(
        "/api/v1/tickets/",
        json=_ticket_payload(category.id, title="T" * 201),
        headers=auth_headers(resident_user),
    )
    assert response.status_code == 422


def test_create_ticket_creates_pending_history_row(
    client, auth_headers, resident_user, category
):
    ticket = _create_ticket(client, auth_headers, resident_user, category)

    response = client.get(
        f"/api/v1/tickets/{ticket['id']}/history", headers=auth_headers(resident_user)
    )

    assert response.status_code == 200
    history = response.json()
    assert len(history) == 1
    assert history[0]["old_status"] is None
    assert history[0]["new_status"] == "Pending"


# --- list ---------------------------------------------------------------------


def test_list_tickets_resident_sees_only_own(
    client, auth_headers, resident_user, make_user, category
):
    _create_ticket(client, auth_headers, resident_user, category)
    other_resident = make_user(role=UserRole.resident)
    _create_ticket(client, auth_headers, other_resident, category)

    response = client.get("/api/v1/tickets/", headers=auth_headers(resident_user))

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["resident_id"] == resident_user.id


def test_list_tickets_maintenance_sees_only_assigned(
    client, auth_headers, resident_user, employee_user, maintenance_user, make_user, category
):
    ticket = _create_ticket(client, auth_headers, resident_user, category)
    other_worker = make_user(role=UserRole.maintenance_staff)

    client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"worker_id": maintenance_user.id, "status": "Assigned"},
        headers=auth_headers(employee_user),
    )

    mine = client.get("/api/v1/tickets/", headers=auth_headers(maintenance_user))
    theirs = client.get("/api/v1/tickets/", headers=auth_headers(other_worker))

    assert len(mine.json()) == 1
    assert theirs.json() == []


def test_list_tickets_employee_and_manager_see_all(
    client, auth_headers, resident_user, employee_user, manager_user, make_user, category
):
    _create_ticket(client, auth_headers, resident_user, category)
    other_resident = make_user(role=UserRole.resident)
    _create_ticket(client, auth_headers, other_resident, category)

    for user in (employee_user, manager_user):
        response = client.get("/api/v1/tickets/", headers=auth_headers(user))
        assert len(response.json()) == 2


def test_list_tickets_status_filter(client, auth_headers, resident_user, employee_user, category):
    ticket = _create_ticket(client, auth_headers, resident_user, category)
    _create_ticket(client, auth_headers, resident_user, category)
    client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"cost_responsibility": "Society"},
        headers=auth_headers(employee_user),
    )

    response = client.get(
        "/api/v1/tickets/", params={"status_filter": "Pending"}, headers=auth_headers(resident_user)
    )

    assert response.status_code == 200
    assert len(response.json()) == 2


# --- get ------------------------------------------------------------------


def test_get_ticket_not_found(client, auth_headers, resident_user):
    response = client.get("/api/v1/tickets/does-not-exist", headers=auth_headers(resident_user))
    assert response.status_code == 404


def test_get_ticket_denied_for_unrelated_resident(
    client, auth_headers, resident_user, make_user, category
):
    ticket = _create_ticket(client, auth_headers, resident_user, category)
    other_resident = make_user(role=UserRole.resident)

    response = client.get(f"/api/v1/tickets/{ticket['id']}", headers=auth_headers(other_resident))

    assert response.status_code == 403


def test_get_ticket_denied_for_unassigned_maintenance(
    client, auth_headers, resident_user, maintenance_user, category
):
    ticket = _create_ticket(client, auth_headers, resident_user, category)

    response = client.get(
        f"/api/v1/tickets/{ticket['id']}", headers=auth_headers(maintenance_user)
    )

    assert response.status_code == 403


def test_get_ticket_allowed_for_employee_and_manager(
    client, auth_headers, resident_user, employee_user, manager_user, category
):
    ticket = _create_ticket(client, auth_headers, resident_user, category)

    for user in (employee_user, manager_user):
        response = client.get(f"/api/v1/tickets/{ticket['id']}", headers=auth_headers(user))
        assert response.status_code == 200


# --- update / lifecycle -----------------------------------------------------


def test_update_ticket_not_found(client, auth_headers, employee_user):
    response = client.patch(
        "/api/v1/tickets/does-not-exist",
        json={"status": "Assigned"},
        headers=auth_headers(employee_user),
    )
    assert response.status_code == 404


def test_employee_can_assign_ticket(
    client, auth_headers, resident_user, employee_user, maintenance_user, category
):
    ticket = _create_ticket(client, auth_headers, resident_user, category)

    response = client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={
            "category_id": category.id,
            "worker_id": maintenance_user.id,
            "priority": "High",
            "cost_responsibility": "Society",
            "status": "Assigned",
        },
        headers=auth_headers(employee_user),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "Assigned"
    assert body["priority"] == "High"

    history = client.get(
        f"/api/v1/tickets/{ticket['id']}/history", headers=auth_headers(employee_user)
    ).json()
    assert [h["new_status"] for h in history] == ["Pending", "Assigned"]


def test_resident_cannot_set_arbitrary_status(client, auth_headers, resident_user, category):
    ticket = _create_ticket(client, auth_headers, resident_user, category)

    response = client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"status": "Assigned"},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 403


def test_resident_can_cancel_pending_ticket(
    client, auth_headers, resident_user, employee_user, category
):
    ticket = _create_ticket(client, auth_headers, resident_user, category)

    response = client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"status": "Cancelled"},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "Cancelled"

    history = client.get(
        f"/api/v1/tickets/{ticket['id']}/history", headers=auth_headers(resident_user)
    ).json()
    assert [h["new_status"] for h in history] == ["Pending", "Cancelled"]

    notifications = client.get(
        "/api/v1/notifications/me", headers=auth_headers(employee_user)
    ).json()
    assert any(n["title"] == "Complaint cancelled" for n in notifications)


def test_resident_cannot_cancel_assigned_ticket(
    client, auth_headers, resident_user, employee_user, maintenance_user, category
):
    ticket = _create_ticket(client, auth_headers, resident_user, category)
    client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"worker_id": maintenance_user.id, "status": "Assigned"},
        headers=auth_headers(employee_user),
    )

    response = client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"status": "Cancelled"},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 403


def test_resident_cannot_update_other_fields(client, auth_headers, resident_user, category):
    ticket = _create_ticket(client, auth_headers, resident_user, category)

    response = client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"cost_responsibility": "Resident"},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 403


def test_maintenance_forbidden_field_rejected(
    client, auth_headers, resident_user, employee_user, maintenance_user, category
):
    ticket = _create_ticket(client, auth_headers, resident_user, category)
    client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"worker_id": maintenance_user.id, "status": "Assigned"},
        headers=auth_headers(employee_user),
    )

    response = client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"worker_id": maintenance_user.id},
        headers=auth_headers(maintenance_user),
    )

    assert response.status_code == 403


def test_maintenance_forbidden_for_unassigned_ticket(
    client, auth_headers, resident_user, maintenance_user, category
):
    ticket = _create_ticket(client, auth_headers, resident_user, category)

    response = client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"status": "In_Progress"},
        headers=auth_headers(maintenance_user),
    )

    assert response.status_code == 403


def test_full_ticket_lifecycle_and_resolution_date(
    client, auth_headers, resident_user, employee_user, maintenance_user, category
):
    ticket = _create_ticket(client, auth_headers, resident_user, category)

    assign = client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"worker_id": maintenance_user.id, "status": "Assigned"},
        headers=auth_headers(employee_user),
    )
    assert assign.status_code == 200

    start = client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"status": "In_Progress"},
        headers=auth_headers(maintenance_user),
    )
    assert start.status_code == 200

    resolve = client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={
            "status": "Resolved",
            "resolution_remarks": "Replaced the washer.",
            "resolution_proof_url": "https://example.com/proof.jpg",
        },
        headers=auth_headers(maintenance_user),
    )
    assert resolve.status_code == 200
    resolved_body = resolve.json()
    assert resolved_body["date_of_resolution"] is not None
    resolution_timestamp = resolved_body["date_of_resolution"]

    close = client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"status": "Closed", "resident_rating": 5, "resident_feedback": "Great work!"},
        headers=auth_headers(resident_user),
    )
    assert close.status_code == 200
    closed_body = close.json()
    assert closed_body["status"] == "Closed"

    # Regression check: closing must not re-stamp date_of_resolution to the close time.
    assert closed_body["date_of_resolution"] == resolution_timestamp

    history = client.get(
        f"/api/v1/tickets/{ticket['id']}/history", headers=auth_headers(resident_user)
    ).json()
    assert [h["new_status"] for h in history] == [
        "Pending",
        "Assigned",
        "In_Progress",
        "Resolved",
        "Closed",
    ]


def test_resident_cannot_close_before_resolved(client, auth_headers, resident_user, category):
    ticket = _create_ticket(client, auth_headers, resident_user, category)

    response = client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"status": "Closed", "resident_rating": 5},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Only resolved tickets can be closed"


# --- history -----------------------------------------------------------------


def test_ticket_history_denied_for_unrelated_user(
    client, auth_headers, resident_user, make_user, category
):
    ticket = _create_ticket(client, auth_headers, resident_user, category)
    other_resident = make_user(role=UserRole.resident)

    response = client.get(
        f"/api/v1/tickets/{ticket['id']}/history", headers=auth_headers(other_resident)
    )

    assert response.status_code == 403


def test_ticket_history_not_found(client, auth_headers, resident_user):
    response = client.get(
        "/api/v1/tickets/does-not-exist/history", headers=auth_headers(resident_user)
    )
    assert response.status_code == 404


# --- notifications -------------------------------------------------------------


def _notifications(client, auth_headers, user) -> list[dict]:
    response = client.get("/api/v1/notifications/me", headers=auth_headers(user))
    assert response.status_code == 200
    return response.json()


def test_create_ticket_notifies_employees(client, auth_headers, resident_user, employee_user, category):
    ticket = _create_ticket(client, auth_headers, resident_user, category)

    notifications = _notifications(client, auth_headers, employee_user)

    assert len(notifications) == 1
    assert notifications[0]["title"] == "New complaint submitted"
    assert notifications[0]["ticket_id"] == ticket["id"]


def test_create_emergency_ticket_uses_emergency_wording(
    client, auth_headers, resident_user, employee_user, category
):
    _create_ticket(client, auth_headers, resident_user, category, priority="Emergency")

    notifications = _notifications(client, auth_headers, employee_user)

    assert notifications[0]["title"] == "Emergency service request"


def test_assign_ticket_notifies_worker_and_resident(
    client, auth_headers, resident_user, employee_user, maintenance_user, category
):
    ticket = _create_ticket(client, auth_headers, resident_user, category)

    response = client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"worker_id": maintenance_user.id, "status": "Assigned"},
        headers=auth_headers(employee_user),
    )
    assert response.status_code == 200

    worker_notifications = _notifications(client, auth_headers, maintenance_user)
    assert any(n["title"] == "New assignment" for n in worker_notifications)

    resident_notifications = _notifications(client, auth_headers, resident_user)
    assert any(n["title"] == "Complaint assigned" for n in resident_notifications)


def test_start_progress_notifies_resident(
    client, auth_headers, resident_user, employee_user, maintenance_user, category
):
    ticket = _create_ticket(client, auth_headers, resident_user, category)
    client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"worker_id": maintenance_user.id, "status": "Assigned"},
        headers=auth_headers(employee_user),
    )

    response = client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"status": "In_Progress"},
        headers=auth_headers(maintenance_user),
    )
    assert response.status_code == 200

    resident_notifications = _notifications(client, auth_headers, resident_user)
    assert any(n["title"] == "Work started" for n in resident_notifications)


def test_resolve_ticket_notifies_resident_and_employees(
    client, auth_headers, resident_user, employee_user, maintenance_user, category
):
    ticket = _create_ticket(client, auth_headers, resident_user, category)
    client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"worker_id": maintenance_user.id, "status": "Assigned"},
        headers=auth_headers(employee_user),
    )

    response = client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"status": "Resolved", "resolution_remarks": "Fixed it."},
        headers=auth_headers(maintenance_user),
    )
    assert response.status_code == 200

    resident_notifications = _notifications(client, auth_headers, resident_user)
    assert any(n["title"] == "Complaint resolved" for n in resident_notifications)

    employee_notifications = _notifications(client, auth_headers, employee_user)
    assert any(n["title"] == "Work completed" for n in employee_notifications)


def test_close_with_rating_notifies_worker(
    client, auth_headers, resident_user, employee_user, maintenance_user, category
):
    ticket = _create_ticket(client, auth_headers, resident_user, category)
    client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"worker_id": maintenance_user.id, "status": "Assigned"},
        headers=auth_headers(employee_user),
    )
    client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"status": "Resolved", "resolution_remarks": "Fixed it."},
        headers=auth_headers(maintenance_user),
    )

    response = client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"status": "Closed", "resident_rating": 5, "resident_feedback": "Great!"},
        headers=auth_headers(resident_user),
    )
    assert response.status_code == 200

    worker_notifications = _notifications(client, auth_headers, maintenance_user)
    assert any(n["title"] == "Resident feedback received" for n in worker_notifications)


# --- worker rating -------------------------------------------------------------


def _assign_resolve_close(
    client, auth_headers, resident_user, employee_user, maintenance_user, category, rating
):
    ticket = _create_ticket(client, auth_headers, resident_user, category)
    client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"worker_id": maintenance_user.id, "status": "Assigned"},
        headers=auth_headers(employee_user),
    )
    client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"status": "Resolved", "resolution_remarks": "Fixed it."},
        headers=auth_headers(maintenance_user),
    )
    return client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"status": "Closed", "resident_rating": rating},
        headers=auth_headers(resident_user),
    )


def test_closing_ticket_updates_worker_rating(
    client, auth_headers, resident_user, employee_user, maintenance_user, category
):
    _assign_resolve_close(
        client, auth_headers, resident_user, employee_user, maintenance_user, category, rating=4
    )

    response = client.get(f"/api/v1/users/{maintenance_user.id}", headers=auth_headers(employee_user))
    assert response.status_code == 200
    assert response.json()["rating"] == 4.0


def test_worker_rating_is_averaged_across_tickets(
    client, auth_headers, resident_user, employee_user, maintenance_user, category
):
    _assign_resolve_close(
        client, auth_headers, resident_user, employee_user, maintenance_user, category, rating=5
    )
    _assign_resolve_close(
        client, auth_headers, resident_user, employee_user, maintenance_user, category, rating=3
    )

    response = client.get(f"/api/v1/users/{maintenance_user.id}", headers=auth_headers(employee_user))
    assert response.status_code == 200
    assert response.json()["rating"] == 4.0


def test_resident_rating_rejects_out_of_range_high(
    client, auth_headers, resident_user, employee_user, maintenance_user, category
):
    ticket = _create_ticket(client, auth_headers, resident_user, category)
    client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"worker_id": maintenance_user.id, "status": "Assigned"},
        headers=auth_headers(employee_user),
    )
    client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"status": "Resolved", "resolution_remarks": "Fixed it."},
        headers=auth_headers(maintenance_user),
    )

    response = client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"status": "Closed", "resident_rating": 999999},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 422


def test_resident_rating_rejects_out_of_range_low(
    client, auth_headers, resident_user, employee_user, maintenance_user, category
):
    ticket = _create_ticket(client, auth_headers, resident_user, category)
    client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"worker_id": maintenance_user.id, "status": "Assigned"},
        headers=auth_headers(employee_user),
    )
    client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"status": "Resolved", "resolution_remarks": "Fixed it."},
        headers=auth_headers(maintenance_user),
    )

    response = client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"status": "Closed", "resident_rating": 0},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 422
