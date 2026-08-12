"""reconcile duplicate merge revisions

Revision ID: b84d2f6a91c7
Revises: 7f3a2c9d1e84, f9a6e3b43182
Create Date: 2026-08-11

The parent revisions are equivalent no-op merge migrations that were created
on separate branches.  Joining them preserves compatibility with databases
that were stamped with either revision.
"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "b84d2f6a91c7"
down_revision: Union[str, None] = ("7f3a2c9d1e84", "f9a6e3b43182")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
