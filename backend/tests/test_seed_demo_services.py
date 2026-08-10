from app.models.enums import UserRole
from app.models.public_service import PublicReport, PublicService
from app.models.ticket import Ticket
from app.models.user import User
from scripts import seed_demo_services


class _NonClosingSession:
    """Proxy the pytest session while ignoring the script's ownership close()."""

    def __init__(self, session):
        self._session = session

    def __getattr__(self, name):
        return getattr(self._session, name)

    def close(self):
        pass


def test_demo_service_seed_is_complete_and_idempotent(
    db_session, make_user, make_category, monkeypatch
):
    role_by_email = {
        "demo.resident@simplifix.app": UserRole.resident,
        "demo.employee@simplifix.app": UserRole.facility_employee,
        "demo.staff@simplifix.app": UserRole.maintenance_staff,
        "demo.manager@simplifix.app": UserRole.facility_manager,
    }
    for email, role in role_by_email.items():
        make_user(email=email, role=role)

    category_ids = {
        spec["category_id"]
        for spec in seed_demo_services.PRIVATE_SERVICES
        + seed_demo_services.COMMUNITY_SERVICES
    }
    for category_id in category_ids:
        make_category(id=category_id, name=category_id.removeprefix("cat_").title())

    session = _NonClosingSession(db_session)
    monkeypatch.setattr(seed_demo_services, "SessionLocal", lambda: session)

    seed_demo_services.seed()
    seed_demo_services.seed()

    assert db_session.query(Ticket).count() == len(seed_demo_services.PRIVATE_SERVICES)
    assert db_session.query(PublicService).count() == len(
        seed_demo_services.COMMUNITY_SERVICES
    )
    assert db_session.query(PublicReport).count() == len(
        seed_demo_services.COMMUNITY_SERVICES
    )
    resident_id = (
        db_session.query(User.id)
        .filter(User.email == "demo.resident@simplifix.app")
        .scalar()
    )
    assert {ticket.resident_id for ticket in db_session.query(Ticket).all()} == {
        resident_id
    }
    assert {
        ticket.worker_id is not None for ticket in db_session.query(Ticket).all()
    } == {False, True}
