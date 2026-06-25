from __future__ import annotations

import json
import time
from pathlib import Path

from fastapi.testclient import TestClient

from sqlalchemy import func, select

from app.core.database import Base, SessionLocal, engine
from app.main import app
from app.models import AssessmentRecord, AssessmentScore, Attachment, ReviewLog, SurveyRecord, WaterQualityRecord
from app.services.seed import seed_database


def main() -> None:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    session = SessionLocal()
    seed_database(session)
    session.close()

    client = TestClient(app)
    health = client.get("/health")
    assert health.status_code == 200 and health.json()["status"] == "ok", health.text
    admin_auth = client.post("/api/auth/login", json={"username": "admin"}).json()
    inspector_auth = client.post("/api/auth/login", json={"username": "inspector"}).json()
    admin_headers = {"Authorization": f"Bearer {admin_auth['token']}"}
    inspector_headers = {"Authorization": f"Bearer {inspector_auth['token']}"}
    cities = client.get("/api/mobile/cities").json()["items"]
    city = next(item for item in cities if item["name"] == "江门市")
    towns = client.get("/api/mobile/towns").json()["items"]
    cycles = client.get("/api/mobile/assessment-cycles", params={"city_id": city["id"]}).json()["items"]
    cycle = cycles[0]
    facility_standards_payload = client.get("/api/mobile/indicator-standards", params={"city_id": city["id"], "cycle_id": cycle["id"], "facility_type": "facility"}).json()
    network_standards_payload = client.get("/api/mobile/indicator-standards", params={"city_id": city["id"], "cycle_id": cycle["id"], "facility_type": "network"}).json()
    standard_versions = client.get("/api/indicator-versions", params={"city_id": city["id"], "cycle_id": cycle["id"]}).json()["items"]
    assert standard_versions and standard_versions[0]["indicatorCount"] > 20, standard_versions
    standard_detail = client.get(f"/api/indicator-versions/{standard_versions[0]['id']}").json()
    assert len([item for item in standard_detail["items"] if item["level"] == 3]) > 20, standard_detail
    cloned_standard = client.post(
        f"/api/indicator-versions/{standard_versions[0]['id']}/clone",
        json={"name": "自动化测试标准副本"},
    )
    assert cloned_standard.status_code == 200, cloned_standard.text
    locked_standard = client.post(f"/api/indicator-versions/{cloned_standard.json()['id']}/lock")
    assert locked_standard.status_code == 200 and locked_standard.json()["locked"], locked_standard.text
    facility_standards = facility_standards_payload["items"]
    network_standards = network_standards_payload["items"]
    facility_level3 = [item for item in facility_standards if item["level"] == 3]
    network_level3 = [item for item in network_standards if item["level"] == 3]
    assert facility_standards_payload["version"], facility_standards_payload
    assert network_standards_payload["version"], network_standards_payload
    assert len(facility_level3) > 20, facility_level3
    assert len(network_level3) > 10, network_level3
    assert round(sum(float(item["fullScore"]) for item in facility_level3), 2) == 100, facility_level3
    assert round(sum(float(item["fullScore"]) for item in network_level3), 2) == 100, network_level3
    sewage_collection = next(item for item in facility_level3 if item["name"] == "污水收集")
    assert float(sewage_collection["fullScore"]) == 5, sewage_collection
    score_indicator = next((item for item in facility_level3 if item.get("deductionOptions")), facility_level3[0])
    town = "北陡镇" if any(item["name"] == "北陡镇" for item in towns) else towns[0]["name"]
    town_id = next(item["id"] for item in towns if item["name"] == town)
    dashboard_by_city = client.get("/api/dashboard/towns", params={"city_id": city["id"]}).json()
    assert dashboard_by_city["overview"]["townCount"] >= 1, dashboard_by_city
    dashboard_by_town = client.get("/api/dashboard/towns", params={"city_id": city["id"], "town_id": town_id}).json()
    assert dashboard_by_town["overview"]["townCount"] == 1, dashboard_by_town
    draft_report_town = next((item["name"] for item in towns if item["name"] != town), None)
    period = cycle["name"]

    record_payload = {
        "cityId": city["id"],
        "cycleId": cycle["id"],
        "town": town,
        "period": period,
        "facilityName": "数字格式复核点",
        "facilityType": "treatment",
        "entries": [
            {
                "indicatorId": score_indicator["id"],
                "deduction": 1,
                "reason": "数字格式复核",
            }
        ],
    }
    record = client.post("/api/mobile/assessment-records", json=record_payload, headers=inspector_headers).json()
    assert record["cityId"] == city["id"], record
    assert record["cycleId"] == cycle["id"], record
    assert record["indicatorVersionId"] == facility_standards_payload["version"]["id"], record
    duplicate_record = client.post("/api/mobile/assessment-records", json=record_payload, headers=inspector_headers).json()
    assert duplicate_record["id"] == record["id"], duplicate_record
    session = SessionLocal()
    duplicate_count = session.scalar(
        select(func.count(AssessmentRecord.id)).where(
            AssessmentRecord.town_id == record["townId"],
            AssessmentRecord.cycle_id == record["cycleId"],
            AssessmentRecord.indicator_version_id == record["indicatorVersionId"],
        )
    )
    session.close()
    assert duplicate_count == 1, duplicate_count
    client.put(
        f"/api/mobile/assessment-records/{record['id']}/surveys",
        json={
            "sewage_collection_villager1": {"score": 4, "comment": "村民问卷1", "completed": True},
            "sewage_collection_villager2": {"score": 5, "comment": "村民问卷2", "completed": True},
            "sewage_collection_gov_rep": {"score": 4, "comment": "镇街代表", "completed": True},
            "sewage_collection_assessment_team": {"score": 3, "comment": "考核小组", "completed": True},
        },
        headers=inspector_headers,
    )
    client.put(
        f"/api/mobile/assessment-records/{record['id']}/water-quality",
        json={"sampleTime": "2026-06-25T00:00:00+08:00", "conclusion": "qualified", "completed": True},
        headers=inspector_headers,
    )
    session = SessionLocal()
    first_score_id = session.scalar(select(AssessmentScore.id).where(AssessmentScore.record_id == record["id"]))
    session.close()
    score_update = client.put(
        f"/api/records/{record['id']}/scores",
        json={
            "reason": "自动化复核测试",
            "scores": [{"id": first_score_id, "score": 18, "deduction": 2, "reason": "PC复核调整"}],
        },
        headers=admin_headers,
    )
    assert score_update.status_code == 200, score_update.text
    detail_after_score_update = client.get(f"/api/records/{record['id']}").json()
    score_update_log = next(item for item in detail_after_score_update["reviewLogs"] if item["action"] == "score_update")
    assert score_update_log["beforePayload"]["scores"], score_update_log
    assert score_update_log["afterPayload"]["scores"], score_update_log
    attachment = client.post(
        f"/api/mobile/assessment-records/{record['id']}/attachments",
        data={"score_id": first_score_id},
        files={"file": ("evidence.txt", b"test evidence", "text/plain")},
        headers=inspector_headers,
    )
    assert attachment.status_code == 200, attachment.text
    attachment_payload = attachment.json()
    attachment_download = client.get(f"/api/uploads/{attachment_payload['id']}/download")
    assert attachment_download.status_code == 200, attachment_download.text
    client.post(f"/api/mobile/assessment-records/{record['id']}/submit", headers=inspector_headers)
    submitted_records = client.get("/api/records", params={"status": "submitted", "town": town}).json()["items"]
    assert any(item["id"] == record["id"] for item in submitted_records), submitted_records
    record_detail = client.get(f"/api/records/{record['id']}").json()
    assert record_detail["cycleName"], record_detail
    assert record_detail["scores"][0].get("indicatorName") is not None, record_detail["scores"]
    client.post(f"/api/records/{record['id']}/review", headers=admin_headers)
    client.post(f"/api/records/{record['id']}/lock", headers=admin_headers)
    locked_score_update = client.put(
        f"/api/records/{record['id']}/scores",
        json={"scores": [{"id": first_score_id, "score": 16, "deduction": 4, "reason": "锁定后修改"}]},
        headers=admin_headers,
    )
    assert locked_score_update.status_code == 409, locked_score_update.text
    locked_return = client.post(f"/api/records/{record['id']}/return", json={"reason": "锁定后退回"}, headers=admin_headers)
    assert locked_return.status_code == 409, locked_return.text
    locked_submit = client.post(f"/api/mobile/assessment-records/{record['id']}/submit", headers=inspector_headers)
    assert locked_submit.status_code == 409, locked_submit.text
    locked_attachment = client.post(
        f"/api/mobile/assessment-records/{record['id']}/attachments",
        data={"score_id": first_score_id},
        files={"file": ("late-evidence.txt", b"late evidence", "text/plain")},
        headers=inspector_headers,
    )
    assert locked_attachment.status_code == 409, locked_attachment.text

    if draft_report_town:
        draft_payload = {
            "cityId": city["id"],
            "cycleId": cycle["id"],
            "town": draft_report_town,
            "period": period,
            "facilityName": "未复核报告拦截点",
            "facilityType": "treatment",
            "entries": [
                {
                    "indicatorId": score_indicator["id"],
                    "deduction": 3,
                    "reason": "缺照片统计测试",
                }
            ],
        }
        draft_record = client.post("/api/mobile/assessment-records", json=draft_payload, headers=inspector_headers).json()
        client.post(f"/api/mobile/assessment-records/{draft_record['id']}/submit", headers=inspector_headers)
        blocked_report = client.post(
            "/api/report-tasks",
            json={"period": period, "townNames": [draft_report_town], "outputs": ["town"], "source": "dashboard"},
            headers=admin_headers,
        )
        assert blocked_report.status_code == 422, blocked_report.text
        dashboard_towns = client.get("/api/dashboard/towns").json()["items"]
        draft_town_row = next(item for item in dashboard_towns if item["name"] == draft_report_town)
        assert draft_town_row["pendingReviewCount"] >= 1, draft_town_row
        assert draft_town_row["missingPhotoCount"] >= 1, draft_town_row
        missing_photo_records = client.get("/api/records", params={"town": draft_report_town, "risk": "missing_photo"}).json()["items"]
        assert any(item["id"] == draft_record["id"] for item in missing_photo_records), missing_photo_records
        returned = client.post(f"/api/records/{draft_record['id']}/return", json={"reason": "补充照片后重提"}, headers=admin_headers)
        assert returned.status_code == 200, returned.text
        returned_records = client.get("/api/records", params={"status": "returned", "town": draft_report_town}).json()["items"]
        assert any(item["id"] == draft_record["id"] for item in returned_records), returned_records
        returned_dashboard = client.get("/api/dashboard/towns").json()["items"]
        returned_town_row = next(item for item in returned_dashboard if item["name"] == draft_report_town)
        assert returned_town_row["returnedCount"] >= 1, returned_town_row
        revised_payload = {**draft_payload, "entries": [{**draft_payload["entries"][0], "deduction": 1, "reason": "退回后补充复核"}]}
        revised_record = client.post("/api/mobile/assessment-records", json=revised_payload, headers=inspector_headers).json()
        assert revised_record["id"] == draft_record["id"], revised_record
        resubmitted = client.post(f"/api/mobile/assessment-records/{draft_record['id']}/submit", headers=inspector_headers)
        assert resubmitted.status_code == 200, resubmitted.text
        resubmitted_records = client.get("/api/records", params={"status": "submitted", "town": draft_report_town}).json()["items"]
        assert any(item["id"] == draft_record["id"] for item in resubmitted_records), resubmitted_records

    session = SessionLocal()
    score_count = session.scalar(select(func.count(AssessmentScore.id)).where(AssessmentScore.record_id == record["id"])) or 0
    survey_count = session.scalar(select(func.count(SurveyRecord.id)).where(SurveyRecord.record_id == record["id"])) or 0
    water_quality_count = session.scalar(select(func.count(WaterQualityRecord.id)).where(WaterQualityRecord.record_id == record["id"])) or 0
    attachment_count = session.scalar(select(func.count(Attachment.id)).where(Attachment.record_id == record["id"])) or 0
    review_log_count = session.scalar(select(func.count(ReviewLog.id)).where(ReviewLog.record_id == record["id"])) or 0
    session.close()

    created = client.post(
        "/api/report-tasks",
        json={"period": period, "townNames": [town], "outputs": ["town"], "source": "dashboard"},
        headers=admin_headers,
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
        "scoreCount": score_count,
        "surveyCount": survey_count,
        "waterQualityCount": water_quality_count,
        "attachmentCount": attachment_count,
        "reviewLogCount": review_log_count,
        "error": task.get("error") if task else "missing task",
    }
    output = Path(__file__).resolve().parent / "results" / "report-task-summary.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({"reportTask": result}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
