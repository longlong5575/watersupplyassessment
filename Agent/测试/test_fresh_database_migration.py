from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT.parent.parent / "运行脚本" / "watersupply-agent-runtime" / "test-results" / "fresh-migration"
DB_PATH = RESULTS / "fresh.db"
shutil.rmtree(RESULTS, ignore_errors=True)
RESULTS.mkdir(parents=True, exist_ok=True)
os.environ["APP_ENV"] = "local"
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["SECRET_KEY"] = "test-only-secret-key-that-is-long-enough-for-signing"
sys.path.insert(0, str(ROOT / "backend"))
os.chdir(ROOT / "backend")

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text


def main() -> None:
    config = Config(str(ROOT / "backend" / "alembic.ini"))
    command.upgrade(config, "head")
    engine = create_engine(os.environ["DATABASE_URL"])
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    required_tables = {"users", "assessment_records", "score_source_mappings", "alembic_version"}
    assert required_tables <= tables, required_tables - tables
    user_columns = {item["name"] for item in inspector.get_columns("users")}
    assert {"password_hash", "token_version", "locked_until"} <= user_columns
    record_columns = {item["name"] for item in inspector.get_columns("assessment_records")}
    assert "owner_user_id" in record_columns
    indexes = {item["name"] for item in inspector.get_indexes("assessment_records")}
    assert "ix_assessment_records_owner_user_id" in indexes
    with engine.connect() as connection:
        revision = connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
    assert revision == "20260713_record_owner_isolation", revision
    engine.dispose()
    DB_PATH.unlink(missing_ok=True)
    print("PASS: 全新数据库可一次迁移到当前版本")


if __name__ == "__main__":
    main()