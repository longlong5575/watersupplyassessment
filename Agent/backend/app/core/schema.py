from __future__ import annotations

from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine


REPORT_TASK_COLUMNS = {
    "created_by_id": "VARCHAR(36)",
    "data_snapshot": "JSON DEFAULT '{}'",
    "dataset_hash": "VARCHAR(80)",
    "started_at": "DATETIME",
    "completed_at": "DATETIME",
}

REPORT_COLUMNS = {
    "version": "INTEGER DEFAULT 1",
    "format": "VARCHAR(20) DEFAULT 'docx'",
    "dataset_hash": "VARCHAR(80)",
    "data_snapshot": "JSON DEFAULT '{}'",
    "task_parameters": "JSON DEFAULT '{}'",
}


def _ensure_columns(table: str, columns: dict[str, str]) -> None:
    with engine.begin() as connection:
        existing = {row[1] for row in connection.execute(text(f"PRAGMA table_info({table})"))}
        for name, definition in columns.items():
            if name not in existing:
                connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {definition}"))


def ensure_local_schema() -> None:
    if not settings.database_url.startswith("sqlite"):
        return
    _ensure_columns("report_tasks", REPORT_TASK_COLUMNS)
    _ensure_columns("reports", REPORT_COLUMNS)
