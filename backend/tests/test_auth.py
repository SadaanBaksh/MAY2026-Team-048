from app.core.limiter import limiter


def _resident_payload(email: str = "resident@example.com") -> dict:
    return {
        "name": "Resident One",
        "email": email,
        "phone": "+1 555-010-0100",
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


def test_register_facility_employee_defaults_to_pending(client):
    payload = {
        "name": "Employee One",
        "email": "employee@example.com",
        "phone": "+1 555-010-0101",
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
        "phone": "+1 555-010-0102",
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
        "phone": "+1 555-010-0103",
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
