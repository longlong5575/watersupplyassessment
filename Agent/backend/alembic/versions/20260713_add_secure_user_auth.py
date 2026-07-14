"""Add password and login security fields to users."""

import sqlalchemy as sa
from alembic import op


revision = "20260713_secure_user_auth"
down_revision = "20260624_source_mapping"
branch_labels = None
depends_on = None


COLUMNS = (
    sa.Column("password_hash", sa.Text(), nullable=True),
    sa.Column("failed_login_attempts", sa.Integer(), nullable=False, server_default="0"),
    sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
    sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True),
    sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"),
)


def upgrade() -> None:
    existing = {item["name"] for item in sa.inspect(op.get_bind()).get_columns("users")}
    for column in COLUMNS:
        if column.name not in existing:
            op.add_column("users", column)


def downgrade() -> None:
    existing = {item["name"] for item in sa.inspect(op.get_bind()).get_columns("users")}
    for column in reversed(COLUMNS):
        if column.name in existing:
            op.drop_column("users", column.name)