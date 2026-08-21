"""add rejected status to tickets and public services

Revision ID: c1d5e9a04f27
Revises: b84d2f6a91c7
Create Date: 2026-08-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1d5e9a04f27'
down_revision: Union[str, None] = 'b84d2f6a91c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Postgres requires new enum values to be committed before they can be used, so this
    # can't run in the same transaction as a row that sets status='Rejected'.
    op.execute("ALTER TYPE ticketstatus ADD VALUE IF NOT EXISTS 'Rejected'")
    op.execute("ALTER TYPE publicservicestatus ADD VALUE IF NOT EXISTS 'Rejected'")


def downgrade() -> None:
    # Postgres has no DROP VALUE for enums; downgrading would require rebuilding the type
    # and remapping any rows already set to 'Rejected', which is out of scope here.
    pass
