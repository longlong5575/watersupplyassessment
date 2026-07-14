"""Add score source mapping table."""

from alembic import op
import sqlalchemy as sa

revision = "20260624_source_mapping"
down_revision = "20260624_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "score_source_mappings" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "score_source_mappings",
        sa.Column("indicator_id", sa.String(length=36), nullable=False),
        sa.Column("source_type", sa.String(length=40), nullable=False),
        sa.Column("source_key", sa.String(length=160), nullable=False),
        sa.Column("rule", sa.JSON(), nullable=False),
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["indicator_id"], ["indicators.id"]),
    )
    op.create_index("ix_score_source_mappings_indicator_id", "score_source_mappings", ["indicator_id"])


def downgrade() -> None:
    op.drop_index("ix_score_source_mappings_indicator_id", table_name="score_source_mappings")
    op.drop_table("score_source_mappings")
