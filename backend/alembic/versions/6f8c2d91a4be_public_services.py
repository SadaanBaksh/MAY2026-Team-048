"""add public service reports, discussions, and AI merge suggestions

Revision ID: 6f8c2d91a4be
Revises: 213b41865a45
Create Date: 2026-08-07 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "6f8c2d91a4be"
down_revision: Union[str, None] = "213b41865a45"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


public_service_status = sa.Enum(
    "Pending", "Assigned", "In_Progress", "Resolved", "Merged", name="publicservicestatus"
)
similarity_status = sa.Enum(
    "Pending", "Accepted", "Declined", name="similaritysuggestionstatus"
)


def upgrade() -> None:
    op.create_table(
        "public_services",
        sa.Column("created_by_id", sa.String(length=36), nullable=False),
        sa.Column("worker_id", sa.String(length=36), nullable=True),
        sa.Column("category_id", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("location", sa.String(length=300), nullable=False),
        sa.Column("ai_summary", sa.Text(), nullable=False),
        sa.Column("priority", sa.Enum("Low", "Medium", "High", "Critical", "Emergency", name="priority", create_type=False), nullable=False),
        sa.Column("status", public_service_status, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_remarks", sa.Text(), nullable=True),
        sa.Column("resolution_proof_url", sa.String(length=500), nullable=True),
        sa.Column("merged_into_id", sa.String(length=36), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["merged_into_id"], ["public_services.id"]),
        sa.ForeignKeyConstraint(["worker_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_public_services_id", "public_services", ["id"])
    op.create_index("ix_public_services_status", "public_services", ["status"])
    op.create_index("ix_public_services_created_at", "public_services", ["created_at"])
    op.create_index("ix_public_services_merged_into_id", "public_services", ["merged_into_id"])
    op.create_index("ix_public_services_worker_id", "public_services", ["worker_id"])
    op.create_index("ix_public_services_category_id", "public_services", ["category_id"])

    op.create_table(
        "public_reports",
        sa.Column("service_id", sa.String(length=36), nullable=False),
        sa.Column("author_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("location", sa.String(length=300), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["service_id"], ["public_services.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_public_reports_id", "public_reports", ["id"])
    op.create_index("ix_public_reports_service_id", "public_reports", ["service_id"])

    op.create_table(
        "public_report_media",
        sa.Column("report_id", sa.String(length=36), nullable=False),
        sa.Column("media_url", sa.String(length=500), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["report_id"], ["public_reports.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_public_report_media_id", "public_report_media", ["id"])
    op.create_index("ix_public_report_media_report_id", "public_report_media", ["report_id"])

    op.create_table(
        "public_service_comments",
        sa.Column("service_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["service_id"], ["public_services.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_public_service_comments_id", "public_service_comments", ["id"])
    op.create_index("ix_public_service_comments_service_id", "public_service_comments", ["service_id"])

    op.create_table(
        "public_service_history",
        sa.Column("service_id", sa.String(length=36), nullable=False),
        sa.Column("old_status", public_service_status, nullable=True),
        sa.Column("new_status", public_service_status, nullable=False),
        sa.Column("remarks", sa.Text(), nullable=False),
        sa.Column("actor_id", sa.String(length=36), nullable=True),
        sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["service_id"], ["public_services.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_public_service_history_id", "public_service_history", ["id"])
    op.create_index("ix_public_service_history_service_id", "public_service_history", ["service_id"])

    op.create_table(
        "public_similarity_suggestions",
        sa.Column("service_a_id", sa.String(length=36), nullable=False),
        sa.Column("service_b_id", sa.String(length=36), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("model_name", sa.String(length=100), nullable=False),
        sa.Column("status", similarity_status, nullable=False),
        sa.Column("reviewed_by_id", sa.String(length=36), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("merged_service_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["merged_service_id"], ["public_services.id"]),
        sa.ForeignKeyConstraint(["reviewed_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["service_a_id"], ["public_services.id"]),
        sa.ForeignKeyConstraint(["service_b_id"], ["public_services.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("service_a_id", "service_b_id", name="uq_public_similarity_pair"),
    )
    op.create_index("ix_public_similarity_suggestions_id", "public_similarity_suggestions", ["id"])
    op.create_index("ix_public_similarity_suggestions_service_a_id", "public_similarity_suggestions", ["service_a_id"])
    op.create_index("ix_public_similarity_suggestions_service_b_id", "public_similarity_suggestions", ["service_b_id"])
    op.create_index("ix_public_similarity_suggestions_status", "public_similarity_suggestions", ["status"])

    op.add_column(
        "notifications", sa.Column("public_service_id", sa.String(length=36), nullable=True)
    )
    op.create_foreign_key(
        "fk_notifications_public_service_id",
        "notifications",
        "public_services",
        ["public_service_id"],
        ["id"],
    )
    op.create_check_constraint(
        "ck_notification_single_target",
        "notifications",
        "ticket_id IS NULL OR public_service_id IS NULL",
    )


def downgrade() -> None:
    op.drop_constraint("ck_notification_single_target", "notifications", type_="check")
    op.drop_constraint("fk_notifications_public_service_id", "notifications", type_="foreignkey")
    op.drop_column("notifications", "public_service_id")
    op.drop_table("public_similarity_suggestions")
    op.drop_table("public_service_history")
    op.drop_table("public_service_comments")
    op.drop_table("public_report_media")
    op.drop_table("public_reports")
    op.drop_table("public_services")
    similarity_status.drop(op.get_bind(), checkfirst=True)
    public_service_status.drop(op.get_bind(), checkfirst=True)
