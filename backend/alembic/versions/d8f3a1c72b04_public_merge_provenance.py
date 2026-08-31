"""track public-service merge provenance so an employee can unmerge

Adds a nullable ``original_service_id`` to public_reports and public_service_comments.
When a merge folds rows onto a combined page, this records the page they came from,
which is what the unmerge endpoint reads to put them back.

Revision ID: d8f3a1c72b04
Revises: a1b2c3d4e5f6
Create Date: 2026-09-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd8f3a1c72b04'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'public_reports',
        sa.Column('original_service_id', sa.String(length=36), nullable=True),
    )
    op.add_column(
        'public_service_comments',
        sa.Column('original_service_id', sa.String(length=36), nullable=True),
    )
    op.create_foreign_key(
        'fk_public_reports_original_service_id',
        'public_reports',
        'public_services',
        ['original_service_id'],
        ['id'],
    )
    op.create_foreign_key(
        'fk_public_service_comments_original_service_id',
        'public_service_comments',
        'public_services',
        ['original_service_id'],
        ['id'],
    )


def downgrade() -> None:
    op.drop_constraint(
        'fk_public_service_comments_original_service_id',
        'public_service_comments',
        type_='foreignkey',
    )
    op.drop_constraint(
        'fk_public_reports_original_service_id', 'public_reports', type_='foreignkey'
    )
    op.drop_column('public_service_comments', 'original_service_id')
    op.drop_column('public_reports', 'original_service_id')
