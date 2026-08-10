"""add cancelled ticket status

Revision ID: 4a4af86d7b70
Revises: 8b7c6d5e4f3a
Create Date: 2026-08-10 20:52:11.193967

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4a4af86d7b70'
down_revision: Union[str, None] = '8b7c6d5e4f3a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Postgres requires new enum values to be committed before they can be used, so this
    # can't run in the same transaction as a row that sets status='Cancelled'.
    op.execute("ALTER TYPE ticketstatus ADD VALUE IF NOT EXISTS 'Cancelled'")


def downgrade() -> None:
    # Postgres has no DROP VALUE for enums; downgrading would require rebuilding the type
    # and remapping any rows already set to 'Cancelled', which is out of scope here.
    pass
