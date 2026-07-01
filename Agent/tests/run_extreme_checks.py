from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.core.database import Base, SessionLocal, engine
from app.main import app
from app.models import AssessmentRecord, AssessmentScore, Attachment, ReviewLog
from app.services.seed import seed_database


def ok(cases: list[dict[str, Any]], name: str, detail: Any = None) -> None:
    cases.append({"name": name, "status": "passed", "detail": detail})


def require(cases: list[dict[str, Any]], name: str, condition: bool, detail: Any = None) -> None:
    if not condition:
        cases.append({"name": name, "status": "failed", "detail": detail})
        raise AssertionError(f"{name}: {detail}")
    ok(cases, name, detail)


def login(client: TestClient, username: str) -> dict[str, str]:
    payload = client.post("/api/auth/login", json={"username": username}).json()
    return {"Authorization": f"Bearer {payload['token']}"}


def wait_task(client: TestClient, task_id: str) -> dict[str, Any]:
    task: dict[str, Any] = {}
    for _ in range(80):
        task = client.get(f"/api/report-tasks/{task_id}").json()
        if task["status"] in {"completed", "failed"}:
            break
        time.sleep(1)
    return task


def first_level3(items: list[dict[str, Any]], offset: int = 0) -> dict[str, Any]:
    level3 = [item for item in items if item["level"] == 3]
    return level3[offset % len(level3)]


def create_record(
    client: TestClient,
    headers: dict[str, str],
    city: dict[str, Any],
    cycle: dict[str, Any],
    town: dict[str, Any],
    indicator: dict[str, Any],
    *,
    facility_type: str,
    deduction: float,
    reason: str,
    village: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "cityId": city["id"],
        "cycleId": cycle["id"],
        "town": town["name"],
        "period": cycle["name"],
        "facilityName": f"{town['name']}-{facility_type}",
        "facilityType": facility_type,
        "entries": [{"indicatorId": indicator["id"], "deduction": deduction, "reason": reason}],
    }
    if village:
        payload["villageId"] = village["id"]
    response = client.post("/api/mobile/assessment-records", json=payload, headers=headers)
    require([], "create record response", response.status_code == 200, response.text)
    return response.json()


def main() -> None:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as session:
        seed_database(session)

    cases: list[dict[str, Any]] = []
    client = TestClient(app)
    admin_headers = login(client, "admin")
    inspector_headers = login(client, "inspector")

    health = client.get("/health")
    require(cases, "健康检查", health.status_code == 200 and health.json().get("status") == "ok", health.text)

    cities = client.get("/api/mobile/cities").json()["items"]
    city = next(item for item in cities if item["name"] == "江门市")
    cycle = client.get("/api/mobile/assessment-cycles", params={"city_id": city["id"]}).json()["items"][0]
    towns = client.get("/api/mobile/towns").json()["items"]
    town_names = ["北陡镇", "赤溪镇", "广海镇"]
    selected_towns = [next(item for item in towns if item["name"] == name) for name in town_names if any(t["name"] == name for t in towns)]
    require(cases, "多镇街基础数据", len(selected_towns) >= 3, selected_towns)

    standards = client.get(
        "/api/mobile/indicator-standards",
        params={"city_id": city["id"], "cycle_id": cycle["id"], "facility_type": "facility"},
    ).json()["items"]
    indicators = [first_level3(standards, offset) for offset in range(5)]
    require(cases, "评分标准不少于 5 个三级指标", len({item["id"] for item in indicators}) >= 5, indicators)

    unauth_create = client.post("/api/mobile/assessment-records", json={"town": selected_towns[0]["name"]})
    require(cases, "未登录移动端提交被拒绝", unauth_create.status_code == 401, unauth_create.text)
    inspector_review = client.post("/api/records/not-exists/review", headers=inspector_headers)
    require(cases, "移动端账号不能后台复核", inspector_review.status_code == 403, inspector_review.text)
    bad_town = client.post(
        "/api/mobile/assessment-records",
        json={"cityId": city["id"], "cycleId": cycle["id"], "town": "不存在镇街", "entries": []},
        headers=inspector_headers,
    )
    require(cases, "错误镇街提交返回 422", bad_town.status_code == 422, bad_town.text)

    villages_payload = client.get(f"/api/mobile/towns/{selected_towns[0]['id']}/villages").json()["items"][:3]
    package_payload = {
        "schemaVersion": "extreme-1",
        "exportedAt": "2026-06-26T00:00:00+08:00",
        "cityId": city["id"],
        "cycleId": cycle["id"],
        "town": selected_towns[0]["name"],
        "period": cycle["name"],
        "facilityType": "extreme-batch",
        "entries": [{"indicatorId": indicators[0]["id"], "deduction": 1, "reason": "批量村庄包"}],
        "villages": [
            {"villageId": village["id"], "facilityName": f"{village['name']}极端批量点"}
            for village in villages_payload
        ],
    }
    batch_created = client.post("/api/mobile/assessment-records", json=package_payload, headers=inspector_headers).json()
    batch_repeat = client.post("/api/mobile/assessment-records", json=package_payload, headers=inspector_headers).json()
    require(cases, "批量村庄包拆分记录", len(batch_created["recordIds"]) == len(villages_payload), batch_created)
    require(cases, "批量村庄包重复同步不新增记录", batch_repeat["recordIds"] == batch_created["recordIds"], batch_repeat)

    with SessionLocal() as session:
        batch_count = session.scalar(
            select(func.count(AssessmentRecord.id)).where(
                AssessmentRecord.town_id == selected_towns[0]["id"],
                AssessmentRecord.cycle_id == cycle["id"],
            )
        )
    require(cases, "数据库批量记录数正确", batch_count == len(villages_payload), batch_count)

    primary = create_record(
        client,
        inspector_headers,
        city,
        cycle,
        selected_towns[0],
        indicators[1],
        facility_type="extreme-lock",
        deduction=2,
        reason="锁定保护检查",
    )
    with SessionLocal() as session:
        score_id = session.scalar(select(AssessmentScore.id).where(AssessmentScore.record_id == primary["id"]))
    wrong_score_upload = client.post(
        f"/api/mobile/assessment-records/{primary['id']}/attachments",
        data={"score_id": "wrong-score-id"},
        files={"file": ("wrong.txt", b"wrong", "text/plain")},
        headers=inspector_headers,
    )
    require(cases, "附件绑定错误评分被拒绝", wrong_score_upload.status_code == 422, wrong_score_upload.text)
    good_upload = client.post(
        f"/api/mobile/assessment-records/{primary['id']}/attachments",
        data={"score_id": score_id},
        files={"file": ("evidence.txt", b"evidence", "text/plain")},
        headers=inspector_headers,
    )
    require(cases, "附件绑定正确评分成功", good_upload.status_code == 200, good_upload.text)
    client.post(f"/api/mobile/assessment-records/{primary['id']}/submit", headers=inspector_headers)
    client.post(f"/api/records/{primary['id']}/review", headers=admin_headers)
    client.post(f"/api/records/{primary['id']}/lock", headers=admin_headers)
    require(
        cases,
        "锁定后移动端评分修改被拒绝",
        client.put(f"/api/mobile/assessment-records/{primary['id']}/scores", json={"entries": []}, headers=inspector_headers).status_code == 409,
    )
    require(
        cases,
        "锁定后后台删除被拒绝",
        client.delete(f"/api/records/{primary['id']}", headers=admin_headers).status_code == 409,
    )

    missing_photo = create_record(
        client,
        inspector_headers,
        city,
        cycle,
        selected_towns[1],
        indicators[2],
        facility_type="extreme-missing-photo",
        deduction=4,
        reason="故意不传照片",
    )
    low_score = create_record(
        client,
        inspector_headers,
        city,
        cycle,
        selected_towns[2],
        indicators[3],
        facility_type="extreme-low-score",
        deduction=99,
        reason="低分风险",
    )
    for record in (missing_photo, low_score):
        client.post(f"/api/mobile/assessment-records/{record['id']}/submit", headers=inspector_headers)
    missing_photo_rows = client.get("/api/records", params={"town": selected_towns[1]["name"], "risk": "missing_photo"}).json()["items"]
    low_score_rows = client.get("/api/records", params={"town": selected_towns[2]["name"], "risk": "low_score"}).json()["items"]
    require(cases, "缺照片风险可筛出", any(item["id"] == missing_photo["id"] for item in missing_photo_rows), missing_photo_rows)
    require(cases, "低分风险可筛出", any(item["id"] == low_score["id"] for item in low_score_rows), low_score_rows)

    returned = client.post(f"/api/records/{missing_photo['id']}/return", json={"reason": "极端退回补证"}, headers=admin_headers)
    require(cases, "提交记录可退回", returned.status_code == 200 and returned.json()["status"] == "returned", returned.text)
    revised = client.post(
        "/api/mobile/assessment-records",
        json={
            "cityId": city["id"],
            "cycleId": cycle["id"],
            "town": selected_towns[1]["name"],
            "period": cycle["name"],
            "facilityName": "退回后重提",
            "facilityType": "extreme-missing-photo",
            "entries": [{"indicatorId": indicators[2]["id"], "deduction": 1, "reason": "退回补正"}],
        },
        headers=inspector_headers,
    ).json()
    require(cases, "退回后重复同步仍复用原记录", revised["id"] == missing_photo["id"], revised)
    resubmitted = client.post(f"/api/mobile/assessment-records/{missing_photo['id']}/submit", headers=inspector_headers)
    require(cases, "退回补正后可重新提交", resubmitted.status_code == 200 and resubmitted.json()["status"] == "submitted", resubmitted.text)

    for record_id in (missing_photo["id"], low_score["id"]):
        client.post(f"/api/records/{record_id}/review", headers=admin_headers)
    client.post(f"/api/records/{missing_photo['id']}/lock", headers=admin_headers)
    client.post(f"/api/records/{low_score['id']}/lock", headers=admin_headers)

    blocked = client.post(
        "/api/report-tasks",
        json={"period": cycle["name"], "townNames": ["白沙镇"], "outputs": ["town"], "source": "dashboard"},
        headers=admin_headers,
    )
    require(cases, "无复核数据镇街报告被拦截", blocked.status_code == 422, blocked.text)

    multi_report = client.post(
        "/api/report-tasks",
        json={"period": cycle["name"], "townNames": [item["name"] for item in selected_towns], "outputs": ["town", "summary"], "source": "dashboard"},
        headers=admin_headers,
    )
    require(cases, "多镇街报告任务创建成功", multi_report.status_code == 200, multi_report.text)
    task = wait_task(client, multi_report.json()["id"])
    require(cases, "多镇街报告任务完成", task.get("status") == "completed" and task.get("progress") == 100, task)
    require(cases, "报告任务固化数据快照", bool(task.get("datasetHash")) and bool(task.get("dataSnapshot", {}).get("recordIds")), task)
    require(cases, "多镇街报告至少生成两份", len(task.get("reports", [])) >= 2, task)
    require(
        cases,
        "报告记录包含版本和追溯范围",
        all(item.get("version", 0) >= 1 and item.get("datasetHash") == task.get("datasetHash") and item.get("recordIds") for item in task.get("reports", [])),
        task.get("reports", []),
    )
    task_agent = client.post(f"/api/agent/report-tasks/{task['id']}/analysis", headers=admin_headers)
    require(cases, "Agent 报告语义校验结构化输出", task_agent.status_code == 200 and bool(task_agent.json()["output"].get("semanticChecks")), task_agent.text)
    task_agent_payload = task_agent.json()
    require(
        cases,
        "Agent 不参与分数金额主链路",
        "不决定分数" in task_agent_payload["output"].get("boundaries", []) and "不决定金额" in task_agent_payload["output"].get("boundaries", []),
        task_agent_payload,
    )
    download_ok = 0
    preview_ok = 0
    for report in task.get("reports", []):
        response = client.get(f"/api/reports/{report['id']}/download")
        if response.status_code == 200 and len(response.content) > 1000:
            download_ok += 1
        preview = client.get(f"/api/reports/{report['id']}/preview")
        if preview.status_code == 200:
            content = preview.json().get("content", {})
            if content.get("paragraphCount", 0) > 0 and content.get("tableCount", 0) > 0:
                preview_ok += 1
    require(cases, "生成报告均可下载", download_ok == len(task.get("reports", [])), {"downloadOk": download_ok, "reports": len(task.get("reports", []))})
    require(cases, "reports can be previewed", preview_ok == len(task.get("reports", [])), {"previewOk": preview_ok, "reports": len(task.get("reports", []))})
    task_history = client.get("/api/report-tasks").json()["items"]
    require(cases, "报告任务历史列表可追溯", any(item["id"] == task["id"] and item.get("datasetHash") for item in task_history), task_history)

    dashboard = client.get("/api/dashboard/towns").json()
    selected_rows = [item for item in dashboard["items"] if item["name"] in {town["name"] for town in selected_towns}]
    require(cases, "后台看板包含多镇街同步结果", len(selected_rows) == len(selected_towns), selected_rows)

    with SessionLocal() as session:
        summary = {
            "records": session.scalar(select(func.count(AssessmentRecord.id))) or 0,
            "scores": session.scalar(select(func.count(AssessmentScore.id))) or 0,
            "attachments": session.scalar(select(func.count(Attachment.id))) or 0,
            "reviewLogs": session.scalar(select(func.count(ReviewLog.id))) or 0,
        }

    result = {
        "passed": all(item["status"] == "passed" for item in cases),
        "caseCount": len(cases),
        "reportTask": {
            "status": task.get("status"),
            "progress": task.get("progress"),
            "reports": len(task.get("reports", [])),
            "reportNames": [item.get("name") for item in task.get("reports", [])],
            "datasetHash": task.get("datasetHash"),
            "recordIds": task.get("dataSnapshot", {}).get("recordIds", []),
            "reportVersions": [item.get("version") for item in task.get("reports", [])],
        },
        "database": summary,
        "cases": cases,
    }
    output = Path(__file__).resolve().parent / "results" / "extreme-check-summary.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
