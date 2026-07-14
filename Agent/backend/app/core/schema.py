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

AGENT_RUN_COLUMNS = {
    "id": "VARCHAR(36) PRIMARY KEY",
    "created_at": "DATETIME",
    "updated_at": "DATETIME",
    "record_id": "VARCHAR(36)",
    "report_task_id": "VARCHAR(36)",
    "capability": "VARCHAR(80)",
    "provider": "VARCHAR(60) DEFAULT 'deterministic'",
    "model": "VARCHAR(120) DEFAULT 'rules-v1'",
    "status": "VARCHAR(30) DEFAULT 'completed'",
    "input_summary": "JSON DEFAULT '{}'",
    "output": "JSON DEFAULT '{}'",
    "evidence_refs": "JSON DEFAULT '[]'",
    "warnings": "JSON DEFAULT '[]'",
    "confidence": "FLOAT DEFAULT 0",
    "accepted": "BOOLEAN",
    "confirmed_by_id": "VARCHAR(36)",
    "confirmed_at": "DATETIME",
    "error": "TEXT",
}

TOWN_COLUMNS = {
    "chapter_code": "VARCHAR(40)",
    "assessment_targets": "JSON DEFAULT '[]'",
    "assessment_object": "JSON DEFAULT '{}'",
    "report_template": "JSON DEFAULT '{}'",
    "sort_order": "INTEGER DEFAULT 0",
    "is_active": "BOOLEAN DEFAULT 1",
}

VILLAGE_COLUMNS = {
    "administrative_village": "VARCHAR(160)",
    "chapter_code": "VARCHAR(60)",
    "assessment_object": "JSON DEFAULT '{}'",
    "report_template": "JSON DEFAULT '{}'",
    "sort_order": "INTEGER DEFAULT 0",
    "is_active": "BOOLEAN DEFAULT 1",
}

DEDUCTION_OPTION_COLUMNS = {
    "meta": "JSON DEFAULT '{}'",
}

ASSESSMENT_RECORD_COLUMNS = {
    "owner_user_id": "VARCHAR(36)",
}
USER_COLUMNS = {
    "password_hash": "TEXT",
    "failed_login_attempts": "INTEGER DEFAULT 0",
    "locked_until": "DATETIME",
    "last_login_at": "DATETIME",
    "password_changed_at": "DATETIME",
    "token_version": "INTEGER DEFAULT 0",
}


def _ensure_columns(table: str, columns: dict[str, str]) -> None:
    with engine.begin() as connection:
        existing = {row[1] for row in connection.execute(text(f"PRAGMA table_info({table})"))}
        for name, definition in columns.items():
            if name not in existing:
                connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {definition}"))


def _ensure_table(table: str, columns: dict[str, str]) -> None:
    column_sql = ", ".join(f"{name} {definition}" for name, definition in columns.items())
    with engine.begin() as connection:
        connection.execute(text(f"CREATE TABLE IF NOT EXISTS {table} ({column_sql})"))


def ensure_local_schema() -> None:
    if not settings.database_url.startswith("sqlite"):
        return
    _ensure_columns("report_tasks", REPORT_TASK_COLUMNS)
    _ensure_columns("reports", REPORT_COLUMNS)
    _ensure_columns("towns", TOWN_COLUMNS)
    _ensure_columns("villages", VILLAGE_COLUMNS)
    _ensure_columns("deduction_options", DEDUCTION_OPTION_COLUMNS)
    _ensure_columns("users", USER_COLUMNS)
    _ensure_columns("assessment_records", ASSESSMENT_RECORD_COLUMNS)
    _ensure_table("agent_runs", AGENT_RUN_COLUMNS)
