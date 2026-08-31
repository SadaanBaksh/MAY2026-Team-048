import pytest

from app.models.enums import AccountStatus, UserRole


@pytest.fixture()
def admin_user(make_user):
    return make_user(role=UserRole.admin, email="admin@simplifix.app")


def _login(client, email: str, password: str):
    return client.post(
        "/api/v1/auth/login", data={"username": email, "password": password}
    )


def test_list_managers_returns_only_managers(
    client, auth_headers, admin_user, manager_user, resident_user
):
    response = client.get("/api/v1/admin/managers", headers=auth_headers(admin_user))

    assert response.status_code == 200, response.text
    rows = response.json()
    assert {r["role"] for r in rows} == {"facility_manager"}
    assert manager_user.id in {r["id"] for r in rows}
    assert resident_user.id not in {r["id"] for r in rows}


def test_list_managers_requires_auth(client):
    assert client.get("/api/v1/admin/managers").status_code == 401


def test_list_managers_forbidden_for_manager(client, auth_headers, manager_user):
    response = client.get("/api/v1/admin/managers", headers=auth_headers(manager_user))
    assert response.status_code == 403


def test_list_managers_forbidden_for_employee(client, auth_headers, employee_user):
    response = client.get("/api/v1/admin/managers", headers=auth_headers(employee_user))
    assert response.status_code == 403


def test_create_manager_succeeds_and_can_log_in(client, auth_headers, admin_user):
    response = client.post(
        "/api/v1/admin/managers",
        json={
            "name": "Meera Joshi",
            "email": "meera.joshi@simplifix.app",
            "phone": "+91 98765 43210",
            "password": "Manager@123",
            "title": "Facility Manager",
        },
        headers=auth_headers(admin_user),
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["role"] == "facility_manager"
    assert body["account_status"] == "active"
    assert body["title"] == "Facility Manager"

    login = _login(client, "meera.joshi@simplifix.app", "Manager@123")
    assert login.status_code == 200
    assert login.json()["access_token"]


def test_create_manager_rejects_duplicate_email(
    client, auth_headers, admin_user, manager_user
):
    response = client.post(
        "/api/v1/admin/managers",
        json={
            "name": "Clash",
            "email": manager_user.email,
            "phone": "+91 98765 00011",
            "password": "Manager@123",
        },
        headers=auth_headers(admin_user),
    )

    assert response.status_code == 400
    assert "email" in response.json()["detail"].lower()


def test_create_manager_rejects_duplicate_phone(
    client, auth_headers, admin_user, manager_user
):
    response = client.post(
        "/api/v1/admin/managers",
        json={
            "name": "Clash",
            "email": "unique-addr@simplifix.app",
            "phone": manager_user.phone,
            "password": "Manager@123",
        },
        headers=auth_headers(admin_user),
    )

    assert response.status_code == 400
    assert "phone" in response.json()["detail"].lower()


def test_create_manager_forbidden_for_non_admin(client, auth_headers, manager_user):
    response = client.post(
        "/api/v1/admin/managers",
        json={
            "name": "X",
            "email": "x@simplifix.app",
            "phone": "+91 98765 43277",
            "password": "Manager@123",
        },
        headers=auth_headers(manager_user),
    )

    assert response.status_code == 403


def test_update_manager_changes_profile_fields(
    client, auth_headers, admin_user, manager_user
):
    response = client.patch(
        f"/api/v1/admin/managers/{manager_user.id}",
        json={"name": "Renamed", "title": "Senior Manager", "email": "renamed@simplifix.app"},
        headers=auth_headers(admin_user),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["name"] == "Renamed"
    assert body["title"] == "Senior Manager"
    assert body["email"] == "renamed@simplifix.app"


def test_update_manager_password_changes_login(
    client, auth_headers, admin_user, make_user
):
    manager = make_user(role=UserRole.facility_manager, email="pw@simplifix.app")

    response = client.patch(
        f"/api/v1/admin/managers/{manager.id}",
        json={"password": "BrandNew@999"},
        headers=auth_headers(admin_user),
    )
    assert response.status_code == 200, response.text

    assert _login(client, "pw@simplifix.app", "Testpass123").status_code == 401
    assert _login(client, "pw@simplifix.app", "BrandNew@999").status_code == 200


def test_update_manager_suspend_then_reactivate(
    client, auth_headers, admin_user, manager_user
):
    suspended = client.patch(
        f"/api/v1/admin/managers/{manager_user.id}",
        json={"account_status": "suspended"},
        headers=auth_headers(admin_user),
    )
    assert suspended.status_code == 200, suspended.text
    assert suspended.json()["account_status"] == "suspended"

    reactivated = client.patch(
        f"/api/v1/admin/managers/{manager_user.id}",
        json={"account_status": "active"},
        headers=auth_headers(admin_user),
    )
    assert reactivated.status_code == 200
    assert reactivated.json()["account_status"] == "active"


def test_update_manager_rejects_non_suspend_status(
    client, auth_headers, admin_user, manager_user
):
    response = client.patch(
        f"/api/v1/admin/managers/{manager_user.id}",
        json={"account_status": "rejected"},
        headers=auth_headers(admin_user),
    )

    assert response.status_code == 400


def test_update_manager_404_for_unknown_id(client, auth_headers, admin_user):
    response = client.patch(
        "/api/v1/admin/managers/does-not-exist",
        json={"name": "Nobody"},
        headers=auth_headers(admin_user),
    )
    assert response.status_code == 404


def test_update_manager_404_when_target_is_not_a_manager(
    client, auth_headers, admin_user, resident_user
):
    response = client.patch(
        f"/api/v1/admin/managers/{resident_user.id}",
        json={"name": "Nope"},
        headers=auth_headers(admin_user),
    )
    assert response.status_code == 404


def test_update_manager_forbidden_for_non_admin(client, auth_headers, employee_user, manager_user):
    response = client.patch(
        f"/api/v1/admin/managers/{manager_user.id}",
        json={"name": "Hacked"},
        headers=auth_headers(employee_user),
    )
    assert response.status_code == 403
