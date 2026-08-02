from app.models.enums import UserRole


def test_read_current_user(client, auth_headers, resident_user):
    response = client.get("/api/v1/users/me", headers=auth_headers(resident_user))

    assert response.status_code == 200
    assert response.json()["id"] == resident_user.id


def test_read_current_user_requires_auth(client):
    response = client.get("/api/v1/users/me")
    assert response.status_code == 401


def test_list_users_no_filter(client, auth_headers, resident_user, employee_user):
    response = client.get("/api/v1/users/", headers=auth_headers(resident_user))

    assert response.status_code == 200
    ids = {row["id"] for row in response.json()}
    assert {resident_user.id, employee_user.id}.issubset(ids)


def test_list_users_with_role_filter(client, auth_headers, resident_user, employee_user):
    response = client.get(
        "/api/v1/users/",
        params={"role": "facility_employee"},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 200
    roles = {row["role"] for row in response.json()}
    assert roles == {"facility_employee"}


def test_get_user_by_id(client, auth_headers, resident_user, employee_user):
    response = client.get(f"/api/v1/users/{employee_user.id}", headers=auth_headers(resident_user))

    assert response.status_code == 200
    assert response.json()["id"] == employee_user.id


def test_get_user_not_found(client, auth_headers, resident_user):
    response = client.get("/api/v1/users/does-not-exist", headers=auth_headers(resident_user))
    assert response.status_code == 404


def test_update_self_succeeds(client, auth_headers, resident_user):
    response = client.patch(
        f"/api/v1/users/{resident_user.id}",
        json={"name": "Updated Name"},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Updated Name"


def test_update_other_user_forbidden_for_resident(client, auth_headers, resident_user, make_user):
    other_resident = make_user(role=UserRole.resident)

    response = client.patch(
        f"/api/v1/users/{other_resident.id}",
        json={"name": "Hacked Name"},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 403


def test_update_other_user_allowed_for_employee(
    client, auth_headers, employee_user, resident_user
):
    response = client.patch(
        f"/api/v1/users/{resident_user.id}",
        json={"account_status": "active"},
        headers=auth_headers(employee_user),
    )

    assert response.status_code == 200


def test_update_other_user_allowed_for_manager(client, auth_headers, manager_user, resident_user):
    response = client.patch(
        f"/api/v1/users/{resident_user.id}",
        json={"account_status": "rejected"},
        headers=auth_headers(manager_user),
    )

    assert response.status_code == 200
    assert response.json()["account_status"] == "rejected"


def test_update_email_conflict(client, auth_headers, resident_user, employee_user):
    response = client.patch(
        f"/api/v1/users/{resident_user.id}",
        json={"email": employee_user.email},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 400


def test_update_phone_conflict(client, auth_headers, make_user):
    resident = make_user(role=UserRole.resident, phone="+91 98765 43201")
    other = make_user(role=UserRole.resident, phone="+91 98765 43202")

    response = client.patch(
        f"/api/v1/users/{resident.id}",
        json={"phone": other.phone},
        headers=auth_headers(resident),
    )

    assert response.status_code == 400


def test_update_phone_conflict_across_equivalent_formats(client, auth_headers, make_user):
    resident = make_user(role=UserRole.resident, phone="+91 98765 43201")
    other = make_user(role=UserRole.resident, phone="+91 98765 43202")

    # Same 10-digit number as `other`, just written without the +91 prefix.
    response = client.patch(
        f"/api/v1/users/{resident.id}",
        json={"phone": "9876543202"},
        headers=auth_headers(resident),
    )

    assert response.status_code == 400


def test_update_user_not_found(client, auth_headers, manager_user):
    response = client.patch(
        "/api/v1/users/does-not-exist",
        json={"name": "Nobody"},
        headers=auth_headers(manager_user),
    )

    assert response.status_code == 404


def test_get_current_user_rejects_garbage_token(client):
    response = client.get(
        "/api/v1/users/me", headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert response.status_code == 401


def test_get_current_user_rejects_token_for_deleted_user(client, auth_headers, resident_user):
    from app.core.security import create_access_token

    token = create_access_token(subject="user-that-does-not-exist")
    response = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
