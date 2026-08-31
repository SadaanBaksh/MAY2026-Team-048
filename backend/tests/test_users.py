import pytest

from app.models.enums import UserRole
from app.services.otp import generate_otp


@pytest.fixture(autouse=True)
def _mock_send_otp_email(monkeypatch):
    """Capture (to_email, otp, purpose) tuples instead of hitting SendGrid."""
    calls = []
    monkeypatch.setattr(
        "app.api.v1.endpoints.users.send_otp_email",
        lambda to_email, otp, purpose: calls.append((to_email, otp, purpose)),
    )
    return calls


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


def test_update_rejects_email_change_without_verification(
    client, auth_headers, resident_user
):
    response = client.patch(
        f"/api/v1/users/{resident_user.id}",
        json={"email": "brand-new@example.com"},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 400
    assert "verified" in response.json()["detail"].lower()


def test_update_accepts_unchanged_email(client, auth_headers, resident_user):
    response = client.patch(
        f"/api/v1/users/{resident_user.id}",
        json={"name": "Same Email", "email": resident_user.email},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Same Email"


def test_update_rejects_phone_change(client, auth_headers, make_user):
    resident = make_user(role=UserRole.resident, phone="+91 98765 43201")

    response = client.patch(
        f"/api/v1/users/{resident.id}",
        json={"phone": "+91 98765 43299"},
        headers=auth_headers(resident),
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Phone number cannot be changed."


def test_update_accepts_phone_in_equivalent_format(client, auth_headers, make_user):
    resident = make_user(role=UserRole.resident, phone="+91 98765 43201")

    # Same 10-digit number, just written without the +91 prefix — normalizes equal, so this
    # is a no-op and must not be rejected as a "change".
    response = client.patch(
        f"/api/v1/users/{resident.id}",
        json={"phone": "9876543201"},
        headers=auth_headers(resident),
    )

    assert response.status_code == 200


def test_email_change_send_otp_dispatches_code_to_new_address(
    client, auth_headers, resident_user, _mock_send_otp_email
):
    response = client.post(
        "/api/v1/users/me/email/send-otp",
        json={"new_email": "new-inbox@example.com"},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 200
    assert _mock_send_otp_email[-1][0] == "new-inbox@example.com"
    assert _mock_send_otp_email[-1][2] == "change_email"


def test_email_change_send_otp_rejects_current_email(client, auth_headers, resident_user):
    response = client.post(
        "/api/v1/users/me/email/send-otp",
        json={"new_email": resident_user.email},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 400


def test_email_change_send_otp_rejects_taken_email(
    client, auth_headers, resident_user, employee_user
):
    response = client.post(
        "/api/v1/users/me/email/send-otp",
        json={"new_email": employee_user.email},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 400


def test_email_change_send_otp_requires_auth(client):
    response = client.post(
        "/api/v1/users/me/email/send-otp",
        json={"new_email": "new-inbox@example.com"},
    )

    assert response.status_code == 401


def test_email_change_verify_updates_login_identity(client, auth_headers, resident_user):
    new_email = "verified-inbox@example.com"
    otp = generate_otp(new_email, "change_email")

    response = client.post(
        "/api/v1/users/me/email/verify",
        json={"new_email": new_email, "otp": otp},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 200
    assert response.json()["email"] == new_email

    me = client.get("/api/v1/users/me", headers=auth_headers(resident_user))
    assert me.json()["email"] == new_email


def test_email_change_verify_rejects_wrong_otp(client, auth_headers, resident_user):
    new_email = "wrong-otp@example.com"
    generate_otp(new_email, "change_email")

    response = client.post(
        "/api/v1/users/me/email/verify",
        json={"new_email": new_email, "otp": "0000"},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 400


def test_email_change_verify_rejects_email_taken_since_request(
    client, auth_headers, resident_user, employee_user
):
    otp = generate_otp(employee_user.email, "change_email")

    response = client.post(
        "/api/v1/users/me/email/verify",
        json={"new_email": employee_user.email, "otp": otp},
        headers=auth_headers(resident_user),
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


def test_manager_can_suspend_active_user(client, auth_headers, manager_user, resident_user):
    response = client.patch(
        f"/api/v1/users/{resident_user.id}",
        json={"account_status": "suspended"},
        headers=auth_headers(manager_user),
    )

    assert response.status_code == 200, response.text
    assert response.json()["account_status"] == "suspended"

    notifications = client.get(
        "/api/v1/notifications/me", headers=auth_headers(resident_user)
    ).json()
    assert any(n["title"] == "Account suspended" for n in notifications)


def test_manager_can_reactivate_suspended_user(client, auth_headers, manager_user, make_user):
    from app.models.enums import AccountStatus

    suspended = make_user(role=UserRole.resident, account_status=AccountStatus.suspended)

    response = client.patch(
        f"/api/v1/users/{suspended.id}",
        json={"account_status": "active"},
        headers=auth_headers(manager_user),
    )

    assert response.status_code == 200, response.text
    assert response.json()["account_status"] == "active"


def test_employee_cannot_suspend_user(client, auth_headers, employee_user, resident_user):
    response = client.patch(
        f"/api/v1/users/{resident_user.id}",
        json={"account_status": "suspended"},
        headers=auth_headers(employee_user),
    )

    assert response.status_code == 403


def test_manager_cannot_suspend_self(client, auth_headers, manager_user):
    response = client.patch(
        f"/api/v1/users/{manager_user.id}",
        json={"account_status": "suspended"},
        headers=auth_headers(manager_user),
    )

    assert response.status_code == 403


def test_manager_cannot_suspend_another_manager(client, auth_headers, manager_user, make_user):
    other_manager = make_user(role=UserRole.facility_manager)

    response = client.patch(
        f"/api/v1/users/{other_manager.id}",
        json={"account_status": "suspended"},
        headers=auth_headers(manager_user),
    )

    assert response.status_code == 403
