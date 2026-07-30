import pytest

from app.models.enums import UserRole


@pytest.fixture()
def category(make_category):
    return make_category(id="cat_plumbing", name="Plumbing", icon="water")


@pytest.fixture()
def ticket(client, auth_headers, resident_user, category):
    response = client.post(
        "/api/v1/tickets/",
        json={"title": "Leaking faucet", "category_id": category.id},
        headers=auth_headers(resident_user),
    )
    assert response.status_code == 201
    return response.json()


def test_create_comment(client, auth_headers, resident_user, ticket):
    response = client.post(
        f"/api/v1/tickets/{ticket['id']}/comments",
        json={"message": "Any update?"},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["message"] == "Any update?"
    assert body["user_id"] == resident_user.id


def test_list_comments_ordered(client, auth_headers, resident_user, employee_user, ticket):
    client.post(
        f"/api/v1/tickets/{ticket['id']}/comments",
        json={"message": "First"},
        headers=auth_headers(resident_user),
    )
    client.post(
        f"/api/v1/tickets/{ticket['id']}/comments",
        json={"message": "Second"},
        headers=auth_headers(employee_user),
    )

    response = client.get(
        f"/api/v1/tickets/{ticket['id']}/comments", headers=auth_headers(resident_user)
    )

    assert response.status_code == 200
    messages = [c["message"] for c in response.json()]
    assert messages == ["First", "Second"]


def test_comments_require_ticket_access(
    client, auth_headers, make_user, ticket
):
    outsider = make_user(role=UserRole.resident)

    list_response = client.get(
        f"/api/v1/tickets/{ticket['id']}/comments", headers=auth_headers(outsider)
    )
    create_response = client.post(
        f"/api/v1/tickets/{ticket['id']}/comments",
        json={"message": "Hi"},
        headers=auth_headers(outsider),
    )

    assert list_response.status_code == 403
    assert create_response.status_code == 403


def test_comments_allowed_for_employee_and_manager(
    client, auth_headers, employee_user, manager_user, ticket
):
    for user in (employee_user, manager_user):
        response = client.get(
            f"/api/v1/tickets/{ticket['id']}/comments", headers=auth_headers(user)
        )
        assert response.status_code == 200


def test_comments_ticket_not_found(client, auth_headers, resident_user):
    response = client.get(
        "/api/v1/tickets/does-not-exist/comments", headers=auth_headers(resident_user)
    )
    assert response.status_code == 404


def test_create_comment_ticket_not_found(client, auth_headers, resident_user):
    response = client.post(
        "/api/v1/tickets/does-not-exist/comments",
        json={"message": "Hi"},
        headers=auth_headers(resident_user),
    )
    assert response.status_code == 404
