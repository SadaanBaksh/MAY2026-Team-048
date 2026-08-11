"""merge duplicate migration-head-merge commits

Revision ID: f9a6e3b43182
Revises: 2483405fd49c, 35295e5c0448
Create Date: 2026-08-10 23:21:17.178744

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f9a6e3b43182'
down_revision: Union[str, None] = ('2483405fd49c', '35295e5c0448')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
