"""merge migration heads

Revision ID: e4266389046f
Revises: 3a1f9e2b4c8d, 6f8c2d91a4be
Create Date: 2026-08-08 12:14:28.694046

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4266389046f'
down_revision: Union[str, None] = ('3a1f9e2b4c8d', '6f8c2d91a4be')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
