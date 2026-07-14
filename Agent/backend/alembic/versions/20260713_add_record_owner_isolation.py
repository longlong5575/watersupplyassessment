"""Add owner boundary to assessment records."""

import sqlalchemy as sa
from alembic import op


revision = "20260713_record_owner_isolation"
down_revision = "20260713_secure_user_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {item["name"] for item in inspector.get_columns("assessment_records")}
    if "owner_user_id" not in columns:
        op.add_column(
            "assessment_records",
            sa.Column("owner_user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=True),
        )
    indexes = {item["name"] for item in sa.inspect(op.get_bind()).get_indexes("assessment_records")}
    if "ix_assessment_records_owner_user_id" not in indexes:
        op.create_index("ix_assessment_records_owner_user_id", "assessment_records", ["owner_user_id"])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    indexes = {item["name"] for item in inspector.get_indexes("assessment_records")}
    if "ix_assessment_records_owner_user_id" in indexes:
        op.drop_index("ix_assessment_records_owner_user_id", table_name="assessment_records")
    columns = {item["name"] for item in sa.inspect(op.get_bind()).get_columns("assessment_records")}
    if "owner_user_id" in columns:
        op.drop_column("assessment_records", "owner_user_id")