def test_list_apartments(client, make_apartment):
    make_apartment(building="Wing A", unit_number="101")
    make_apartment(building="Wing B", unit_number="202")

    response = client.get("/api/v1/apartments/")

    assert response.status_code == 200
    assert len(response.json()) == 2


def test_get_apartment_by_id(client, make_apartment):
    apartment = make_apartment(building="Wing A", unit_number="101")

    response = client.get(f"/api/v1/apartments/{apartment.id}")

    assert response.status_code == 200
    assert response.json()["unit_number"] == "101"


def test_get_apartment_not_found(client):
    response = client.get("/api/v1/apartments/does-not-exist")
    assert response.status_code == 404


def test_create_apartment_forbidden_for_resident(client, auth_headers, resident_user):
    response = client.post(
        "/api/v1/apartments/",
        json={"building": "Wing C", "unit_number": "303"},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 403


def test_create_apartment_requires_auth(client):
    response = client.post(
        "/api/v1/apartments/", json={"building": "Wing C", "unit_number": "303"}
    )

    assert response.status_code == 401


def test_create_apartment_allowed_for_employee(client, auth_headers, employee_user):
    response = client.post(
        "/api/v1/apartments/",
        json={"building": "Wing C", "unit_number": "303"},
        headers=auth_headers(employee_user),
    )

    assert response.status_code == 201
    assert response.json()["building"] == "Wing C"


def test_create_apartment_allowed_for_manager(client, auth_headers, manager_user):
    response = client.post(
        "/api/v1/apartments/",
        json={"building": "Wing D", "unit_number": "404"},
        headers=auth_headers(manager_user),
    )

    assert response.status_code == 201
