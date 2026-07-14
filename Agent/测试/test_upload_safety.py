from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT.parent.parent / "运行脚本" / "watersupply-agent-runtime" / "test-results" / "upload-safety"
RESULTS.mkdir(parents=True, exist_ok=True)
DB_PATH = RESULTS / "upload-safety.db"
if DB_PATH.exists():
    DB_PATH.unlink()
STORAGE = (RESULTS / "storage").resolve()
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["STORAGE_DIR"] = str(STORAGE)
os.environ["SECRET_KEY"] = "test-only-secret-key-that-is-long-enough-for-signing"
os.environ["MAX_UPLOAD_SIZE_MB"] = "1"
sys.path.insert(0, str(ROOT / "backend"))

from fastapi.testclient import TestClient
from app.core.database import SessionLocal
from app.main import app
from app.models import Attachment


def main() -> None:
    with TestClient(app) as client:
        login = client.post("/api/auth/login", json={"username": "admin", "password": "Admin@123456"})
        assert login.status_code == 200, login.text
        headers = {"Authorization": f"Bearer {login.json()['token']}"}

        uploaded = client.post(
            "/api/uploads",
            headers=headers,
            files={"file": ("../../越界文件.txt", b"safe", "text/plain")},
        )
        assert uploaded.status_code == 200, uploaded.text
        with SessionLocal() as session:
            attachment = session.get(Attachment, uploaded.json()["id"])
            stored = Path(attachment.storage_key).resolve()
        stored.relative_to(STORAGE)
        assert stored.name == "越界文件.txt"
        assert stored.read_bytes() == b"safe"

        oversized = client.post(
            "/api/uploads",
            headers=headers,
            files={"file": ("过大文件.bin", b"x" * (1024 * 1024 + 1), "application/octet-stream")},
        )
        assert oversized.status_code == 413
        assert "不能超过1MB" in oversized.json()["detail"]
        assert not list(STORAGE.rglob("过大文件.bin"))

    print("PASS: 上传文件名已净化，超限文件会被拒绝且不留残片")


if __name__ == "__main__":
    main()