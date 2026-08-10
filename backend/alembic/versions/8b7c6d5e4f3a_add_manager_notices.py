"""add manager notices

Revision ID: 8b7c6d5e4f3a
Revises: e4266389046f
Create Date: 2026-08-10 12:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "8b7c6d5e4f3a"
down_revision: str | None = "e4266389046f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

notice_status = sa.Enum("Draft", "Scheduled", "Sent", "Expired", "Cancelled", name="noticestatus")


def upgrade() -> None:
    op.create_table(
        "notices",
        sa.Column("created_by_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("brief_points", sa.JSON(), nullable=False),
        sa.Column("status", notice_status, nullable=False),
        sa.Column("timezone", sa.String(length=100), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("recipient_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("id", "created_by_id", "status", "scheduled_at", "expires_at", "created_at"):
        op.create_index(op.f(f"ix_notices_{column}"), "notices", [column], unique=False)

    op.create_table(
        "notice_targets",
        sa.Column("notice_id", sa.String(length=36), nullable=False),
        sa.Column("building", sa.String(length=100), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["notice_id"], ["notices.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("notice_id", "building", name="uq_notice_target_building"),
    )
    op.create_index(op.f("ix_notice_targets_notice_id"), "notice_targets", ["notice_id"])
    op.create_index(op.f("ix_notice_targets_building"), "notice_targets", ["building"])
    op.create_index(op.f("ix_notice_targets_id"), "notice_targets", ["id"])

    op.add_column("notifications", sa.Column("notice_id", sa.String(length=36), nullable=True))
    op.create_foreign_key(
        "fk_notifications_notice_id", "notifications", "notices", ["notice_id"], ["id"]
    )
    op.create_index(op.f("ix_notifications_notice_id"), "notifications", ["notice_id"])
    op.drop_constraint("ck_notification_single_target", "notifications", type_="check")
    op.create_check_constraint(
        "ck_notification_single_target",
        "notifications",
        "(CASE WHEN ticket_id IS NOT NULL THEN 1 ELSE 0 END + "
        "CASE WHEN public_service_id IS NOT NULL THEN 1 ELSE 0 END + "
        "CASE WHEN notice_id IS NOT NULL THEN 1 ELSE 0 END) <= 1",
    )
    op.create_unique_constraint(
        "uq_notification_user_notice", "notifications", ["user_id", "notice_id"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_notification_user_notice", "notifications", type_="unique")
    op.drop_constraint("ck_notification_single_target", "notifications", type_="check")
    op.create_check_constraint(
        "ck_notification_single_target",
        "notifications",
        "ticket_id IS NULL OR public_service_id IS NULL",
    )
    op.drop_constraint("fk_notifications_notice_id", "notifications", type_="foreignkey")
    op.drop_index(op.f("ix_notifications_notice_id"), table_name="notifications")
    op.drop_column("notifications", "notice_id")
    op.drop_index(op.f("ix_notice_targets_id"), table_name="notice_targets")
    op.drop_index(op.f("ix_notice_targets_building"), table_name="notice_targets")
    op.drop_index(op.f("ix_notice_targets_notice_id"), table_name="notice_targets")
    op.drop_table("notice_targets")
    for column in ("created_at", "expires_at", "scheduled_at", "status", "created_by_id", "id"):
        op.drop_index(op.f(f"ix_notices_{column}"), table_name="notices")
    op.drop_table("notices")
    notice_status.drop(op.get_bind(), checkfirst=True)
