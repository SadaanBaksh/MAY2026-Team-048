"""add duplicate merge and public flag

Revision ID: 3a1f9e2b4c8d
Revises: 213b41865a45
Create Date: 2026-08-02 15:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3a1f9e2b4c8d"
down_revision: str | None = "213b41865a45"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add parent_ticket_id and is_public
    op.add_column('tickets', sa.Column('is_public', sa.Boolean(), nullable=False, server_default='0'))
    op.add_column('tickets', sa.Column('parent_ticket_id', sa.String(length=36), nullable=True))
    op.create_index(op.f('ix_tickets_parent_ticket_id'), 'tickets', ['parent_ticket_id'], unique=False)
    op.create_foreign_key('fk_tickets_parent_ticket_id', 'tickets', 'tickets', ['parent_ticket_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('fk_tickets_parent_ticket_id', 'tickets', type_='foreignkey')
    op.drop_index(op.f('ix_tickets_parent_ticket_id'), table_name='tickets')
    op.drop_column('tickets', 'parent_ticket_id')
    op.drop_column('tickets', 'is_public')
