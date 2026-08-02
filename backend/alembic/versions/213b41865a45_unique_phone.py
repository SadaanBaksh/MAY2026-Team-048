"""unique constraint on users.phone

Revision ID: 213b41865a45
Revises: eae1e81b0cf9
Create Date: 2026-07-31 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '213b41865a45'
down_revision: Union[str, None] = 'eae1e81b0cf9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Will fail if any duplicate phone numbers already exist — run
    # `SELECT phone, COUNT(*) FROM users GROUP BY phone HAVING COUNT(*) > 1;` first and resolve
    # any hits before applying this. Note this only catches exact-string duplicates (a backstop
    # against race conditions); the app-level checks in auth.py/users.py normalize digits first
    # and are the primary defense against differently-formatted duplicates.
    op.create_index(op.f('ix_users_phone'), 'users', ['phone'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_users_phone'), table_name='users')
