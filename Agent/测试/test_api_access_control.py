from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT.parent.parent / "运行脚本" / "watersupply-agent-runtime" / "test-results" / "api-access-control"
RESULTS.mkdir(parents=True, exist_ok=True)
DB_PATH = RESULTS / "api-access-control.db"
if DB_PATH.exists():
    DB_PATH.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["STORAGE_DIR"] = str((RESULTS / "storage").resolve())
os.environ["SECRET_KEY"] = "test-only-secret-key-that-is-long-enough-for-signing"
sys.path.insert(0, str(ROOT / "backend"))

from fastapi.testclient import TestClient
from app.main import app


def login(client: TestClient, username: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


def main() -> None:
    with TestClient(app) as client:
        admin_headers = login(client, "admin", "Admin@123456")
        assert client.get("/api/mobile/projects").status_code == 401
        inspector_headers = login(client, "inspector", "Inspector@123456")

        assert client.get("/api/indicator-versions").status_code == 401
        assert client.get("/api/indicator-versions", headers=inspector_headers).status_code == 403
        versions = client.get("/api/indicator-versions", headers=admin_headers)
        assert versions.status_code == 200, versions.text
        version_id = versions.json()["items"][0]["id"]

        assert client.get(f"/api/indicator-versions/{version_id}", headers=inspector_headers).status_code == 403
        assert client.patch(f"/api/indicator-versions/{version_id}", json={"items": []}).status_code == 401
        assert client.patch(
            f"/api/indicator-versions/{version_id}",
            headers=inspector_headers,
            json={"items": []},
        ).status_code == 403

        summary_payload = {"entries": {}, "waterQuality": {}, "surveyEntries": {}}
        assert client.post("/api/agent/summaries", json=summary_payload).status_code == 401
        assert client.post("/api/agent/summaries", headers=inspector_headers, json=summary_payload).status_code == 403
        assert client.post("/api/agent/summaries", headers=admin_headers, json=summary_payload).status_code == 200

        projects = client.get("/api/mobile/projects", headers=admin_headers)
        assert projects.status_code == 200, projects.text
        project_id = projects.json()["items"][0]["id"]
        no_period_data = client.post(
            "/api/report-tasks/precheck",
            headers=admin_headers,
            json={"source": "dashboard", "projectId": project_id, "period": "2029年第1季度", "outputs": ["summary"]},
        )
        assert no_period_data.status_code == 422
        assert "所选报告周期没有可用" in no_period_data.json()["detail"]
        unsupported_package = client.post(
            "/api/report-tasks/precheck",
            headers=admin_headers,
            json={"source": "upload", "projectId": project_id, "period": "2029年第1季度", "outputs": ["summary"]},
        )
        assert unsupported_package.status_code == 422
        assert "资料包自动识别尚未启用" in unsupported_package.json()["detail"]
        assert client.get("/api/reports/not-found/download").status_code == 401
        assert client.get("/api/reports/not-found/download", headers=inspector_headers).status_code == 403
        assert client.get("/api/reports/not-found/download", headers=admin_headers).status_code == 404
        assert client.post("/api/reports/not-found/open").status_code == 401
        assert client.post("/api/reports/not-found/open", headers=inspector_headers).status_code == 403
        assert client.post("/api/reports/not-found/open", headers=admin_headers).status_code == 404
        upload = {"file": ("权限测试.txt", b"test", "text/plain")}
        assert client.post("/api/uploads", headers=inspector_headers, files=upload).status_code == 403
        uploaded = client.post("/api/uploads", headers=admin_headers, files=upload)
        assert uploaded.status_code == 200, uploaded.text
        attachment_id = uploaded.json()["id"]
        assert client.get(f"/api/uploads/{attachment_id}/download", headers=inspector_headers).status_code == 404
        assert client.get(f"/api/uploads/{attachment_id}/download", headers=admin_headers).status_code == 200

    print("PASS: 标准管理、智能摘要和通用附件接口已限制管理员权限")


if __name__ == "__main__":
    main()
