from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT.parent.parent / "运行脚本" / "watersupply-agent-runtime" / "test-results" / "account-data-isolation"
RESULTS.mkdir(parents=True, exist_ok=True)
DB_PATH = RESULTS / "account-data-isolation.db"
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


def create_user(client: TestClient, admin_headers: dict[str, str], username: str) -> dict[str, str]:
    response = client.post("/api/auth/users", headers=admin_headers, json={"username": username, "displayName": username, "role": "inspector"})
    assert response.status_code == 201, response.text
    return login(client, username, response.json()["temporaryPassword"])


def assessment_payload(client: TestClient, headers: dict[str, str]) -> tuple[dict, dict]:
    projects = client.get("/api/mobile/projects", headers=headers).json()["items"]
    project = next(item for item in projects if item["name"] == "郁南项目")
    cycle = client.get("/api/mobile/assessment-cycles", headers=headers, params={"city_id": project["id"]}).json()["items"][0]
    towns = client.get("/api/mobile/towns", headers=headers, params={"city_id": project["id"]}).json()["items"]
    town = next(item for item in towns if "town_plant" in item["assessmentTargets"])
    standard_items = client.get("/api/mobile/indicator-standards", headers=headers, params={"city_id": project["id"], "cycle_id": cycle["id"], "facility_type": "town_plant"}).json()["items"]
    leaves = [item for item in standard_items if item["level"] == 3 and item["facilityType"] == "town_plant"]
    assert leaves
    return project, {
        "cityId": project["id"],
        "cycleId": cycle["id"],
        "city": project["name"],
        "period": cycle["name"],
        "town": town["name"],
        "villages": [{
            "village": "",
            "primaryFacilityType": "town_plant",
            "currentScore": 100,
            "entries": {item["id"]: {"itemId": item["id"], "done": True, "options": []} for item in leaves},
        }],
    }


def main() -> None:
    with TestClient(app) as client:
        admin_headers = login(client, "admin", "Admin@123456")
        account_a = create_user(client, admin_headers, "isolation-a")
        account_b = create_user(client, admin_headers, "isolation-b")
        project, payload = assessment_payload(client, admin_headers)

        created = client.post("/api/mobile/assessment-records", headers=account_a, json=payload)
        assert created.status_code == 200, created.text
        record_id = created.json()["recordIds"][0]
        submitted = client.post(f"/api/mobile/assessment-records/{record_id}/submit", headers=account_a)
        assert submitted.status_code == 200, submitted.text

        visible_to_a = client.get("/api/mobile/assessment-records", headers=account_a, params={"city_id": project["id"]})
        assert [item["id"] for item in visible_to_a.json()["items"]] == [record_id]

        visible_to_b = client.get("/api/mobile/assessment-records", headers=account_b, params={"city_id": project["id"]})
        assert visible_to_b.status_code == 200 and visible_to_b.json()["items"] == []
        assert client.post(f"/api/mobile/assessment-records/{record_id}/submit", headers=account_b).status_code == 404
        assert client.put(f"/api/mobile/assessment-records/{record_id}/scores", headers=account_b, json={"entries": {}}).status_code == 404
        cleared_by_b = client.delete("/api/mobile/assessment-records", headers=account_b, params={"city_id": project["id"], "cycle_id": payload["cycleId"]})
        assert cleared_by_b.status_code == 200 and cleared_by_b.json()["recordCount"] == 0

        assert client.get("/api/dashboard/towns", params={"city_id": project["id"]}).status_code == 401
        dashboard = client.get("/api/dashboard/towns", headers=admin_headers, params={"city_id": project["id"]})
        assert dashboard.status_code == 200
        records = client.get("/api/records", headers=admin_headers)
        assert record_id in {item["id"] for item in records.json()["items"]}


    print("PASS: 不同账号的考核数据已隔离，管理员可查看全量数据")


if __name__ == "__main__":
    main()
