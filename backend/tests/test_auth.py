import pytest
from jose import jwt

from app.core.config import settings
from app.core.limiter import limiter


@pytest.fixture(autouse=True)
def _mock_send_otp_email(monkeypatch):
    """Every test in this file runs against a real backend/.env with live SendGrid
    credentials - patch the endpoint module's reference so no test can ever trigger
    a real outbound email send.
    """
    calls = []
    monkeypatch.setattr(
        "app.api.v1.endpoints.auth.send_otp_email",
        lambda email, otp, purpose: calls.append((email, otp, purpose)),
    )
    return calls


def _resident_payload(email: str = "resident@example.com") -> dict:
    return {
        "name": "Resident One",
        "email": email,
        "phone": "+91 98765 43100",
        "role": "resident",
        "password": "Testpass123",
        "building": "Wing A",
        "unit_number": "101",
    }


def test_register_resident_success(register_user):
    response = register_user(_resident_payload())

    assert response.status_code == 201
    body = response.json()
    assert body["role"] == "resident"
    assert body["account_status"] == "active"
    assert body["apartment_id"] is not None


def test_register_resident_without_apartment_fails(register_user):
    payload = _resident_payload()
    del payload["building"]
    del payload["unit_number"]

    response = register_user(payload)

    assert response.status_code == 422


def test_register_second_resident_reuses_existing_apartment(register_user):
    first = register_user(_resident_payload())
    assert first.status_code == 201

    second_payload = _resident_payload(email="second-resident@example.com")
    second_payload["phone"] = "+91 98765 43199"
    # Same apartment, different casing/whitespace - must match the existing row
    # case-insensitively rather than creating a duplicate Apartment.
    second_payload["building"] = " wing a "
    second_payload["unit_number"] = " 101 "
    second = register_user(second_payload)

    assert second.status_code == 201
    assert second.json()["apartment_id"] == first.json()["apartment_id"]


def test_register_facility_employee_defaults_to_pending(register_user):
    payload = {
        "name": "Employee One",
        "email": "employee@example.com",
        "phone": "+91 98765 43101",
        "role": "facility_employee",
        "password": "Testpass123",
        "title": "Facility Coordinator",
    }

    response = register_user(payload)

    assert response.status_code == 201
    assert response.json()["account_status"] == "pending"


def test_register_maintenance_staff_defaults_to_pending(register_user):
    payload = {
        "name": "Staff One",
        "email": "staff@example.com",
        "phone": "+91 98765 43102",
        "role": "maintenance_staff",
        "password": "Testpass123",
        "specialization": "Plumbing",
    }

    response = register_user(payload)

    assert response.status_code == 201
    assert response.json()["account_status"] == "pending"


def test_register_facility_manager_defaults_to_active(register_user):
    payload = {
        "name": "Manager One",
        "email": "manager@example.com",
        "phone": "+91 98765 43103",
        "role": "facility_manager",
        "password": "Testpass123",
    }

    response = register_user(payload)

    assert response.status_code == 201
    assert response.json()["account_status"] == "active"


def test_register_rejects_overlong_password(client):
    payload = _resident_payload()
    payload["password"] = "a" * 73  # bcrypt's hard limit is 72 bytes

    response = client.post("/api/v1/auth/register", json=payload)

    assert response.status_code == 422


def test_register_accepts_password_at_max_length(register_user):
    payload = _resident_payload()
    payload["password"] = "a" * 72

    response = register_user(payload)

    assert response.status_code == 201


def test_register_rejects_overlong_name(client):
    payload = _resident_payload()
    payload["name"] = "N" * 151

    response = client.post("/api/v1/auth/register", json=payload)

    assert response.status_code == 422


def test_register_rejects_phone_with_too_many_digits(client):
    payload = _resident_payload()
    payload["phone"] = "+91 98765 4321098765"  # way more than 10 digits

    response = client.post("/api/v1/auth/register", json=payload)

    assert response.status_code == 422


def test_register_rejects_phone_with_too_few_digits(client):
    payload = _resident_payload()
    payload["phone"] = "12345"

    response = client.post("/api/v1/auth/register", json=payload)

    assert response.status_code == 422


def test_register_accepts_phone_with_country_code(register_user):
    payload = _resident_payload()
    payload["phone"] = "+91 98765 43210"

    response = register_user(payload)

    assert response.status_code == 201


def test_register_accepts_phone_with_leading_zero(register_user):
    payload = _resident_payload()
    payload["phone"] = "09876543211"

    response = register_user(payload)

    assert response.status_code == 201


def test_register_rejects_phone_starting_below_six(client):
    payload = _resident_payload()
    payload["phone"] = "5876543210"

    response = client.post("/api/v1/auth/register", json=payload)

    assert response.status_code == 422


def test_register_rejects_phone_with_double_prefix(client):
    payload = _resident_payload()
    payload["phone"] = "0919876543210"  # both leading 0 and 91 - not a valid combination

    response = client.post("/api/v1/auth/register", json=payload)

    assert response.status_code == 422


def test_register_rejects_overlong_email(client):
    payload = _resident_payload()
    payload["email"] = f"{'a' * 250}@example.com"  # well over 254 chars total

    response = client.post("/api/v1/auth/register", json=payload)

    assert response.status_code == 422


def test_register_duplicate_email_fails(client, register_user):
    payload = _resident_payload()
    first = register_user(payload)
    assert first.status_code == 201

    # Deliberately raw client.post, not register_user: the duplicate-email check
    # runs before the OTP-verified check, so this must 400 regardless of OTP state.
    second = client.post("/api/v1/auth/register", json=payload)

    assert second.status_code == 400


def test_register_duplicate_phone_fails(client, register_user):
    first = register_user(_resident_payload())
    assert first.status_code == 201

    second_payload = _resident_payload(email="second-resident@example.com")
    second = client.post("/api/v1/auth/register", json=second_payload)

    assert second.status_code == 400


def test_register_duplicate_phone_fails_across_equivalent_formats(client, register_user):
    first = register_user(_resident_payload())
    assert first.status_code == 201

    # Same 10-digit number as the default "+91 98765 43100", just written without the prefix —
    # must still be caught, since a client bypassing the frontend (Postman/curl) could send it.
    second_payload = _resident_payload(email="second-resident@example.com")
    second_payload["phone"] = "9876543100"
    second = client.post("/api/v1/auth/register", json=second_payload)

    assert second.status_code == 400


def test_login_success(client, register_user):
    payload = _resident_payload()
    register_user(payload)

    response = client.post(
        "/api/v1/auth/login",
        data={"username": payload["email"], "password": payload["password"]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]

    me = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {body['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["email"] == payload["email"]


def test_login_wrong_password_fails(client):
    payload = _resident_payload()
    client.post("/api/v1/auth/register", json=payload)

    response = client.post(
        "/api/v1/auth/login",
        data={"username": payload["email"], "password": "WrongPassword1"},
    )

    assert response.status_code == 401


def test_login_unknown_email_fails(client):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "nobody@example.com", "password": "Testpass123"},
    )

    assert response.status_code == 401


def test_register_is_rate_limited(client):
    limiter.enabled = True
    try:
        for i in range(5):
            client.post(
                "/api/v1/auth/register",
                json=_resident_payload(email=f"rate-{i}@example.com"),
            )
        response = client.post(
            "/api/v1/auth/register",
            json=_resident_payload(email="rate-overflow@example.com"),
        )
        assert response.status_code == 429
    finally:
        limiter.enabled = False


def test_login_is_rate_limited(client):
    limiter.enabled = True
    try:
        for _ in range(10):
            client.post(
                "/api/v1/auth/login",
                data={"username": "nobody@example.com", "password": "wrong"},
            )
        response = client.post(
            "/api/v1/auth/login",
            data={"username": "nobody@example.com", "password": "wrong"},
        )
        assert response.status_code == 429
    finally:
        limiter.enabled = False


# --- send-otp ------------------------------------------------------------------


def test_send_otp_register_rejects_existing_email(client, register_user):
    register_user(_resident_payload(email="taken@example.com"))

    response = client.post(
        "/api/v1/auth/send-otp",
        json={"email": "taken@example.com", "purpose": "register"},
    )

    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


def test_send_otp_register_succeeds_for_new_email(client, _mock_send_otp_email):
    response = client.post(
        "/api/v1/auth/send-otp",
        json={"email": "brand-new@example.com", "purpose": "register"},
    )

    assert response.status_code == 200
    assert response.json() == {"message": "OTP sent successfully"}
    assert _mock_send_otp_email[0][0] == "brand-new@example.com"
    assert _mock_send_otp_email[0][2] == "register"


def test_send_otp_forgot_password_rejects_unknown_email(client):
    response = client.post(
        "/api/v1/auth/send-otp",
        json={"email": "nobody-here@example.com", "purpose": "forgot_password"},
    )

    assert response.status_code == 404
    assert "No account found" in response.json()["detail"]


def test_send_otp_forgot_password_succeeds_for_known_email(client, register_user):
    register_user(_resident_payload(email="knownuser@example.com"))

    response = client.post(
        "/api/v1/auth/send-otp",
        json={"email": "knownuser@example.com", "purpose": "forgot_password"},
    )

    assert response.status_code == 200


# --- verify-otp ------------------------------------------------------------------


def test_verify_otp_rejects_invalid_code(client):
    response = client.post(
        "/api/v1/auth/verify-otp",
        json={"email": "never-requested@example.com", "otp": "0000", "purpose": "register"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid or expired OTP"


def test_verify_otp_register_returns_verified_without_reset_token(client):
    client.post(
        "/api/v1/auth/send-otp",
        json={"email": "verify-register@example.com", "purpose": "register"},
    )
    from app.services.otp import _otp_store

    otp = _otp_store[("verify-register@example.com", "register")][0]

    response = client.post(
        "/api/v1/auth/verify-otp",
        json={"email": "verify-register@example.com", "otp": otp, "purpose": "register"},
    )

    assert response.status_code == 200
    assert response.json() == {"verified": True}


def test_verify_otp_forgot_password_returns_reset_token(client, register_user):
    register_user(_resident_payload(email="verify-forgot@example.com"))
    client.post(
        "/api/v1/auth/send-otp",
        json={"email": "verify-forgot@example.com", "purpose": "forgot_password"},
    )
    from app.services.otp import _otp_store

    otp = _otp_store[("verify-forgot@example.com", "forgot_password")][0]

    response = client.post(
        "/api/v1/auth/verify-otp",
        json={"email": "verify-forgot@example.com", "otp": otp, "purpose": "forgot_password"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["verified"] is True
    assert body["reset_token"]


# --- reset-password --------------------------------------------------------------


def test_reset_password_rejects_garbage_token(client):
    response = client.post(
        "/api/v1/auth/reset-password",
        json={"reset_token": "not-a-real-token", "new_password": "NewPassword123"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid or expired reset token"


def test_reset_password_rejects_token_with_wrong_purpose(client):
    # A well-formed, correctly-signed JWT, but not one /verify-otp would ever issue -
    # exercises the "purpose != reset_password" branch distinctly from a garbage token.
    bad_purpose_token = jwt.encode(
        {"sub": "someone@example.com", "purpose": "not_reset_password"},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )

    response = client.post(
        "/api/v1/auth/reset-password",
        json={"reset_token": bad_purpose_token, "new_password": "NewPassword123"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid or expired reset token"


def test_reset_password_rejects_token_for_unknown_user(client):
    token = jwt.encode(
        {"sub": "ghost@example.com", "purpose": "reset_password"},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )

    response = client.post(
        "/api/v1/auth/reset-password",
        json={"reset_token": token, "new_password": "NewPassword123"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "User not found"


def test_reset_password_rejects_overlong_new_password(client):
    token = jwt.encode(
        {"sub": "someone@example.com", "purpose": "reset_password"},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )

    response = client.post(
        "/api/v1/auth/reset-password",
        json={"reset_token": token, "new_password": "a" * 73},
    )

    assert response.status_code == 422


def test_reset_password_succeeds_end_to_end(client, register_user):
    email = "full-reset-flow@example.com"
    register_user(_resident_payload(email=email))

    client.post("/api/v1/auth/send-otp", json={"email": email, "purpose": "forgot_password"})
    from app.services.otp import _otp_store

    otp = _otp_store[(email, "forgot_password")][0]
    verify_response = client.post(
        "/api/v1/auth/verify-otp",
        json={"email": email, "otp": otp, "purpose": "forgot_password"},
    )
    reset_token = verify_response.json()["reset_token"]

    reset_response = client.post(
        "/api/v1/auth/reset-password",
        json={"reset_token": reset_token, "new_password": "BrandNewPassword123"},
    )
    assert reset_response.status_code == 200
    assert reset_response.json() == {"message": "Password reset successfully"}

    login_response = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": "BrandNewPassword123"},
    )
    assert login_response.status_code == 200


# --- change-password ---------------------------------------------------------------


def test_change_password_send_otp_requires_auth(client):
    response = client.post("/api/v1/auth/change-password/send-otp")

    assert response.status_code == 401


def test_change_password_send_otp_succeeds(client, resident_user, auth_headers, _mock_send_otp_email):
    response = client.post(
        "/api/v1/auth/change-password/send-otp",
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 200
    assert response.json() == {"message": "OTP sent successfully"}
    assert _mock_send_otp_email[0][0] == resident_user.email
    assert _mock_send_otp_email[0][2] == "change_password"


def test_change_password_verify_rejects_invalid_otp(client, resident_user, auth_headers):
    response = client.post(
        "/api/v1/auth/change-password/verify-and-change",
        headers=auth_headers(resident_user),
        json={"otp": "0000", "current_password": "Testpass123", "new_password": "NewPassword123"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid or expired OTP"


def test_change_password_verify_rejects_wrong_current_password(client, resident_user, auth_headers):
    client.post(
        "/api/v1/auth/change-password/send-otp",
        headers=auth_headers(resident_user),
    )
    from app.services.otp import _otp_store

    otp = _otp_store[(resident_user.email, "change_password")][0]

    response = client.post(
        "/api/v1/auth/change-password/verify-and-change",
        headers=auth_headers(resident_user),
        json={"otp": otp, "current_password": "WrongPassword1", "new_password": "NewPassword123"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Incorrect current password"


def test_change_password_verify_succeeds_end_to_end(client, resident_user, auth_headers):
    headers = auth_headers(resident_user)
    client.post("/api/v1/auth/change-password/send-otp", headers=headers)
    from app.services.otp import _otp_store

    otp = _otp_store[(resident_user.email, "change_password")][0]

    response = client.post(
        "/api/v1/auth/change-password/verify-and-change",
        headers=headers,
        json={"otp": otp, "current_password": "Testpass123", "new_password": "NewPassword123"},
    )

    assert response.status_code == 200
    assert response.json() == {"message": "Password changed successfully"}

    login_response = client.post(
        "/api/v1/auth/login",
        data={"username": resident_user.email, "password": "NewPassword123"},
    )
    assert login_response.status_code == 200
