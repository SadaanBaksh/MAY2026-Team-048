import pytest

from app.db.session import get_db


def test_get_db_yields_a_session_and_closes_it_when_done():
    """Exercises the generator's own lifecycle (yield + finally: close()) without
    needing a live connection - SQLAlchemy Sessions are lazy until a query runs."""
    generator = get_db()
    session = next(generator)
    assert session is not None

    with pytest.raises(StopIteration):
        next(generator)
