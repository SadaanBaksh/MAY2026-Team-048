from app.models.enums import PublicServiceStatus, UserRole
from app.models.public_service import PublicService
from app.models.public_similarity import PublicSimilaritySuggestion


def public_payload(title="Street light is flickering", location="Below Tower A"):
    return {
        "title": title,
        "description": "The street light keeps switching off after a few seconds.",
        "location": location,
        "category_id": "cat_electrical",
        "priority": "Medium",
    }


def test_residents_can_create_view_and_comment_on_public_services(
    client, db_session, resident_user, make_user, make_category, auth_headers, monkeypatch
):
    make_category(id="cat_electrical", name="Electrical")
    other_resident = make_user(role=UserRole.resident, name="Neighbour")
    monkeypatch.setattr("app.api.v1.endpoints.public_services._score_candidates", lambda *_: [])

    created = client.post(
        "/api/v1/public-services/",
        json=public_payload(),
        headers=auth_headers(resident_user),
    )
    assert created.status_code == 201
    body = created.json()
    assert body["creator_name"] == resident_user.name
    assert body["creator_building"] == resident_user.apartment.building
    assert len(body["reports"]) == 1
    assert "phone" not in body["reports"][0]
    assert "unit_number" not in body["reports"][0]

    listing = client.get(
        "/api/v1/public-services/", headers=auth_headers(other_resident)
    )
    assert listing.status_code == 200
    assert [item["id"] for item in listing.json()] == [body["id"]]

    comment = client.post(
        f'/api/v1/public-services/{body["id"]}/comments',
        json={"message": "This is affecting our walkway too."},
        headers=auth_headers(other_resident),
    )
    assert comment.status_code == 201
    assert comment.json()["author_name"] == "Neighbour"


def test_only_contributing_resident_can_resolve(
    client, resident_user, make_user, make_category, auth_headers, monkeypatch
):
    make_category(id="cat_electrical", name="Electrical")
    other_resident = make_user(role=UserRole.resident)
    monkeypatch.setattr("app.api.v1.endpoints.public_services._score_candidates", lambda *_: [])
    service = client.post(
        "/api/v1/public-services/",
        json=public_payload(),
        headers=auth_headers(resident_user),
    ).json()

    forbidden = client.patch(
        f'/api/v1/public-services/{service["id"]}',
        json={"status": "Resolved"},
        headers=auth_headers(other_resident),
    )
    assert forbidden.status_code == 403

    resolved = client.patch(
        f'/api/v1/public-services/{service["id"]}',
        json={"status": "Resolved", "resolution_remarks": "The light is working now."},
        headers=auth_headers(resident_user),
    )
    assert resolved.status_code == 200
    assert resolved.json()["status"] == "Resolved"

    locked_comment = client.post(
        f'/api/v1/public-services/{service["id"]}/comments',
        json={"message": "A late comment"},
        headers=auth_headers(resident_user),
    )
    assert locked_comment.status_code == 409


def test_employee_assignment_and_maintenance_lifecycle(
    client,
    resident_user,
    employee_user,
    maintenance_user,
    manager_user,
    make_category,
    auth_headers,
    monkeypatch,
):
    make_category(id="cat_electrical", name="Electrical")
    monkeypatch.setattr("app.api.v1.endpoints.public_services._score_candidates", lambda *_: [])
    service = client.post(
        "/api/v1/public-services/",
        json=public_payload(),
        headers=auth_headers(resident_user),
    ).json()

    assigned = client.patch(
        f'/api/v1/public-services/{service["id"]}',
        json={"worker_id": maintenance_user.id},
        headers=auth_headers(employee_user),
    )
    assert assigned.status_code == 200
    assert assigned.json()["status"] == "Assigned"

    started = client.patch(
        f'/api/v1/public-services/{service["id"]}',
        json={"status": "In_Progress"},
        headers=auth_headers(maintenance_user),
    )
    assert started.status_code == 200

    manager_update = client.patch(
        f'/api/v1/public-services/{service["id"]}',
        json={"status": "Resolved"},
        headers=auth_headers(manager_user),
    )
    assert manager_update.status_code == 403

    resolved = client.patch(
        f'/api/v1/public-services/{service["id"]}',
        json={"status": "Resolved", "resolution_remarks": "Replaced the fitting."},
        headers=auth_headers(maintenance_user),
    )
    assert resolved.status_code == 200
    assert resolved.json()["status"] == "Resolved"


def test_high_similarity_creates_employee_review_and_accepting_creates_new_page(
    client,
    db_session,
    resident_user,
    employee_user,
    make_user,
    make_category,
    auth_headers,
    monkeypatch,
):
    make_category(id="cat_electrical", name="Electrical")
    second_resident = make_user(role=UserRole.resident, name="Second Resident")

    def fake_scores(service, candidates):
        return [
            {
                "service_id": candidate.id,
                "score": 0.93,
                "rationale": "Both concern the same street light below Tower A.",
            }
            for candidate in candidates
        ]

    monkeypatch.setattr("app.api.v1.endpoints.public_services._score_candidates", fake_scores)
    first = client.post(
        "/api/v1/public-services/",
        json=public_payload(),
        headers=auth_headers(resident_user),
    ).json()
    second = client.post(
        "/api/v1/public-services/",
        json=public_payload(
            title="Tower A street lamp switches off",
            location="Street light below Tower A",
        ),
        headers=auth_headers(second_resident),
    ).json()

    suggestions = client.get(
        "/api/v1/public-services/similarity/suggestions",
        headers=auth_headers(employee_user),
    )
    assert suggestions.status_code == 200
    assert len(suggestions.json()) == 1
    suggestion = suggestions.json()[0]
    assert suggestion["score"] == 0.93

    accepted = client.post(
        f'/api/v1/public-services/similarity/suggestions/{suggestion["id"]}/review',
        json={"accept": True},
        headers=auth_headers(employee_user),
    )
    assert accepted.status_code == 200
    merged_id = accepted.json()["merged_service_id"]
    assert merged_id not in {first["id"], second["id"]}

    merged = client.get(
        f"/api/v1/public-services/{merged_id}", headers=auth_headers(resident_user)
    )
    assert merged.status_code == 200
    assert len(merged.json()["reports"]) == 2
    assert {report["author_id"] for report in merged.json()["reports"]} == {
        resident_user.id,
        second_resident.id,
    }

    db_session.expire_all()
    assert db_session.get(PublicService, first["id"]).status == PublicServiceStatus.Merged
    assert db_session.get(PublicService, first["id"]).merged_into_id == merged_id


def test_employee_can_decline_similarity_suggestion(
    client,
    db_session,
    resident_user,
    employee_user,
    make_user,
    make_category,
    auth_headers,
    monkeypatch,
):
    make_category(id="cat_electrical", name="Electrical")
    second_resident = make_user(role=UserRole.resident)
    monkeypatch.setattr(
        "app.api.v1.endpoints.public_services._score_candidates",
        lambda service, candidates: [
            {"service_id": item.id, "score": 0.85, "rationale": "Potential match"}
            for item in candidates
        ],
    )
    client.post(
        "/api/v1/public-services/",
        json=public_payload(),
        headers=auth_headers(resident_user),
    )
    client.post(
        "/api/v1/public-services/",
        json=public_payload(title="Another report"),
        headers=auth_headers(second_resident),
    )
    suggestion = db_session.query(PublicSimilaritySuggestion).one()
    response = client.post(
        f"/api/v1/public-services/similarity/suggestions/{suggestion.id}/review",
        json={"accept": False},
        headers=auth_headers(employee_user),
    )
    assert response.status_code == 200
    assert response.json()["status"] == "Declined"
