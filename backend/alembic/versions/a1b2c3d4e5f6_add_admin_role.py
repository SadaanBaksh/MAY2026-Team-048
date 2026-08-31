"""add admin user role

Revision ID: a1b2c3d4e5f6
Revises: d7e2f1a63c90
Create Date: 2026-09-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'd7e2f1a63c90'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Postgres requires new enum values to be committed before they can be used, so this
    # can't run in the same transaction as a row that sets role='admin'.
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'admin'")


def downgrade() -> None:
    # Postgres has no DROP VALUE for enums; downgrading would require rebuilding the type
    # and remapping any rows already set to 'admin', which is out of scope here.
    pass
