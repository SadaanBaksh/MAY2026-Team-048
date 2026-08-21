from types import SimpleNamespace

from app.api.v1.endpoints.public_services import _create_similarity_suggestions, _score_candidates
from app.core.gemini import GeminiError
from app.models.enums import Priority, PublicServiceStatus, SimilaritySuggestionStatus, UserRole
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


def test_create_public_service_rejects_blank_title(
    client, resident_user, make_category, auth_headers
):
    make_category(id="cat_electrical", name="Electrical")

    response = client.post(
        "/api/v1/public-services/",
        json=public_payload(title="   "),
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 422


def test_comment_rejects_blank_message(
    client, resident_user, make_category, auth_headers, monkeypatch
):
    make_category(id="cat_electrical", name="Electrical")
    monkeypatch.setattr("app.api.v1.endpoints.public_services._score_candidates", lambda *_: [])
    created = client.post(
        "/api/v1/public-services/",
        json=public_payload(),
        headers=auth_headers(resident_user),
    )

    response = client.post(
        f'/api/v1/public-services/{created.json()["id"]}/comments',
        json={"message": "   "},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 422


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


def _pair(client, auth_headers, resident_user, second_resident, monkeypatch, **kwargs):
    """Creates two public services that always score as a match against each other."""
    monkeypatch.setattr(
        "app.api.v1.endpoints.public_services._score_candidates",
        lambda service, candidates: [
            {"service_id": c.id, "score": 0.9, "rationale": "match"} for c in candidates
        ],
    )
    first = client.post(
        "/api/v1/public-services/", json=public_payload(**kwargs), headers=auth_headers(resident_user)
    ).json()
    second = client.post(
        "/api/v1/public-services/",
        json=public_payload(title="Second report"),
        headers=auth_headers(second_resident),
    ).json()
    return first, second


# --- _ensure_service_access -----------------------------------------------------


def test_maintenance_staff_cannot_view_unassigned_public_service(
    client, resident_user, maintenance_user, make_category, auth_headers, monkeypatch
):
    make_category(id="cat_electrical", name="Electrical")
    monkeypatch.setattr("app.api.v1.endpoints.public_services._score_candidates", lambda *_: [])
    service = client.post(
        "/api/v1/public-services/", json=public_payload(), headers=auth_headers(resident_user)
    ).json()

    response = client.get(
        f'/api/v1/public-services/{service["id"]}', headers=auth_headers(maintenance_user)
    )
    assert response.status_code == 403


# --- _score_candidates (direct unit coverage) ------------------------------------


def test_score_candidates_returns_empty_for_no_candidates():
    service = SimpleNamespace(title="T", location="L", description="D")
    assert _score_candidates(service, []) == []


def test_score_candidates_filters_unknown_ids_and_clamps_out_of_range_scores(monkeypatch):
    service = SimpleNamespace(title="New", location="Loc", description="Desc")
    candidate = SimpleNamespace(id="cand-1", title="Old", location="Loc", description="Desc")

    def fake_generate_json(**kwargs):
        return {
            "matches": [
                {"service_id": "cand-1", "score": 1.5, "rationale": "Same issue"},
                {"service_id": "unknown-id", "score": 0.9, "rationale": "Not a real candidate"},
                {"service_id": "cand-1", "score": "not-a-number", "rationale": "bad score type"},
            ]
        }

    monkeypatch.setattr(
        "app.api.v1.endpoints.public_services.generate_json", fake_generate_json
    )

    matches = _score_candidates(service, [candidate])

    assert len(matches) == 1
    assert matches[0]["service_id"] == "cand-1"
    assert matches[0]["score"] == 1.0  # clamped from 1.5


# --- _create_similarity_suggestions ----------------------------------------------


def test_create_public_service_survives_similarity_scoring_gemini_error(
    client, db_session, resident_user, make_user, make_category, auth_headers, monkeypatch
):
    make_category(id="cat_electrical", name="Electrical")
    # No mocking needed for this first create: with no other services yet, candidates
    # is empty and _score_candidates short-circuits before ever calling generate_json.
    client.post(
        "/api/v1/public-services/", json=public_payload(), headers=auth_headers(resident_user)
    )

    second_resident = make_user(role=UserRole.resident)

    def _raise(**kwargs):
        raise GeminiError("AI is temporarily busy.")

    monkeypatch.setattr("app.api.v1.endpoints.public_services.generate_json", _raise)

    response = client.post(
        "/api/v1/public-services/",
        json=public_payload(title="Another one"),
        headers=auth_headers(second_resident),
    )

    assert response.status_code == 201, response.text
    assert db_session.query(PublicSimilaritySuggestion).count() == 0


def test_similarity_suggestion_not_created_for_low_score_match(
    client, db_session, resident_user, make_user, make_category, auth_headers, monkeypatch
):
    make_category(id="cat_electrical", name="Electrical")
    monkeypatch.setattr("app.api.v1.endpoints.public_services._score_candidates", lambda *_: [])
    client.post(
        "/api/v1/public-services/", json=public_payload(), headers=auth_headers(resident_user)
    )

    second_resident = make_user(role=UserRole.resident)
    monkeypatch.setattr(
        "app.api.v1.endpoints.public_services._score_candidates",
        lambda service, candidates: [
            {"service_id": c.id, "score": 0.1, "rationale": "weak match"} for c in candidates
        ],
    )
    client.post(
        "/api/v1/public-services/",
        json=public_payload(title="Another one"),
        headers=auth_headers(second_resident),
    )

    assert db_session.query(PublicSimilaritySuggestion).count() == 0


def test_create_similarity_suggestions_skips_duplicate_pair(
    db_session, resident_user, make_category, monkeypatch
):
    make_category(id="cat_electrical", name="Electrical")
    candidate = PublicService(
        created_by_id=resident_user.id,
        category_id="cat_electrical",
        title="Candidate",
        description="Desc",
        location="Loc",
        priority=Priority.Medium,
    )
    service = PublicService(
        created_by_id=resident_user.id,
        category_id="cat_electrical",
        title="New",
        description="Desc",
        location="Loc",
        priority=Priority.Medium,
    )
    db_session.add_all([candidate, service])
    db_session.commit()

    monkeypatch.setattr(
        "app.api.v1.endpoints.public_services._score_candidates",
        lambda svc, candidates: [
            {"service_id": c.id, "score": 0.9, "rationale": "match"} for c in candidates
        ],
    )

    _create_similarity_suggestions(db_session, service)
    _create_similarity_suggestions(db_session, service)

    assert db_session.query(PublicSimilaritySuggestion).count() == 1


# --- list_public_services ---------------------------------------------------------


def test_list_public_services_maintenance_staff_sees_only_assigned(
    client, resident_user, maintenance_user, employee_user, make_category, auth_headers, monkeypatch
):
    make_category(id="cat_electrical", name="Electrical")
    monkeypatch.setattr("app.api.v1.endpoints.public_services._score_candidates", lambda *_: [])
    service = client.post(
        "/api/v1/public-services/", json=public_payload(), headers=auth_headers(resident_user)
    ).json()
    client.post(
        "/api/v1/public-services/",
        json=public_payload(title="Unassigned one"),
        headers=auth_headers(resident_user),
    )
    client.patch(
        f'/api/v1/public-services/{service["id"]}',
        json={"worker_id": maintenance_user.id},
        headers=auth_headers(employee_user),
    )

    response = client.get("/api/v1/public-services/", headers=auth_headers(maintenance_user))

    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [service["id"]]


def test_list_public_services_status_filter(
    client, resident_user, make_category, auth_headers, monkeypatch
):
    make_category(id="cat_electrical", name="Electrical")
    monkeypatch.setattr("app.api.v1.endpoints.public_services._score_candidates", lambda *_: [])
    client.post(
        "/api/v1/public-services/", json=public_payload(), headers=auth_headers(resident_user)
    )

    pending = client.get(
        "/api/v1/public-services/?status_filter=Pending", headers=auth_headers(resident_user)
    )
    assert pending.status_code == 200
    assert len(pending.json()) == 1

    resolved = client.get(
        "/api/v1/public-services/?status_filter=Resolved", headers=auth_headers(resident_user)
    )
    assert resolved.json() == []


# --- create_public_service ---------------------------------------------------------


def test_create_public_service_rejects_unknown_category(client, resident_user, auth_headers):
    payload = public_payload()
    payload["category_id"] = "does-not-exist"

    response = client.post(
        "/api/v1/public-services/", json=payload, headers=auth_headers(resident_user)
    )

    assert response.status_code == 422
    assert "Category not found" in response.json()["detail"]


def test_create_public_service_rejects_media_not_owned_by_uploader(
    client, resident_user, make_category, auth_headers
):
    make_category(id="cat_electrical", name="Electrical")
    payload = public_payload()
    payload["photo_urls"] = ["https://bucket.s3.region.amazonaws.com/photos/someone-else/pic.jpg"]

    response = client.post(
        "/api/v1/public-services/", json=payload, headers=auth_headers(resident_user)
    )

    assert response.status_code == 403


def test_create_public_service_with_own_uploaded_photo_succeeds(
    client, resident_user, make_category, auth_headers, mock_s3
):
    make_category(id="cat_electrical", name="Electrical")
    upload = client.post(
        "/api/v1/uploads/",
        files={"file": ("leak.jpg", b"fake-image-bytes", "image/jpeg")},
        data={"kind": "photo"},
        headers=auth_headers(resident_user),
    )
    assert upload.status_code == 200
    photo_url = upload.json()["url"]

    payload = public_payload()
    payload["photo_urls"] = [photo_url]

    response = client.post(
        "/api/v1/public-services/", json=payload, headers=auth_headers(resident_user)
    )

    assert response.status_code == 201, response.text
    assert response.json()["reports"][0]["media"][0]["media_url"] == photo_url


# --- get/update/comments/history 404s and edge cases ------------------------------


def test_get_public_service_404(client, resident_user, auth_headers):
    response = client.get(
        "/api/v1/public-services/does-not-exist", headers=auth_headers(resident_user)
    )
    assert response.status_code == 404


def test_update_public_service_404(client, resident_user, auth_headers):
    response = client.patch(
        "/api/v1/public-services/does-not-exist",
        json={"status": "Resolved"},
        headers=auth_headers(resident_user),
    )
    assert response.status_code == 404


def test_update_resolved_public_service_is_locked(
    client, resident_user, make_category, auth_headers, monkeypatch
):
    make_category(id="cat_electrical", name="Electrical")
    monkeypatch.setattr("app.api.v1.endpoints.public_services._score_candidates", lambda *_: [])
    service = client.post(
        "/api/v1/public-services/", json=public_payload(), headers=auth_headers(resident_user)
    ).json()
    client.patch(
        f'/api/v1/public-services/{service["id"]}',
        json={"status": "Resolved", "resolution_remarks": "Fixed"},
        headers=auth_headers(resident_user),
    )

    response = client.patch(
        f'/api/v1/public-services/{service["id"]}',
        json={"status": "Resolved"},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 409


def test_resident_cannot_update_disallowed_fields(
    client, resident_user, maintenance_user, make_category, auth_headers, monkeypatch
):
    make_category(id="cat_electrical", name="Electrical")
    monkeypatch.setattr("app.api.v1.endpoints.public_services._score_candidates", lambda *_: [])
    service = client.post(
        "/api/v1/public-services/", json=public_payload(), headers=auth_headers(resident_user)
    ).json()

    response = client.patch(
        f'/api/v1/public-services/{service["id"]}',
        json={"worker_id": maintenance_user.id},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 403


def test_maintenance_staff_cannot_update_unassigned_service(
    client, resident_user, maintenance_user, make_category, auth_headers, monkeypatch
):
    make_category(id="cat_electrical", name="Electrical")
    monkeypatch.setattr("app.api.v1.endpoints.public_services._score_candidates", lambda *_: [])
    service = client.post(
        "/api/v1/public-services/", json=public_payload(), headers=auth_headers(resident_user)
    ).json()

    response = client.patch(
        f'/api/v1/public-services/{service["id"]}',
        json={"status": "In_Progress"},
        headers=auth_headers(maintenance_user),
    )

    assert response.status_code == 403


def test_maintenance_staff_invalid_status_transition(
    client, resident_user, employee_user, maintenance_user, make_category, auth_headers, monkeypatch
):
    make_category(id="cat_electrical", name="Electrical")
    monkeypatch.setattr("app.api.v1.endpoints.public_services._score_candidates", lambda *_: [])
    service = client.post(
        "/api/v1/public-services/", json=public_payload(), headers=auth_headers(resident_user)
    ).json()
    client.patch(
        f'/api/v1/public-services/{service["id"]}',
        json={"worker_id": maintenance_user.id},
        headers=auth_headers(employee_user),
    )

    response = client.patch(
        f'/api/v1/public-services/{service["id"]}',
        json={"status": "Pending"},
        headers=auth_headers(maintenance_user),
    )

    assert response.status_code == 409


def test_employee_assigns_invalid_worker(
    client, resident_user, employee_user, make_category, auth_headers, monkeypatch
):
    make_category(id="cat_electrical", name="Electrical")
    monkeypatch.setattr("app.api.v1.endpoints.public_services._score_candidates", lambda *_: [])
    service = client.post(
        "/api/v1/public-services/", json=public_payload(), headers=auth_headers(resident_user)
    ).json()

    response = client.patch(
        f'/api/v1/public-services/{service["id"]}',
        json={"worker_id": resident_user.id},
        headers=auth_headers(employee_user),
    )

    assert response.status_code == 422


def test_employee_can_reject_pending_public_service(
    client, resident_user, employee_user, make_category, auth_headers, monkeypatch
):
    make_category(id="cat_electrical", name="Electrical")
    monkeypatch.setattr("app.api.v1.endpoints.public_services._score_candidates", lambda *_: [])
    service = client.post(
        "/api/v1/public-services/", json=public_payload(), headers=auth_headers(resident_user)
    ).json()

    response = client.patch(
        f'/api/v1/public-services/{service["id"]}',
        json={"status": "Rejected", "resolution_remarks": "Not a real public issue."},
        headers=auth_headers(employee_user),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "Rejected"
    assert body["resolution_remarks"] == "Not a real public issue."

    # Locked once rejected, just like Resolved/Merged.
    follow_up = client.patch(
        f'/api/v1/public-services/{service["id"]}',
        json={"resolution_remarks": "second try"},
        headers=auth_headers(employee_user),
    )
    assert follow_up.status_code == 409

    comment = client.post(
        f'/api/v1/public-services/{service["id"]}/comments',
        json={"message": "still discussing?"},
        headers=auth_headers(resident_user),
    )
    assert comment.status_code == 409


def test_reject_public_service_requires_a_reason(
    client, resident_user, employee_user, make_category, auth_headers, monkeypatch
):
    make_category(id="cat_electrical", name="Electrical")
    monkeypatch.setattr("app.api.v1.endpoints.public_services._score_candidates", lambda *_: [])
    service = client.post(
        "/api/v1/public-services/", json=public_payload(), headers=auth_headers(resident_user)
    ).json()

    response = client.patch(
        f'/api/v1/public-services/{service["id"]}',
        json={"status": "Rejected"},
        headers=auth_headers(employee_user),
    )

    assert response.status_code == 422


def test_reject_public_service_forbidden_once_assigned(
    client, resident_user, employee_user, maintenance_user, make_category, auth_headers, monkeypatch
):
    make_category(id="cat_electrical", name="Electrical")
    monkeypatch.setattr("app.api.v1.endpoints.public_services._score_candidates", lambda *_: [])
    service = client.post(
        "/api/v1/public-services/", json=public_payload(), headers=auth_headers(resident_user)
    ).json()
    client.patch(
        f'/api/v1/public-services/{service["id"]}',
        json={"worker_id": maintenance_user.id},
        headers=auth_headers(employee_user),
    )

    response = client.patch(
        f'/api/v1/public-services/{service["id"]}',
        json={"status": "Rejected", "resolution_remarks": "too late"},
        headers=auth_headers(employee_user),
    )

    assert response.status_code == 409


def test_employee_cannot_set_status_to_merged_directly(
    client, resident_user, employee_user, make_category, auth_headers, monkeypatch
):
    make_category(id="cat_electrical", name="Electrical")
    monkeypatch.setattr("app.api.v1.endpoints.public_services._score_candidates", lambda *_: [])
    service = client.post(
        "/api/v1/public-services/", json=public_payload(), headers=auth_headers(resident_user)
    ).json()

    response = client.patch(
        f'/api/v1/public-services/{service["id"]}',
        json={"status": "Merged"},
        headers=auth_headers(employee_user),
    )

    assert response.status_code == 403


def test_list_public_comments_success_and_404(
    client, resident_user, make_category, auth_headers, monkeypatch
):
    make_category(id="cat_electrical", name="Electrical")
    monkeypatch.setattr("app.api.v1.endpoints.public_services._score_candidates", lambda *_: [])
    service = client.post(
        "/api/v1/public-services/", json=public_payload(), headers=auth_headers(resident_user)
    ).json()
    client.post(
        f'/api/v1/public-services/{service["id"]}/comments',
        json={"message": "First comment"},
        headers=auth_headers(resident_user),
    )

    response = client.get(
        f'/api/v1/public-services/{service["id"]}/comments', headers=auth_headers(resident_user)
    )
    assert response.status_code == 200
    assert len(response.json()) == 1

    missing = client.get(
        "/api/v1/public-services/does-not-exist/comments", headers=auth_headers(resident_user)
    )
    assert missing.status_code == 404


def test_create_comment_404(client, resident_user, auth_headers):
    response = client.post(
        "/api/v1/public-services/does-not-exist/comments",
        json={"message": "Hello"},
        headers=auth_headers(resident_user),
    )
    assert response.status_code == 404


def test_comment_notifies_assigned_worker(
    client,
    resident_user,
    employee_user,
    maintenance_user,
    make_category,
    auth_headers,
    monkeypatch,
):
    make_category(id="cat_electrical", name="Electrical")
    monkeypatch.setattr("app.api.v1.endpoints.public_services._score_candidates", lambda *_: [])
    service = client.post(
        "/api/v1/public-services/", json=public_payload(), headers=auth_headers(resident_user)
    ).json()
    client.patch(
        f'/api/v1/public-services/{service["id"]}',
        json={"worker_id": maintenance_user.id},
        headers=auth_headers(employee_user),
    )

    client.post(
        f'/api/v1/public-services/{service["id"]}/comments',
        json={"message": "Any update?"},
        headers=auth_headers(resident_user),
    )

    notifications = client.get(
        "/api/v1/notifications/me", headers=auth_headers(maintenance_user)
    ).json()
    assert any(n["public_service_id"] == service["id"] for n in notifications)


def test_list_public_history_success_and_404(
    client, resident_user, make_category, auth_headers, monkeypatch
):
    make_category(id="cat_electrical", name="Electrical")
    monkeypatch.setattr("app.api.v1.endpoints.public_services._score_candidates", lambda *_: [])
    service = client.post(
        "/api/v1/public-services/", json=public_payload(), headers=auth_headers(resident_user)
    ).json()

    response = client.get(
        f'/api/v1/public-services/{service["id"]}/history', headers=auth_headers(resident_user)
    )
    assert response.status_code == 200
    assert len(response.json()) == 1

    missing = client.get(
        "/api/v1/public-services/does-not-exist/history", headers=auth_headers(resident_user)
    )
    assert missing.status_code == 404


# --- review_similarity_suggestion --------------------------------------------------


def test_review_similarity_suggestion_404(client, employee_user, auth_headers):
    response = client.post(
        "/api/v1/public-services/similarity/suggestions/does-not-exist/review",
        json={"accept": True},
        headers=auth_headers(employee_user),
    )
    assert response.status_code == 404


def test_review_similarity_suggestion_rejects_already_reviewed(
    client, db_session, resident_user, employee_user, make_user, make_category, auth_headers, monkeypatch
):
    make_category(id="cat_electrical", name="Electrical")
    second_resident = make_user(role=UserRole.resident)
    _pair(client, auth_headers, resident_user, second_resident, monkeypatch)
    suggestion = db_session.query(PublicSimilaritySuggestion).one()

    first_review = client.post(
        f"/api/v1/public-services/similarity/suggestions/{suggestion.id}/review",
        json={"accept": False},
        headers=auth_headers(employee_user),
    )
    assert first_review.status_code == 200

    second_review = client.post(
        f"/api/v1/public-services/similarity/suggestions/{suggestion.id}/review",
        json={"accept": False},
        headers=auth_headers(employee_user),
    )
    assert second_review.status_code == 409


def test_review_similarity_suggestion_missing_service_returns_404(
    client, db_session, resident_user, employee_user, make_user, make_category, auth_headers, monkeypatch
):
    make_category(id="cat_electrical", name="Electrical")
    second_resident = make_user(role=UserRole.resident)
    first, _second = _pair(client, auth_headers, resident_user, second_resident, monkeypatch)
    suggestion = db_session.query(PublicSimilaritySuggestion).one()

    db_session.delete(db_session.get(PublicService, first["id"]))
    db_session.commit()

    response = client.post(
        f"/api/v1/public-services/similarity/suggestions/{suggestion.id}/review",
        json={"accept": True},
        headers=auth_headers(employee_user),
    )
    assert response.status_code == 404


def test_review_similarity_suggestion_rejects_when_a_service_is_already_resolved(
    client, db_session, resident_user, employee_user, make_user, make_category, auth_headers, monkeypatch
):
    make_category(id="cat_electrical", name="Electrical")
    second_resident = make_user(role=UserRole.resident)
    first, _second = _pair(client, auth_headers, resident_user, second_resident, monkeypatch)
    suggestion = db_session.query(PublicSimilaritySuggestion).one()

    client.patch(
        f'/api/v1/public-services/{first["id"]}',
        json={"status": "Resolved", "resolution_remarks": "Fixed"},
        headers=auth_headers(resident_user),
    )

    response = client.post(
        f"/api/v1/public-services/similarity/suggestions/{suggestion.id}/review",
        json={"accept": True},
        headers=auth_headers(employee_user),
    )
    assert response.status_code == 409


def test_merge_with_conflicting_workers_leaves_result_unassigned(
    client,
    db_session,
    resident_user,
    employee_user,
    maintenance_user,
    make_user,
    make_category,
    auth_headers,
    monkeypatch,
):
    make_category(id="cat_electrical", name="Electrical")
    second_resident = make_user(role=UserRole.resident)
    other_worker = make_user(role=UserRole.maintenance_staff)
    first, second = _pair(client, auth_headers, resident_user, second_resident, monkeypatch)

    client.patch(
        f'/api/v1/public-services/{first["id"]}',
        json={"worker_id": maintenance_user.id},
        headers=auth_headers(employee_user),
    )
    client.patch(
        f'/api/v1/public-services/{second["id"]}',
        json={"worker_id": other_worker.id},
        headers=auth_headers(employee_user),
    )

    suggestion = db_session.query(PublicSimilaritySuggestion).one()
    response = client.post(
        f"/api/v1/public-services/similarity/suggestions/{suggestion.id}/review",
        json={"accept": True},
        headers=auth_headers(employee_user),
    )

    assert response.status_code == 200
    merged = db_session.get(PublicService, response.json()["merged_service_id"])
    assert merged.worker_id is None
    assert merged.status == PublicServiceStatus.Pending


def test_merge_transfers_comments_declines_stale_suggestions_and_notifies_worker(
    client,
    db_session,
    resident_user,
    employee_user,
    maintenance_user,
    make_user,
    make_category,
    auth_headers,
    monkeypatch,
):
    make_category(id="cat_electrical", name="Electrical")
    second_resident = make_user(role=UserRole.resident)
    third_resident = make_user(role=UserRole.resident)
    monkeypatch.setattr(
        "app.api.v1.endpoints.public_services._score_candidates",
        lambda service, candidates: [
            {"service_id": c.id, "score": 0.9, "rationale": "match"} for c in candidates
        ],
    )
    first = client.post(
        "/api/v1/public-services/", json=public_payload(), headers=auth_headers(resident_user)
    ).json()
    second = client.post(
        "/api/v1/public-services/",
        json=public_payload(title="Second report"),
        headers=auth_headers(second_resident),
    ).json()
    third = client.post(
        "/api/v1/public-services/",
        json=public_payload(title="Third report"),
        headers=auth_headers(third_resident),
    ).json()

    # A comment on `first`, posted before the merge, must survive onto the merged page.
    client.post(
        f'/api/v1/public-services/{first["id"]}/comments',
        json={"message": "Also seeing this"},
        headers=auth_headers(second_resident),
    )
    # A worker assigned to `first` only - the merge result should inherit it.
    client.patch(
        f'/api/v1/public-services/{first["id"]}',
        json={"worker_id": maintenance_user.id},
        headers=auth_headers(employee_user),
    )

    suggestions = db_session.query(PublicSimilaritySuggestion).all()
    suggestion_first_second = next(
        s for s in suggestions if {s.service_a_id, s.service_b_id} == {first["id"], second["id"]}
    )
    suggestion_first_third = next(
        s for s in suggestions if {s.service_a_id, s.service_b_id} == {first["id"], third["id"]}
    )

    response = client.post(
        f"/api/v1/public-services/similarity/suggestions/{suggestion_first_second.id}/review",
        json={"accept": True},
        headers=auth_headers(employee_user),
    )
    assert response.status_code == 200
    merged_id = response.json()["merged_service_id"]

    merged_comments = client.get(
        f"/api/v1/public-services/{merged_id}/comments", headers=auth_headers(resident_user)
    ).json()
    assert any(c["message"] == "Also seeing this" for c in merged_comments)

    db_session.expire_all()
    assert (
        db_session.get(PublicSimilaritySuggestion, suggestion_first_third.id).status
        == SimilaritySuggestionStatus.Declined
    )

    worker_notifications = client.get(
        "/api/v1/notifications/me", headers=auth_headers(maintenance_user)
    ).json()
    assert any(n["public_service_id"] == merged_id for n in worker_notifications)
