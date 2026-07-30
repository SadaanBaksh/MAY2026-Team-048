from datetime import datetime, timezone

import pytest

from app.models.notification import Notification


@pytest.fixture()
def make_notification(db_session):
    def _make(user_id: str, **overrides) -> Notification:
        defaults = dict(
            user_id=user_id,
            ticket_id=None,
            title="New assignment",
            message="You have been assigned a ticket.",
            is_read=False,
            created_at=datetime.now(timezone.utc),
        )
        defaults.update(overrides)
        notification = Notification(**defaults)
        db_session.add(notification)
        db_session.commit()
        db_session.refresh(notification)
        return notification

    return _make


def test_list_my_notifications_scoped_to_caller(
    client, auth_headers, resident_user, employee_user, make_notification
):
    make_notification(resident_user.id, title="For resident")
    make_notification(employee_user.id, title="For employee")

    response = client.get("/api/v1/notifications/me", headers=auth_headers(resident_user))

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["title"] == "For resident"


def test_list_my_notifications_requires_auth(client):
    response = client.get("/api/v1/notifications/me")
    assert response.status_code == 401


def test_list_my_notifications_newest_first(client, auth_headers, resident_user, make_notification):
    older = make_notification(
        resident_user.id, title="Older", created_at=datetime(2024, 1, 1, tzinfo=timezone.utc)
    )
    newer = make_notification(
        resident_user.id, title="Newer", created_at=datetime(2024, 1, 2, tzinfo=timezone.utc)
    )

    response = client.get("/api/v1/notifications/me", headers=auth_headers(resident_user))

    ids = [row["id"] for row in response.json()]
    assert ids == [newer.id, older.id]


def test_mark_notification_read(client, auth_headers, resident_user, make_notification):
    notification = make_notification(resident_user.id)

    response = client.patch(
        f"/api/v1/notifications/{notification.id}/read", headers=auth_headers(resident_user)
    )

    assert response.status_code == 200
    assert response.json()["is_read"] is True


def test_mark_notification_read_not_owned(
    client, auth_headers, resident_user, employee_user, make_notification
):
    notification = make_notification(employee_user.id)

    response = client.patch(
        f"/api/v1/notifications/{notification.id}/read", headers=auth_headers(resident_user)
    )

    assert response.status_code == 404


def test_mark_notification_read_not_found(client, auth_headers, resident_user):
    response = client.patch(
        "/api/v1/notifications/does-not-exist/read", headers=auth_headers(resident_user)
    )
    assert response.status_code == 404
