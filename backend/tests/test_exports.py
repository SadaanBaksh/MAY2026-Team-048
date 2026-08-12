import csv
import io

from app.models.enums import UserRole


def _rows(response) -> list[dict[str, str]]:
    return list(csv.DictReader(io.StringIO(response.content.decode("utf-8-sig"))))


def test_manager_can_export_employee_roster(
    client, manager_user, make_user, auth_headers
):
    employee = make_user(
        role=UserRole.facility_employee,
        name="Office, Coordinator",
        title="Front Desk",
    )
    worker = make_user(
        role=UserRole.maintenance_staff,
        name="Maintenance Worker",
        specialization="Electrical",
        active_jobs=3,
        rating=4.5,
    )

    response = client.get(
        "/api/v1/exports/employees.csv", headers=auth_headers(manager_user)
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment" in response.headers["content-disposition"]
    rows = _rows(response)
    assert {row["employee_id"] for row in rows} == {employee.id, worker.id}
    assert next(row for row in rows if row["employee_id"] == employee.id)["name"] == (
        "Office, Coordinator"
    )
    assert next(row for row in rows if row["employee_id"] == worker.id)["rating"] == "4.5"
    assert "hashed_password" not in rows[0]


def test_manager_can_export_resident_roster_and_neutralizes_formulas(
    client, manager_user, make_user, auth_headers
):
    resident = make_user(role=UserRole.resident, name="=IMPORTXML(B1)")

    response = client.get(
        "/api/v1/exports/residents.csv", headers=auth_headers(manager_user)
    )

    assert response.status_code == 200
    row = next(row for row in _rows(response) if row["resident_id"] == resident.id)
    assert row["name"] == "'=IMPORTXML(B1)"
    assert row["building"] == resident.apartment.building
    assert row["unit_number"] == resident.apartment.unit_number


def test_manager_can_export_public_service_details(
    client,
    manager_user,
    resident_user,
    maintenance_user,
    make_category,
    auth_headers,
    monkeypatch,
):
    category = make_category(id="cat_electrical", name="Electrical")
    monkeypatch.setattr("app.api.v1.endpoints.public_services._score_candidates", lambda *_: [])
    service = client.post(
        "/api/v1/public-services/",
        json={
            "title": "Lift, panel fault",
            "description": "The panel displays an error.\nIt will not reset.",
            "location": "Tower A lift",
            "category_id": category.id,
            "priority": "High",
        },
        headers=auth_headers(resident_user),
    ).json()
    client.patch(
        f"/api/v1/public-services/{service['id']}",
        json={"worker_id": maintenance_user.id},
        headers=auth_headers(make_user(role=UserRole.facility_employee)),
    )

    response = client.get(
        "/api/v1/exports/services.csv", headers=auth_headers(manager_user)
    )

    assert response.status_code == 200
    row = next(row for row in _rows(response) if row["service_id"] == service["id"])
    assert row["title"] == "Lift, panel fault"
    assert row["description"] == "The panel displays an error.\nIt will not reset."
    assert row["category"] == "Electrical"
    assert row["created_by_name"] == resident_user.name
    assert row["assigned_worker_name"] == maintenance_user.name
    assert row["report_count"] == "1"


def test_exports_are_manager_only(client, resident_user, employee_user, auth_headers):
    for user in (resident_user, employee_user):
        response = client.get(
            "/api/v1/exports/residents.csv", headers=auth_headers(user)
        )
        assert response.status_code == 403


def test_export_requires_authentication(client):
    assert client.get("/api/v1/exports/services.csv").status_code == 401


def test_unknown_export_dataset_is_rejected(client, manager_user, auth_headers):
    response = client.get(
        "/api/v1/exports/notices.csv", headers=auth_headers(manager_user)
    )
    assert response.status_code == 422
