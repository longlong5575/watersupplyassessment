from __future__ import annotations

import os
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"


def default_runtime_root() -> Path:
    if os.environ.get("WATERSUPPLY_RUNTIME_DIR"):
        return Path(os.environ["WATERSUPPLY_RUNTIME_DIR"])
    base = ROOT.parent.parent if ROOT.parent.name.lower() == "watersupplyassessment" else ROOT.parent
    return base / "运行脚本" / "watersupply-agent-runtime"


RESULTS = default_runtime_root() / "test-results" / "project-pipeline"
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


INDICATOR_GROUPS: dict[str, list[dict]] = {}


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


def record_payload(*, project, cycle, town, village, facility_type, indicator, note="极端重复扣分"):
    indicators = INDICATOR_GROUPS.get(indicator["id"], [indicator])
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
                item["id"]: {
                    "itemId": item["id"],
                    "done": True,
                    "options": ([
                        {"optionId": item["deductionOptions"][0]["id"], "selection": "standard", "instances": 99, "note": note},
                        {"optionId": item["deductionOptions"][0]["id"], "selection": "standard", "instances": 99, "note": "第二原因"},
                    ] if item.get("deductionOptions") else []),
                }
                for item in indicators
            },
        }],
    }
    if facility_type == "rural_treatment":
        payload["villages"][0]["surveyEntries"] = {
            "satisfaction_villager1": {"score": 5, "comment": "满意", "completed": True},
            "sewage_collection_villager1": {"score": 4, "comment": "有改善", "completed": True},
        }
    return payload


def complete_payload(*, project, cycle, town, village, facility_type, indicators):
    return {
        "schemaVersion": "1.0",
        "cityId": project["id"],
        "cycleId": cycle["id"],
        "city": project["name"],
        "period": cycle["name"],
        "town": town,
        "villages": [{
            "village": village,
            "primaryFacilityType": facility_type,
            "currentScore": 100,
            "entries": {
                item["id"]: {"itemId": item["id"], "done": True, "options": []}
                for item in indicators
            },
        }],
    }


def create_record(client: TestClient, headers: dict[str, str], *, project, cycle, town, village, facility_type, indicator):
    payload = record_payload(project=project, cycle=cycle, town=town, village=village, facility_type=facility_type, indicator=indicator)
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
        assert "公众调查分析" in all_text
    if project_name == "茂南项目":
        assert "城镇设施绩效考核报告" in all_text
        assert "水质净化厂" in all_text
        assert "问卷调查（村级考核有）" not in all_text
    assert "证据附件目录" in all_text
    assert "考核实施情况" in all_text
    assert "综合评价" in all_text
    assert "主要问题及扣分分析" in all_text
    assert "fixture-photo.jpg" in all_text
    assert "Agent辅助校验" not in all_text
    assert "系统采集" not in all_text
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
        assert sum(len(item["assessmentTargets"]) for item in maonan_towns) == 12

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

        for _, leaves in standards.values():
            option_names = [option["name"] for item in leaves for option in item.get("deductionOptions", [])]
            assert not any("检查单元" in name or "抽查5个井段" in name for name in option_names), "抽检规则不应成为扣分选项"
        maonan_network = standards[("茂南项目", "town_network")][1]
        overflow_item = next(item for item in maonan_network if "无污水冒出" in item["name"])
        overflow_options = [option["name"] for option in overflow_item["deductionOptions"]]
        assert overflow_options == ["发现管道（渠箱）有污水冒出，每处扣0.2分"], overflow_options
        unit_options = [
            option
            for _, leaves in standards.values()
            for item in leaves
            for option in item.get("deductionOptions") or []
            if option.get("unit")
        ]
        assert unit_options and all(option.get("maxInstances") for option in unit_options)
        all_options = [
            option
            for _, leaves in standards.values()
            for item in leaves
            for option in item.get("deductionOptions") or []
        ]
        assert all(option.get("name", "").strip() and float(option.get("deduction") or 0) > 0 for option in all_options)
        count_markers = re.compile(r"每(?:缺少|发现|出现|增加|有|个|一|处|项|次|座|人|岗位)")
        count_options = [option for option in all_options if count_markers.search(option["name"])]
        assert count_options and all(option.get("unit") and option.get("maxInstances") for option in count_options)
        for project_name in ("郁南项目", "茂南项目"):
            plant_items = standards[(project_name, "town_plant")][1]
            water_quality = next(item for item in plant_items if item["name"] == "污水处理质量")
            full_score = float(water_quality["fullScore"])
            assert any(
                "判定为不合格扣" in option["name"] and float(option["deduction"]) == full_score
                for option in water_quality["deductionOptions"]
            )
        split_option_items = [
            item
            for _, leaves in standards.values()
            for item in leaves
            if len(item.get("deductionOptions") or []) >= 2
        ]
        assert split_option_items
        split_options = split_option_items[0]["deductionOptions"]
        assert all(not re.match(r"^\d+\.\s", option["name"]) for option in split_options)
        assert all(float(option["deduction"]) > 0 for option in split_options)
        for _, leaves in standards.values():
            for leaf in leaves:
                INDICATOR_GROUPS[leaf["id"]] = leaves

        # Scoring stress cases: full score, capped legacy input, capped counts,
        # water-quality full deduction, survey replacement, and review overrides.
        stress_towns = [town for town in yunan_towns if "town_plant" in town["assessmentTargets"]]
        assert len(stress_towns) >= 4
        plant_leaves = standards[("郁南项目", "town_plant")][1]

        full_payload = complete_payload(
            project=yunan, cycle=yunan_cycle, town=stress_towns[0]["name"], village="",
            facility_type="town_plant", indicators=plant_leaves,
        )
        full_created = assert_ok(client.post("/api/mobile/assessment-records", json=full_payload, headers=inspector), "full-score assessment")
        full_detail = assert_ok(client.get(f"/api/records/{full_created['recordIds'][0]}"), "full-score detail")
        assert float(full_detail["totalScore"]) == 100
        assert all(float(item["deduction"]) == 0 for item in full_detail["scores"])

        legacy_payload = complete_payload(
            project=yunan, cycle=yunan_cycle, town=stress_towns[1]["name"], village="",
            facility_type="town_plant", indicators=plant_leaves,
        )
        legacy_indicator = plant_leaves[0]
        legacy_payload["villages"][0]["entries"][legacy_indicator["id"]]["deduction"] = 999999
        legacy_created = assert_ok(client.post("/api/mobile/assessment-records", json=legacy_payload, headers=inspector), "legacy overflow assessment")
        legacy_detail = assert_ok(client.get(f"/api/records/{legacy_created['recordIds'][0]}"), "legacy overflow detail")
        legacy_score = next(item for item in legacy_detail["scores"] if item["indicatorId"] == legacy_indicator["id"])
        assert float(legacy_score["deduction"]) == float(legacy_indicator["fullScore"])
        assert float(legacy_score["score"]) == 0
        assert float(legacy_detail["totalScore"]) == 100 - float(legacy_indicator["fullScore"])

        count_indicator = next(
            item for item in plant_leaves
            if any(option.get("unit") and option.get("maxInstances") for option in item.get("deductionOptions") or [])
        )
        count_option = next(option for option in count_indicator["deductionOptions"] if option.get("unit") and option.get("maxInstances"))
        count_payload = complete_payload(
            project=yunan, cycle=yunan_cycle, town=stress_towns[2]["name"], village="",
            facility_type="town_plant", indicators=plant_leaves,
        )
        count_payload["villages"][0]["entries"][count_indicator["id"]]["options"] = [{
            "optionId": count_option["id"], "selection": "standard",
            "instances": int(count_option["maxInstances"]) + 1000, "note": "超量项数封顶验证",
        }]
        count_created = assert_ok(client.post("/api/mobile/assessment-records", json=count_payload, headers=inspector), "count overflow assessment")
        count_detail = assert_ok(client.get(f"/api/records/{count_created['recordIds'][0]}"), "count overflow detail")
        count_score = next(item for item in count_detail["scores"] if item["indicatorId"] == count_indicator["id"])
        expected_count_deduction = min(
            float(count_indicator["fullScore"]),
            float(count_option["deduction"]) * int(count_option["maxInstances"]),
        )
        assert float(count_score["deduction"]) == expected_count_deduction
        adjusted_payload = complete_payload(
            project=yunan, cycle=yunan_cycle, town=stress_towns[2]["name"], village="",
            facility_type="town_plant", indicators=plant_leaves,
        )
        adjusted_payload["villages"][0]["entries"][count_indicator["id"]]["options"] = [{
            "optionId": count_option["id"], "selection": "standard", "instances": 999,
            "adjustedScore": 0.7, "note": "调整值应直接覆盖标准扣分",
        }]
        adjusted_created = assert_ok(client.post("/api/mobile/assessment-records", json=adjusted_payload, headers=inspector), "adjusted score assessment")
        assert adjusted_created["recordIds"] == count_created["recordIds"]
        adjusted_detail = assert_ok(client.get(f"/api/records/{adjusted_created['recordIds'][0]}"), "adjusted score detail")
        adjusted_score = next(item for item in adjusted_detail["scores"] if item["indicatorId"] == count_indicator["id"])
        assert float(adjusted_score["deduction"]) == 0.7

        water_indicator = next(item for item in plant_leaves if item["name"] == "污水处理质量")
        water_option = next(option for option in water_indicator["deductionOptions"] if float(option["deduction"]) == float(water_indicator["fullScore"]))
        water_payload = complete_payload(
            project=yunan, cycle=yunan_cycle, town=stress_towns[3]["name"], village="",
            facility_type="town_plant", indicators=plant_leaves,
        )
        water_payload["villages"][0]["waterQuality"] = {
            "sampleTime": "2026-06-30T23:59:59", "codValue": "9999", "codLimit": "40",
            "nh3nValue": "9999", "nh3nLimit": "5", "tpValue": "9999", "tpLimit": "0.5",
            "conclusion": "unqualified", "completed": True,
        }
        water_payload["villages"][0]["entries"][water_indicator["id"]]["options"] = [{
            "optionId": water_option["id"], "selection": "standard", "instances": 1,
            "note": "水质不合格判定：极端超限",
        }]
        water_created = assert_ok(client.post("/api/mobile/assessment-records", json=water_payload, headers=inspector), "water-quality assessment")
        water_detail = assert_ok(client.get(f"/api/records/{water_created['recordIds'][0]}"), "water-quality detail")
        water_score = next(item for item in water_detail["scores"] if item["indicatorId"] == water_indicator["id"])
        assert float(water_score["deduction"]) == float(water_indicator["fullScore"])
        assert float(water_detail["totalScore"]) == 100 - float(water_indicator["fullScore"])

        review_score_id = legacy_score["id"]
        reviewed_scores = assert_ok(client.put(
            f"/api/records/{legacy_created['recordIds'][0]}/scores", headers=admin,
            json={"scores": [{"id": review_score_id, "deduction": 999999, "reason": "后台极端改分"}], "reason": "封顶验证"},
        ), "review score cap")
        reviewed_item = next(item for item in reviewed_scores["scores"] if item["id"] == review_score_id)
        assert float(reviewed_item["deduction"]) == float(reviewed_item["indicatorFullScore"])
        assert float(reviewed_item["score"]) == 0
        assert 0 <= float(reviewed_scores["totalScore"]) <= 100

        rural_town = next(town for town in yunan_towns if town["name"] != "桂圩镇" and "rural_treatment" in town["assessmentTargets"])
        rural_villages = assert_ok(client.get(f"/api/mobile/towns/{rural_town['id']}/villages"), "stress rural villages")["items"]
        assert rural_villages
        rural_leaves = standards[("郁南项目", "rural_treatment")][1]
        survey_payload = complete_payload(
            project=yunan, cycle=yunan_cycle, town=rural_town["name"], village=rural_villages[0]["name"],
            facility_type="rural_treatment", indicators=rural_leaves,
        )
        survey_payload["villages"][0]["surveyEntries"] = {
            f"{category}_{respondent}": {"score": score, "comment": "极端问卷回填", "completed": True}
            for category, respondents, score in [
                ("sewage_collection", ["villager1", "villager2", "gov_rep", "assessment_team"], 1),
                ("overall_effect", ["villager1", "villager2", "gov_rep", "assessment_team"], 3),
                ("satisfaction", ["villager1", "villager2", "gov_rep", "implementation_org"], 5),
            ]
            for respondent in respondents
        }
        survey_created = assert_ok(client.post("/api/mobile/assessment-records", json=survey_payload, headers=inspector), "survey backfill assessment")
        survey_detail = assert_ok(client.get(f"/api/records/{survey_created['recordIds'][0]}"), "survey backfill detail")
        indicator_ids = [item["indicatorId"] for item in survey_detail["scores"]]
        assert len(indicator_ids) == len(set(indicator_ids)), "问卷回填后不应重复生成同一评分点"
        assert set(indicator_ids) == {item["id"] for item in rural_leaves}, "问卷评分不得串用其他项目或考核对象的指标"
        assert round(float(survey_detail["totalScore"]), 2) == round(sum(float(item["score"]) for item in survey_detail["scores"]), 2)
        assert 0 < float(survey_detail["totalScore"]) < 100
        survey_total = float(survey_detail["totalScore"])
        entries_only_update = assert_ok(client.put(
            f"/api/records/{survey_created['recordIds'][0]}", headers=admin,
            json={"data": {"entries": survey_payload["villages"][0]["entries"]}, "reason": "仅更新评分明细"},
        ), "preserve survey scores after entries update")
        assert any(item["source"] == "survey" for item in entries_only_update["scores"])
        assert round(float(entries_only_update["totalScore"]), 2) == round(survey_total, 2)
        cleared_surveys = assert_ok(client.put(
            f"/api/mobile/assessment-records/{survey_created['recordIds'][0]}/surveys", headers=inspector, json={},
        ), "clear survey scores")
        cleared_detail = assert_ok(client.get(f"/api/records/{survey_created['recordIds'][0]}"), "cleared survey detail")
        assert not any(item["source"] == "survey" for item in cleared_detail["scores"])
        assert {item["indicatorId"] for item in cleared_detail["scores"]} == {item["id"] for item in rural_leaves}
        assert float(cleared_surveys["totalScore"]) == 100

        cleared_scores = assert_ok(client.put(
            f"/api/mobile/assessment-records/{full_created['recordIds'][0]}/scores", headers=inspector, json={"entries": {}},
        ), "clear score entries")
        assert float(cleared_scores["totalScore"]) == 0

        invalid_payload = {"cityId": yunan["id"], "cycleId": yunan_cycle["id"], "town": "金塘镇", "primaryFacilityType": "town_plant"}
        invalid = client.post("/api/mobile/assessment-records", json=invalid_payload, headers=inspector)
        assert invalid.status_code == 422

        yunan_indicator = standards[("郁南项目", "rural_treatment")][1][0]
        maonan_indicator = standards[("茂南项目", "town_plant")][1][0]
        maonan_network_indicator = standards[("茂南项目", "town_network")][1][0]
        yunan_record = create_record(client, inspector, project=yunan, cycle=yunan_cycle, town="桂圩镇", village="山禾地村", facility_type="rural_treatment", indicator=yunan_indicator)
        maonan_record = create_record(client, inspector, project=maonan, cycle=maonan_cycle, town="金塘镇", village="", facility_type="town_plant", indicator=maonan_indicator)

        incomplete_payload = record_payload(project=maonan, cycle=maonan_cycle, town="山阁镇", village="", facility_type="town_plant", indicator=maonan_indicator)
        incomplete_payload["villages"][0]["entries"][maonan_indicator["id"]]["done"] = False
        incomplete_created = assert_ok(client.post("/api/mobile/assessment-records", json=incomplete_payload, headers=inspector), "create incomplete assessment")
        incomplete_submit = client.post(f"/api/mobile/assessment-records/{incomplete_created['recordIds'][0]}/submit", headers=inspector)
        assert incomplete_submit.status_code == 409

        # A fresh browser/device must recover all submitted targets from the backend.
        maonan_plant = create_record(client, inspector, project=maonan, cycle=maonan_cycle, town="茂南区", village="", facility_type="town_plant", indicator=maonan_indicator)
        maonan_network = create_record(client, inspector, project=maonan, cycle=maonan_cycle, town="茂南区", village="", facility_type="town_network", indicator=maonan_network_indicator)
        restored = assert_ok(client.get("/api/mobile/assessment-records", headers=inspector, params={"city_id": maonan["id"], "cycle_id": maonan_cycle["id"]}), "restore mobile records")["items"]
        restored_maonan = [item for item in restored if item["town"] == "茂南区"]
        assert {item["raw"]["primaryFacilityType"] for item in restored_maonan} == {"town_plant", "town_network"}
        assert all(item["editable"] is True for item in restored_maonan)

        # Re-submitting an editable target updates the same record instead of creating a duplicate.
        updated_payload = record_payload(project=maonan, cycle=maonan_cycle, town="茂南区", village="", facility_type="town_plant", indicator=maonan_indicator, note="修改后再次同步")
        updated = assert_ok(client.post("/api/mobile/assessment-records", json=updated_payload, headers=inspector), "update existing assessment")
        assert updated["recordIds"] == [maonan_plant]
        restored_after_update = assert_ok(client.get("/api/mobile/assessment-records", headers=inspector, params={"city_id": maonan["id"], "cycle_id": maonan_cycle["id"]}), "restore updated records")["items"]
        assert len([item for item in restored_after_update if item["town"] == "茂南区"]) == 2

        # Locked records remain visible on mobile but cannot be edited or submitted again.
        assert_ok(client.post(f"/api/records/{maonan_network}/review", headers=admin), "review network")
        reviewed_items = assert_ok(client.get("/api/mobile/assessment-records", headers=inspector, params={"city_id": maonan["id"], "cycle_id": maonan_cycle["id"]}), "restore reviewed records")["items"]
        reviewed_network = next(item for item in reviewed_items if item["id"] == maonan_network)
        assert reviewed_network["status"] == "reviewed" and reviewed_network["editable"] is False
        assert_ok(client.post(f"/api/records/{maonan_network}/lock", headers=admin), "lock network")
        locked_items = assert_ok(client.get("/api/mobile/assessment-records", headers=inspector, params={"city_id": maonan["id"], "cycle_id": maonan_cycle["id"]}), "restore locked records")["items"]
        locked_network = next(item for item in locked_items if item["id"] == maonan_network)
        assert locked_network["status"] == "locked" and locked_network["editable"] is False
        locked_update = client.post("/api/mobile/assessment-records", json=record_payload(project=maonan, cycle=maonan_cycle, town="茂南区", village="", facility_type="town_network", indicator=maonan_network_indicator), headers=inspector)
        assert locked_update.status_code == 422

        for record_id in [yunan_record, maonan_record]:
            detail = assert_ok(client.get(f"/api/records/{record_id}"), "record detail")
            assert len(detail["scores"]) >= 1
            manual_score = next(item for item in detail["scores"] if item["source"] == "manual")
            assert float(manual_score["deduction"]) <= float(manual_score["indicatorFullScore"])
            total_deduction = sum(float(item["deduction"]) for item in detail["scores"])
            assert round(float(detail["totalScore"]), 2) == round(max(100 - total_deduction, 0), 2)
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
            returned_items = assert_ok(client.get("/api/mobile/assessment-records", headers=inspector), "restore returned record")["items"]
            returned_record = next(item for item in returned_items if item["id"] == record_id)
            assert returned_record["status"] == "returned" and returned_record["editable"] is True
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
        assert any(item["name"] == "桂圩镇" and item["recordCount"] >= 1 for item in dashboard["items"])
        maonan_dashboard = assert_ok(client.get("/api/dashboard/towns", params={"city_id": maonan["id"]}), "maonan dashboard")
        assert maonan_dashboard["overview"]["villageCount"] == 12
        print("PASS: two-project mobile -> dashboard -> review -> DOCX pipeline")


if __name__ == "__main__":
    main()
