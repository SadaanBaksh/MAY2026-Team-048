"""add suspended account status

Revision ID: d7e2f1a63c90
Revises: c1d5e9a04f27
Create Date: 2026-09-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd7e2f1a63c90'
down_revision: Union[str, None] = 'c1d5e9a04f27'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Postgres requires new enum values to be committed before they can be used, so this
    # can't run in the same transaction as a row that sets account_status='suspended'.
    op.execute("ALTER TYPE accountstatus ADD VALUE IF NOT EXISTS 'suspended'")


def downgrade() -> None:
    # Postgres has no DROP VALUE for enums; downgrading would require rebuilding the type
    # and remapping any rows already set to 'suspended', which is out of scope here.
    pass
