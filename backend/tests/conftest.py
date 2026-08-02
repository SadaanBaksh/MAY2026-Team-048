import json
import uuid
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.limiter import limiter
from app.core.security import create_access_token, hash_password
from app.db.base import Base  # noqa: F401 - registers every model on Base.metadata
from app.db.session import get_db
from app.main import app
from app.models.apartment import Apartment
from app.models.category import Category
from app.models.enums import AccountStatus, UserRole
from app.models.user import User

# --- API execution capture (used by scripts/generate_api_report.py) --------------
#
# Every request made through TestClient - regardless of which test file or which
# .get()/.post()/.patch()/.delete() convenience method is called - funnels through
# TestClient.request() (verified against the installed starlette/httpx versions:
# the convenience methods call super().get()/.post()/etc, which internally call
# self.request(...), and `self` stays the TestClient instance). Patching that one
# method at the class level, once, is enough to capture every real HTTP call any
# of the 100+ existing tests make, without touching a single test file.

_API_EXECUTIONS: list[dict] = []
_CURRENT_TEST_ID = {"value": "unknown"}
_REPORTS_DIR = Path(__file__).resolve().parent.parent / "reports"

_original_testclient_request = TestClient.request


def _instrumented_request(self, method, url, *args, **kwargs):
    response = _original_testclient_request(self, method, url, *args, **kwargs)
    try:
        path = httpx.URL(str(url)).path
    except Exception:
        path = str(url).split("?", 1)[0]
    _API_EXECUTIONS.append(
        {
            "test": _CURRENT_TEST_ID["value"],
            "method": str(method).upper(),
            "path": path,
            "status": response.status_code,
        }
    )
    return response


TestClient.request = _instrumented_request


def pytest_runtest_setup(item: pytest.Item) -> None:
    _CURRENT_TEST_ID["value"] = item.nodeid


def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:
    _REPORTS_DIR.mkdir(exist_ok=True)
    output_path = _REPORTS_DIR / "api_execution_results.json"
    output_path.write_text(json.dumps({"executions": _API_EXECUTIONS}, indent=2))


@pytest.fixture()
def engine():
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=test_engine)
    yield test_engine
    Base.metadata.drop_all(bind=test_engine)
    test_engine.dispose()


@pytest.fixture()
def db_session(engine):
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    yield session
    session.close()


@pytest.fixture(autouse=True)
def _disable_rate_limit():
    limiter.enabled = False
    yield
    limiter.enabled = True


@pytest.fixture()
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def mock_s3(monkeypatch):
    """Prevents test_uploads.py from touching real AWS; records put_object calls."""
    calls = []

    class FakeS3Client:
        def put_object(self, **kwargs):
            calls.append(kwargs)

    monkeypatch.setattr("app.core.config.settings.S3_BUCKET_NAME", "test-bucket")
    monkeypatch.setattr("app.core.storage._get_s3_client", lambda: FakeS3Client())
    return calls


@pytest.fixture()
def make_apartment(db_session):
    def _make(building: str = "Wing A", unit_number: str = "101") -> Apartment:
        apartment = Apartment(building=building, unit_number=unit_number)
        db_session.add(apartment)
        db_session.commit()
        db_session.refresh(apartment)
        return apartment

    return _make


@pytest.fixture()
def make_category(db_session):
    def _make(id: str = "cat_plumbing", name: str = "Plumbing", icon: str = "water") -> Category:
        category = Category(id=id, name=name, icon=icon)
        db_session.add(category)
        db_session.commit()
        db_session.refresh(category)
        return category

    return _make


@pytest.fixture()
def make_user(db_session, make_apartment):
    def _make(role: UserRole = UserRole.resident, **overrides) -> User:
        if role == UserRole.resident and "apartment_id" not in overrides:
            overrides["apartment_id"] = make_apartment().id

        defaults = dict(
            name="Test User",
            email=f"user-{uuid.uuid4().hex[:8]}@example.com",
            phone=f"+91 9{str(uuid.uuid4().int)[:9]}",
            role=role,
            hashed_password=hash_password("Testpass123"),
            account_status=AccountStatus.active,
        )
        defaults.update(overrides)
        user = User(**defaults)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    return _make


@pytest.fixture()
def resident_user(make_user):
    return make_user(role=UserRole.resident)


@pytest.fixture()
def employee_user(make_user):
    return make_user(role=UserRole.facility_employee)


@pytest.fixture()
def maintenance_user(make_user):
    return make_user(role=UserRole.maintenance_staff)


@pytest.fixture()
def manager_user(make_user):
    return make_user(role=UserRole.facility_manager)


@pytest.fixture()
def auth_headers():
    def _headers(user: User) -> dict[str, str]:
        token = create_access_token(subject=user.id)
        return {"Authorization": f"Bearer {token}"}

    return _headers
