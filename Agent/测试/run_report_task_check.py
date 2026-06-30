from __future__ import annotations

import json
import time
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.database import Base, SessionLocal, engine
from app.main import app
from app.services.seed import seed_database


def main() -> None:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    session = SessionLocal()
    seed_database(session)
    session.close()

    client = TestClient(app)
    towns = client.get("/api/mobile/towns").json()["items"]
    cycles = client.get("/api/mobile/assessment-cycles").json()["items"]
    standards = client.get("/api/mobile/indicator-standards").json()["items"]
    town = "北陡镇" if any(item["name"] == "北陡镇" for item in towns) else towns[0]["name"]
    period = cycles[0]["name"] if cycles else "2023年下半年度"

    record = client.post(
        "/api/mobile/assessment-records",
        json={
            "town": town,
            "period": period,
            "facilityName": "数字格式复核点",
            "entries": [
                {
                    "indicatorId": standards[0]["id"] if standards else "auto",
                    "deduction": 1,
                    "reason": "数字格式复核",
                }
            ],
        },
    ).json()
    client.post(f"/api/mobile/assessment-records/{record['id']}/submit")
    client.post(f"/api/records/{record['id']}/review")
    client.post(f"/api/records/{record['id']}/lock")

    created = client.post(
        "/api/report-tasks",
        json={"period": period, "townNames": [town], "outputs": ["town"], "source": "dashboard"},
    ).json()

    task = None
    for _ in range(80):
        task = client.get(f"/api/report-tasks/{created['id']}").json()
        if task["status"] in {"completed", "failed"}:
            break
        time.sleep(1)

    result = {
        "town": town,
        "taskStatus": task["status"] if task else None,
        "progress": task["progress"] if task else None,
        "reports": len(task.get("reports", [])) if task else 0,
        "reportNames": [item.get("name") for item in task.get("reports", [])] if task else [],
        "error": task.get("error") if task else "missing task",
    }
    output = Path(__file__).resolve().parent / "结果" / "report-task-summary.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({"reportTask": result}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
