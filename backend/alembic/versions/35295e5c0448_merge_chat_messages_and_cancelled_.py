"""merge chat messages and cancelled status heads

Revision ID: 35295e5c0448
Revises: 28f271b9b743, 4a4af86d7b70
Create Date: 2026-08-10 22:23:48.937321

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '35295e5c0448'
down_revision: Union[str, None] = ('28f271b9b743', '4a4af86d7b70')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
