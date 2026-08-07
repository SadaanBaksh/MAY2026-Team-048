from unittest.mock import patch
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.enums import TicketStatus
from app.models.ticket import Ticket
from app.models.notification import Notification

def test_create_public_master_ticket(client: TestClient, resident_user, auth_headers, db_session: Session):
    headers = auth_headers(resident_user)
    response = client.post(
        "/api/v1/tickets/",
        headers=headers,
        json={
            "title": "Public Issue",
            "category_id": "plumbing",
            "resident_note": "Lobby is leaking",
            "is_public": True
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["is_public"] is True
    assert data["parent_ticket_id"] is None
    
    ticket_in_db = db_session.get(Ticket, data["id"])
    assert ticket_in_db.is_public is True


def test_create_duplicate_child_ticket(client: TestClient, resident_user, auth_headers, db_session: Session):
    headers = auth_headers(resident_user)
    # Create master ticket
    master_response = client.post(
        "/api/v1/tickets/",
        headers=headers,
        json={
            "title": "Master Ticket",
            "category_id": "plumbing",
            "resident_note": "Leaking pipe in hallway",
            "is_public": True
        }
    )
    master_id = master_response.json()["id"]
    
    # Create child ticket
    child_response = client.post(
        "/api/v1/tickets/",
        headers=headers,
        json={
            "title": "Child Ticket",
            "category_id": "plumbing",
            "resident_note": "Water in hallway",
            "is_public": True,
            "parent_ticket_id": master_id
        }
    )
    assert child_response.status_code == 201
    child_data = child_response.json()
    assert child_data["parent_ticket_id"] == master_id
    
    child_id = child_data["id"]
    
    # Check notifications
    notifications = db_session.query(Notification).filter(Notification.ticket_id == child_id, Notification.title == "Linked to Existing Incident").all()
    assert len(notifications) == 1
    assert "automatically linked to an existing public issue" in notifications[0].message


def test_cascading_resolution_resolves_children_and_notifies(
    client: TestClient, resident_user, maintenance_user, auth_headers, db_session: Session
):
    r_headers = auth_headers(resident_user)
    m_headers = auth_headers(maintenance_user)
    # Create master and children
    master_res = client.post("/api/v1/tickets/", headers=r_headers, json={"title": "Master", "category_id": "plumbing", "is_public": True})
    master_id = master_res.json()["id"]
    
    child1_res = client.post("/api/v1/tickets/", headers=r_headers, json={"title": "Child 1", "category_id": "plumbing", "is_public": True, "parent_ticket_id": master_id})
    child2_res = client.post("/api/v1/tickets/", headers=r_headers, json={"title": "Child 2", "category_id": "plumbing", "is_public": True, "parent_ticket_id": master_id})
    
    child1_id = child1_res.json()["id"]
    child2_id = child2_res.json()["id"]
    
    # Assign master to staff
    db_master = db_session.get(Ticket, master_id)
    db_master.status = TicketStatus.Assigned
    db_master.worker_id = maintenance_user.id
    db_session.commit()
    
    # Resolve master
    res = client.patch(f"/api/v1/tickets/{master_id}", headers=m_headers, json={"status": "Resolved", "resolution_remarks": "Fixed it"})
    assert res.status_code == 200
    
    # Check master is resolved
    assert db_session.get(Ticket, master_id).status == TicketStatus.Resolved
    
    # Check children are resolved
    child1 = db_session.get(Ticket, child1_id)
    child2 = db_session.get(Ticket, child2_id)
    assert child1.status == TicketStatus.Resolved
    assert child2.status == TicketStatus.Resolved
    assert child1.resolution_remarks == "Fixed it"
    assert child2.resolution_remarks == "Fixed it"
    
    # Check notifications for child 1
    notifications = db_session.query(Notification).filter(Notification.ticket_id == child1_id, Notification.title == "Complaint resolved").all()
    assert len(notifications) == 1
    assert "has been resolved" in notifications[0].message


@patch("app.api.v1.endpoints.ai.generate_multimodal_json")
def test_ai_analyze_complaint_returns_is_public_and_matching_id(
    mock_generate, client: TestClient, resident_user, auth_headers, db_session: Session, make_category
):
    make_category(id="plumbing", name="Plumbing")
    headers = auth_headers(resident_user)
    mock_generate.return_value = {
        "ai_description": "Leak in lobby",
        "category_id": "plumbing",
        "priority": "High",
        "confidence": 0.9,
        "is_public": True,
        "matching_ticket_id": "some-ticket-id"
    }
    
    response = client.post(
        "/api/v1/ai/analyze-complaint",
        headers=headers,
        json={"resident_note": "The lobby is leaking"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_public"] is True
    assert data["matching_ticket_id"] == "some-ticket-id"
