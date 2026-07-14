from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT.parent.parent / "运行脚本" / "watersupply-agent-runtime" / "test-results" / "auth-security"
RESULTS.mkdir(parents=True, exist_ok=True)
DB_PATH = RESULTS / "auth-security-test.db"
if DB_PATH.exists():
    DB_PATH.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["STORAGE_DIR"] = str((RESULTS / "storage").resolve())
os.environ["SECRET_KEY"] = "test-only-secret-key-that-is-long-enough-for-signing"
sys.path.insert(0, str(ROOT / "backend"))

from fastapi.testclient import TestClient
from app.main import app


def login(client: TestClient, username: str, password: str):
    return client.post("/api/auth/login", json={"username": username, "password": password})


def main() -> None:
    with TestClient(app) as client:
        assert login(client, "admin", "wrong-password").status_code == 401
        assert client.post("/api/auth/login", json={"username": "admin"}).status_code == 422
        admin_login = login(client, "admin", "Admin@123456")
        assert admin_login.status_code == 200
        admin_token = admin_login.json()["token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        created = client.post("/api/auth/users", headers=admin_headers, json={"username": "audit-user", "displayName": "审计用户", "role": "inspector"})
        assert created.status_code == 201, created.text
        temporary_password = created.json()["temporaryPassword"]
        assert len(temporary_password) == 8 and any(char.isalpha() for char in temporary_password) and any(char.isdigit() for char in temporary_password)
        user = created.json()["user"]
        user_login = login(client, "audit-user", temporary_password)
        assert user_login.status_code == 200
        user_headers = {"Authorization": f"Bearer {user_login.json()['token']}"}

        changed = client.post("/api/auth/change-password", headers=user_headers, json={"currentPassword": temporary_password, "newPassword": "x"})
        assert changed.status_code == 200, changed.text
        assert client.get("/api/auth/me", headers=user_headers).status_code == 401
        short_password_login = login(client, "audit-user", "x")
        assert short_password_login.status_code == 200
        short_password_headers = {"Authorization": f"Bearer {short_password_login.json()['token']}"}
        long_password = "长密码A1" * 300
        changed_to_long = client.post(
            "/api/auth/change-password",
            headers=short_password_headers,
            json={"currentPassword": "x", "newPassword": long_password},
        )
        assert changed_to_long.status_code == 200, changed_to_long.text
        assert login(client, "audit-user", long_password).status_code == 200

        reset = client.post(f"/api/auth/users/{user['id']}/reset-password", headers=admin_headers, json={})
        assert reset.status_code == 200, reset.text
        reset_password = reset.json()["temporaryPassword"]
        assert len(reset_password) == 8 and reset_password != temporary_password
        assert login(client, "audit-user", reset_password).status_code == 200
        assert client.put(f"/api/auth/users/{user['id']}", headers=admin_headers, json={"username": "cannot-change"}).status_code == 422
        users = client.get("/api/auth/users", headers=admin_headers).json()["items"]
        assert next(item for item in users if item["id"] == user["id"])["username"] == "audit-user"

    print("PASS: 账号密码存储、随机密码、令牌失效和管理员权限校验")


if __name__ == "__main__":
    main()
