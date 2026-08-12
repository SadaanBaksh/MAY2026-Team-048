"""merge duplicate chat and cancelled merge heads

Revision ID: 7f3a2c9d1e84
Revises: 2483405fd49c, 35295e5c0448
Create Date: 2026-08-10

This revision was deployed from a feature branch before the equivalent
f9a6e3b43182 merge revision reached main.  It must remain in the migration
history so databases stamped with this revision can still be upgraded.
"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "7f3a2c9d1e84"
down_revision: Union[str, None] = ("2483405fd49c", "35295e5c0448")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
