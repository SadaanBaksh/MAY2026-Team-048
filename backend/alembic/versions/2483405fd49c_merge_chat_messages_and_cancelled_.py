"""merge chat messages and cancelled status heads

Revision ID: 2483405fd49c
Revises: 28f271b9b743, 4a4af86d7b70
Create Date: 2026-08-10 22:27:06.705379

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2483405fd49c'
down_revision: Union[str, None] = ('28f271b9b743', '4a4af86d7b70')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
