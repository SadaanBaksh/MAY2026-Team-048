from app.core.limiter import limiter


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


def test_register_resident_success(client):
    response = client.post("/api/v1/auth/register", json=_resident_payload())

    assert response.status_code == 201
    body = response.json()
    assert body["role"] == "resident"
    assert body["account_status"] == "active"
    assert body["apartment_id"] is not None


def test_register_resident_without_apartment_fails(client):
    payload = _resident_payload()
    del payload["building"]
    del payload["unit_number"]

    response = client.post("/api/v1/auth/register", json=payload)

    assert response.status_code == 422


def test_register_second_resident_reuses_existing_apartment(client):
    first = client.post("/api/v1/auth/register", json=_resident_payload())
    assert first.status_code == 201

    second_payload = _resident_payload(email="second-resident@example.com")
    second_payload["phone"] = "+91 98765 43199"
    # Same apartment, different casing/whitespace - must match the existing row
    # case-insensitively rather than creating a duplicate Apartment.
    second_payload["building"] = " wing a "
    second_payload["unit_number"] = " 101 "
    second = client.post("/api/v1/auth/register", json=second_payload)

    assert second.status_code == 201
    assert second.json()["apartment_id"] == first.json()["apartment_id"]


def test_register_facility_employee_defaults_to_pending(client):
    payload = {
        "name": "Employee One",
        "email": "employee@example.com",
        "phone": "+91 98765 43101",
        "role": "facility_employee",
        "password": "Testpass123",
        "title": "Facility Coordinator",
    }

    response = client.post("/api/v1/auth/register", json=payload)

    assert response.status_code == 201
    assert response.json()["account_status"] == "pending"


def test_register_maintenance_staff_defaults_to_pending(client):
    payload = {
        "name": "Staff One",
        "email": "staff@example.com",
        "phone": "+91 98765 43102",
        "role": "maintenance_staff",
        "password": "Testpass123",
        "specialization": "Plumbing",
    }

    response = client.post("/api/v1/auth/register", json=payload)

    assert response.status_code == 201
    assert response.json()["account_status"] == "pending"


def test_register_facility_manager_defaults_to_active(client):
    payload = {
        "name": "Manager One",
        "email": "manager@example.com",
        "phone": "+91 98765 43103",
        "role": "facility_manager",
        "password": "Testpass123",
    }

    response = client.post("/api/v1/auth/register", json=payload)

    assert response.status_code == 201
    assert response.json()["account_status"] == "active"


def test_register_rejects_overlong_password(client):
    payload = _resident_payload()
    payload["password"] = "a" * 73  # bcrypt's hard limit is 72 bytes

    response = client.post("/api/v1/auth/register", json=payload)

    assert response.status_code == 422


def test_register_accepts_password_at_max_length(client):
    payload = _resident_payload()
    payload["password"] = "a" * 72

    response = client.post("/api/v1/auth/register", json=payload)

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


def test_register_accepts_phone_with_country_code(client):
    payload = _resident_payload()
    payload["phone"] = "+91 98765 43210"

    response = client.post("/api/v1/auth/register", json=payload)

    assert response.status_code == 201


def test_register_accepts_phone_with_leading_zero(client):
    payload = _resident_payload()
    payload["phone"] = "09876543211"

    response = client.post("/api/v1/auth/register", json=payload)

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


def test_register_duplicate_email_fails(client):
    payload = _resident_payload()
    first = client.post("/api/v1/auth/register", json=payload)
    assert first.status_code == 201

    second = client.post("/api/v1/auth/register", json=payload)

    assert second.status_code == 400


def test_register_duplicate_phone_fails(client):
    first = client.post("/api/v1/auth/register", json=_resident_payload())
    assert first.status_code == 201

    second_payload = _resident_payload(email="second-resident@example.com")
    second = client.post("/api/v1/auth/register", json=second_payload)

    assert second.status_code == 400


def test_register_duplicate_phone_fails_across_equivalent_formats(client):
    first = client.post("/api/v1/auth/register", json=_resident_payload())
    assert first.status_code == 201

    # Same 10-digit number as the default "+91 98765 43100", just written without the prefix —
    # must still be caught, since a client bypassing the frontend (Postman/curl) could send it.
    second_payload = _resident_payload(email="second-resident@example.com")
    second_payload["phone"] = "9876543100"
    second = client.post("/api/v1/auth/register", json=second_payload)

    assert second.status_code == 400


def test_login_success(client):
    payload = _resident_payload()
    client.post("/api/v1/auth/register", json=payload)

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
