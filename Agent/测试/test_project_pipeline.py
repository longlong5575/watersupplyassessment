from __future__ import annotations

import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
RESULTS = Path(__file__).resolve().parent / "结果"
RESULTS.mkdir(parents=True, exist_ok=True)
DB_PATH = RESULTS / "project-pipeline-test.db"
if DB_PATH.exists():
    DB_PATH.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["STORAGE_DIR"] = str((RESULTS / "storage").resolve())
os.environ["CELERY_TASK_ALWAYS_EAGER"] = "true"
sys.path.insert(0, str(BACKEND))

from docx import Document
from fastapi.testclient import TestClient

from app.main import app


def assert_ok(response, label: str):
    assert response.status_code < 300, f"{label}: {response.status_code} {response.text}"
    return response.json()


def login(client: TestClient, username: str) -> dict[str, str]:
    data = assert_ok(client.post("/api/auth/login", json={"username": username}), f"login {username}")
    return {"Authorization": f"Bearer {data['token']}"}


def leaf_standards(client: TestClient, project_id: str, cycle_id: str, facility_type: str):
    data = assert_ok(
        client.get("/api/mobile/indicator-standards", params={"city_id": project_id, "cycle_id": cycle_id, "facility_type": facility_type}),
        f"standards {facility_type}",
    )
    leaves = [item for item in data["items"] if item["level"] == 3]
    assert leaves and round(sum(float(item["fullScore"]) for item in leaves), 2) == 100
    return data, leaves


def create_record(client: TestClient, headers: dict[str, str], *, project, cycle, town, village, facility_type, indicator):
    option = indicator["deductionOptions"][0]
    payload = {
        "schemaVersion": "1.0",
        "cityId": project["id"],
        "cycleId": cycle["id"],
        "city": project["name"],
        "period": cycle["name"],
        "town": town,
        "villages": [{
            "village": village,
            "primaryFacilityType": facility_type,
            "currentScore": 0,
            "waterQuality": {
                "sampleTime": "2026-06-30T09:00:00",
                "dischargeStandard": "自动带出标准",
                "codValue": "39",
                "codLimit": "40",
                "nh3nValue": "4.8",
                "nh3nLimit": "5（8）",
                "tpValue": "0.4",
                "tpLimit": "0.5",
                "conclusion": "qualified",
                "completed": True,
            },
            "entries": {
                indicator["id"]: {
                    "itemId": indicator["id"],
                    "options": [
                        {"optionId": option["id"], "selection": "standard", "instances": 99, "note": "极端重复扣分"},
                        {"optionId": option["id"], "selection": "standard", "instances": 99, "note": "第二原因"},
                    ],
                }
            },
        }],
    }
    if facility_type == "rural_treatment":
        payload["villages"][0]["surveyEntries"] = {
            "satisfaction_villager1": {"score": 5, "comment": "满意", "completed": True},
            "sewage_collection_villager1": {"score": 4, "comment": "有改善", "completed": True},
        }
    created = assert_ok(client.post("/api/mobile/assessment-records", json=payload, headers=headers), "create assessment")
    record_id = created["recordIds"][0]
    assert_ok(client.post(f"/api/mobile/assessment-records/{record_id}/submit", headers=headers), "submit assessment")
    return record_id


def check_docx(path: Path, town: str, project_name: str):
    document = Document(path)
    text = "\n".join(paragraph.text for paragraph in document.paragraphs)
    table_text = "\n".join(cell.text for table in document.tables for row in table.rows for cell in row.cells)
    all_text = f"{text}\n{table_text}"
    assert town in all_text
    assert "考核对象" in all_text
    assert "考核结果" in all_text
    assert "附录A 水质评价限值" in all_text
    if project_name == "郁南项目":
        assert "镇村污水处理设施绩效考核报告" in all_text
        assert "问卷调查（村级考核有）" in all_text
        assert "农村污水处理设施" in all_text
        assert "DB44/2208-2019" in all_text
        assert "公众调查情况" in all_text
    if project_name == "茂南项目":
        assert "城镇设施绩效考核报告" in all_text
        assert "水质净化厂" in all_text
        assert "问卷调查（村级考核有）" not in all_text
    assert "证据附件目录" in all_text
    assert "Agent辅助校验" in all_text
    assert "fixture-photo.jpg" in all_text
    assert "已确认摘要" in all_text
    for table in document.tables:
        if not table.rows:
            continue
        headers = [cell.text.strip() for cell in table.rows[0].cells]
        if "序号" in headers:
            index = headers.index("序号")
            serials = [row.cells[index].text.strip() for row in table.rows[1:]]
            assert serials == [str(number) for number in range(1, len(serials) + 1)]


def main():
    with TestClient(app) as client:
        inspector = login(client, "inspector")
        admin = login(client, "admin")
        projects = assert_ok(client.get("/api/mobile/projects"), "projects")["items"]
        assert {item["name"] for item in projects} == {"郁南项目", "茂南项目"}
        by_name = {item["name"]: item for item in projects}

        yunan = by_name["郁南项目"]
        maonan = by_name["茂南项目"]
        yunan_cycle = assert_ok(client.get("/api/mobile/assessment-cycles", params={"city_id": yunan["id"]}), "yunan cycles")["items"][0]
        maonan_cycle = assert_ok(client.get("/api/mobile/assessment-cycles", params={"city_id": maonan["id"]}), "maonan cycles")["items"][0]

        yunan_towns = assert_ok(client.get("/api/mobile/towns", params={"city_id": yunan["id"]}), "yunan towns")["items"]
        maonan_towns = assert_ok(client.get("/api/mobile/towns", params={"city_id": maonan["id"]}), "maonan towns")["items"]
        assert len(yunan_towns) == 16 and len(maonan_towns) == 7
        yunan_by_name = {item["name"]: item for item in yunan_towns}
        maonan_by_name = {item["name"]: item for item in maonan_towns}
        assert yunan_by_name["桂圩镇"]["chapterCode"] == "2.3"
        assert set(yunan_by_name["桂圩镇"]["assessmentTargets"]) == {"town_plant", "town_network", "rural_treatment"}
        assert maonan_by_name["金塘镇"]["assessmentTargets"] == ["town_plant"]
        assert maonan_by_name["中科云粤西产业园"]["assessmentTargets"] == ["town_network"]

        village_total = 0
        for town in yunan_towns:
            villages = assert_ok(client.get(f"/api/mobile/towns/{town['id']}/villages"), f"villages {town['name']}")["items"]
            village_total += len(villages)
        assert village_total == 59
        guiwei_villages = assert_ok(client.get(f"/api/mobile/towns/{yunan_by_name['桂圩镇']['id']}/villages"), "guiwei villages")["items"]
        assert [(item["administrativeVillage"], item["name"]) for item in guiwei_villages] == [
            ("新塘村", "山禾地村"), ("䓣口村", "赤坭村"), ("䓣口村", "高寨村"), ("䓣口村", "平山村"), ("䓣口村", "道枝村")
        ]
        template = assert_ok(client.get(f"/api/mobile/projects/{yunan['id']}/report-template"), "project template")
        guiwei_template = next(item for item in template["towns"] if item["name"] == "桂圩镇")
        assert guiwei_template["reportTemplate"]["assessmentObjectSection"] == "2.3.1"

        standards = {}
        for project, cycle, types in [
            (yunan, yunan_cycle, ["town_plant", "town_network", "rural_treatment"]),
            (maonan, maonan_cycle, ["town_plant", "town_network"]),
        ]:
            for facility_type in types:
                standards[(project["name"], facility_type)] = leaf_standards(client, project["id"], cycle["id"], facility_type)
        unit_options = [
            option
            for _, leaves in standards.values()
            for item in leaves
            for option in item.get("deductionOptions") or []
            if option.get("unit")
        ]
        assert unit_options and all(option.get("maxInstances") for option in unit_options)
        split_option_items = [
            item
            for _, leaves in standards.values()
            for item in leaves
            if len(item.get("deductionOptions") or []) >= 2
        ]
        assert split_option_items
        split_options = split_option_items[0]["deductionOptions"]
        assert split_options[0]["name"].startswith("1. ")
        assert split_options[1]["name"].startswith("2. ")
        assert all(float(option["deduction"]) > 0 for option in split_options)

        invalid_payload = {"cityId": yunan["id"], "cycleId": yunan_cycle["id"], "town": "金塘镇", "primaryFacilityType": "town_plant"}
        invalid = client.post("/api/mobile/assessment-records", json=invalid_payload, headers=inspector)
        assert invalid.status_code == 422

        yunan_indicator = standards[("郁南项目", "rural_treatment")][1][0]
        maonan_indicator = standards[("茂南项目", "town_plant")][1][0]
        yunan_record = create_record(client, inspector, project=yunan, cycle=yunan_cycle, town="桂圩镇", village="山禾地村", facility_type="rural_treatment", indicator=yunan_indicator)
        maonan_record = create_record(client, inspector, project=maonan, cycle=maonan_cycle, town="金塘镇", village="", facility_type="town_plant", indicator=maonan_indicator)

        for record_id in [yunan_record, maonan_record]:
            detail = assert_ok(client.get(f"/api/records/{record_id}"), "record detail")
            assert len(detail["scores"]) >= 1
            manual_score = next(item for item in detail["scores"] if item["source"] == "manual")
            assert float(manual_score["deduction"]) <= float(manual_score["indicatorFullScore"])
            assert round(float(detail["totalScore"]), 2) == round(100 - float(manual_score["deduction"]), 2)
            upload = client.post(
                f"/api/mobile/assessment-records/{record_id}/attachments",
                headers=inspector,
                data={"score_id": manual_score["id"], "deduction_option_id": manual_score["deductionOptionId"] or ""},
                files={"file": ("fixture-photo.jpg", b"fake image bytes", "image/jpeg")},
            )
            assert_ok(upload, "upload attachment")
            assert_ok(client.post(f"/api/records/{record_id}/review", headers=admin), "review")
            blocked = client.post(f"/api/mobile/assessment-records/{record_id}/submit", headers=inspector)
            assert blocked.status_code == 409
            assert_ok(client.post(f"/api/records/{record_id}/return", headers=admin, json={"reason": "补充退回重提验证", "data": {}}), "return")
            assert_ok(client.post(f"/api/mobile/assessment-records/{record_id}/submit", headers=inspector), "resubmit returned")
            assert_ok(client.post(f"/api/records/{record_id}/review", headers=admin), "review after return")
            run = assert_ok(client.post(f"/api/agent/records/{record_id}/analysis", headers=admin), "agent record")
            assert run["output"]["evidenceRefs"]
            confirmed = assert_ok(client.post(f"/api/agent/runs/{run['id']}/confirm", headers=admin, json={"accepted": True}), "agent confirm")
            assert confirmed["accepted"] is True

        for project, cycle, town in [(yunan, yunan_cycle, "桂圩镇"), (maonan, maonan_cycle, "金塘镇")]:
            precheck = assert_ok(client.post("/api/report-tasks/precheck", headers=admin, json={
                "source": "dashboard", "projectId": project["id"], "period": cycle["name"], "townNames": [town], "outputs": ["separate", "summary"]
            }), f"report precheck {town}")
            assert precheck["ok"] is True
            assert precheck["summary"]["recordCount"] >= 1
            task = assert_ok(client.post("/api/report-tasks", headers=admin, json={
                "source": "dashboard", "projectId": project["id"], "period": cycle["name"], "townNames": [town], "outputs": ["separate", "summary"]
            }), f"report {town}")
            result = assert_ok(client.get(f"/api/report-tasks/{task['id']}"), f"report result {town}")
            assert result["status"] == "completed", result.get("error")
            assert result["dataSnapshot"]["towns"][0]["assessmentObject"]
            town_report = next(item for item in result["reports"] if item.get("town") == town)
            from app.core.database import SessionLocal
            from app.models import Report
            with SessionLocal() as session:
                path = Path(session.get(Report, town_report["id"]).storage_key)
            assert path.is_file() and path.stat().st_size > 10000
            check_docx(path, town, project["name"])
            preview = assert_ok(client.get(f"/api/reports/{town_report['id']}/preview"), f"report preview {town}")
            assert preview["content"]["paragraphCount"] > 0
            assert preview["content"]["tableCount"] > 0
            download = client.get(f"/api/reports/{town_report['id']}/download")
            assert download.status_code == 200 and len(download.content) > 10000

        dashboard = assert_ok(client.get("/api/dashboard/towns", params={"city_id": yunan["id"]}), "dashboard")
        assert any(item["name"] == "桂圩镇" and item["recordCount"] == 1 for item in dashboard["items"])
        print("PASS: two-project mobile -> dashboard -> review -> DOCX pipeline")


if __name__ == "__main__":
    main()
