from __future__ import annotations

import argparse
import json
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.services.project_catalog import MAONAN_TOWNS, YUNAN_TOWNS
from app.services.standard_catalog import load_standard_groups


FACILITY_LABELS = {
    "town_plant": ("污水处理厂", "水质净化厂"),
    "town_network": ("污水收集管网", "管网"),
    "rural_treatment": ("农村污水",),
}


def _normalize(value: Any) -> str:
    text = str(value or "").replace("（", "(").replace("）", ")")
    text = text.replace("状态", "状况").replace("台帐", "台账")
    text = text.replace("巡查开展工作", "巡查工作开展")
    return re.sub(r"[\s()、，,。；;：:/\\\-]+", "", text).lower()


def _deduction(value: Any) -> float:
    text = str(value or "").strip().replace("−", "-")
    match = re.fullmatch(r"-?\s*(\d+(?:\.\d+)?)", text)
    return float(match.group(1)) if match else 0.0


def _score(rows: list[list[str]]) -> float | None:
    for row in reversed(rows):
        text = " ".join(str(item or "") for item in row)
        if "评分" not in text and "考核得分" not in text:
            continue
        matches = re.findall(r"(?:换算百分制得|总体评分|考核得分|评分)\s*([0-9]+(?:\.[0-9]+)?)\s*分?", text)
        if matches:
            return float(matches[-1])
        numbers = re.findall(r"(?<![0-9.])([0-9]+(?:\.[0-9]+)?)(?![0-9.])", text)
        if numbers:
            return float(numbers[-1])
    return None


def _standard_items(project: str, facility_type: str) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for group in load_standard_groups(project).get(facility_type, []):
        for child in group.get("children", []):
            for item in child.get("items", []):
                result.append(item)
    return result


def _best_item(project: str, facility_type: str, source_name: str) -> tuple[dict[str, Any] | None, float]:
    normalized_source = _normalize(source_name)
    candidates = _standard_items(project, facility_type)
    exact = [item for item in candidates if _normalize(item.get("name")) == normalized_source]
    if exact:
        return exact[0], 1.0
    ranked = sorted(
        ((SequenceMatcher(None, normalized_source, _normalize(item.get("name"))).ratio(), item) for item in candidates),
        key=lambda pair: pair[0],
        reverse=True,
    )
    return (ranked[0][1], ranked[0][0]) if ranked else (None, 0.0)


def _facility_type(text: str) -> str | None:
    for facility_type, labels in FACILITY_LABELS.items():
        if any(label in text for label in labels):
            return facility_type
    return None


def _context(table: dict[str, Any]) -> str:
    return " > ".join(table.get("contextBefore") or [])


def _current_title(table: dict[str, Any]) -> str:
    context = table.get("contextBefore") or []
    return str(context[-1] if context else "")


def _known_name(text: str, names: list[str]) -> str | None:
    return next((name for name in sorted(names, key=len, reverse=True) if name in text), None)


def _point_to_town() -> dict[str, str]:
    return {
        village["name"]: town["name"]
        for town in YUNAN_TOWNS
        for village in town.get("villages", [])
    }


def _town_points(town_name: str) -> list[str]:
    town = next((item for item in YUNAN_TOWNS if item["name"] == town_name), None)
    return [item["name"] for item in (town or {}).get("villages", [])]


def _candidate_rows(table: dict[str, Any], facility_type: str) -> list[dict[str, Any]]:
    header = [str(item or "") for item in table.get("header") or []]
    deduction_index = next((index for index, value in enumerate(header) if "扣分" in value), None)
    if deduction_index is None:
        return []
    name_index = 2 if facility_type == "rural_treatment" or header[:2] == ["序号", "评价项目"] else 1
    result: list[dict[str, Any]] = []
    for source_row, row in enumerate((table.get("rows") or [])[1:], 2):
        if deduction_index >= len(row) or name_index >= len(row):
            continue
        value = _deduction(row[deduction_index])
        if value <= 0:
            continue
        name = str(row[name_index] or "").strip()
        if not name or "评分" in name or "合计" in name:
            continue
        reason_index = 5 if facility_type == "rural_treatment" else min(deduction_index + 1, len(row) - 1)
        result.append({
            "sourceRow": source_row,
            "sourceItem": name,
            "deduction": value,
            "reason": str(row[reason_index] or "").strip(),
        })
    return result


def _source_point(table: dict[str, Any], town: str, facility_type: str) -> str:
    if facility_type != "rural_treatment":
        return town
    title = _current_title(table)
    point = _known_name(title, _town_points(town))
    if not point and "宁波、井上村" in title:
        point = "井上村"
    if not point and "大坪村村" in title:
        point = "大坪村"
    return point or town


def _map_deductions(project: str, facility_type: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    mapped: list[dict[str, Any]] = []
    for row in rows:
        item, similarity = _best_item(project, facility_type, row["sourceItem"])
        if item is None:
            mapped.append({**row, "itemCode": None, "itemName": None, "itemFullScore": None, "similarity": 0, "mappingStatus": "needs_review"})
            continue
        source_key = _normalize(row["sourceItem"])
        candidates = [item]
        candidates.extend(
            candidate
            for candidate in _standard_items(project, facility_type)
            if candidate.get("id") != item.get("id") and _normalize(candidate.get("name")).startswith(source_key)
        )
        remaining = float(row["deduction"])
        for candidate in candidates:
            if remaining <= 0.0001:
                break
            full_score = float(candidate.get("maxScore") or 0)
            allocated = min(remaining, full_score)
            mapped.append({
                **row,
                "deduction": round(allocated, 4),
                "itemCode": candidate.get("id"),
                "itemName": candidate.get("name"),
                "itemFullScore": full_score,
                "similarity": round(similarity if candidate is item else 1.0, 4),
                "mappingStatus": "matched" if similarity >= 0.72 else "needs_review",
            })
            remaining = round(remaining - allocated, 4)
        if remaining > 0.0001:
            mapped.append({
                **row,
                "deduction": remaining,
                "itemCode": item.get("id"),
                "itemName": item.get("name"),
                "itemFullScore": float(item.get("maxScore") or 0),
                "similarity": round(similarity, 4),
                "mappingStatus": "needs_review",
            })
    return mapped


def build_yunan(data: dict[str, Any]) -> list[dict[str, Any]]:
    town_names = [item["name"] for item in YUNAN_TOWNS]
    point_to_town = _point_to_town()
    records: list[dict[str, Any]] = []
    current_town: str | None = None
    for table in data.get("tables", []):
        if int(table.get("index") or 0) < 66:
            continue
        header_text = "|".join(str(item or "") for item in table.get("header") or [])
        context_items = table.get("contextBefore") or []
        context = _context(table)
        title = _current_title(table)
        town = next((_known_name(item, town_names) for item in reversed(context_items) if _known_name(item, town_names)), None)
        point = _known_name(title, list(point_to_town))
        if point and not town:
            matching_towns = [
                item["name"]
                for item in YUNAN_TOWNS
                if any(village["name"] == point for village in item.get("villages", []))
            ]
            if len(matching_towns) == 1:
                town = matching_towns[0]
        current_town = town or current_town
        facility_type = _facility_type(title)
        detailed = "扣分" in header_text and (
            "指标分值" in header_text
            or ("评分依据" in header_text and "农村污水" in context)
        )
        if not detailed or not current_town or not facility_type:
            continue
        rows = _candidate_rows(table, facility_type)
        source_score = _score(table.get("rows") or [])
        deduction_total = round(sum(item["deduction"] for item in rows), 4)
        records.append({
            "project": "郁南项目",
            "projectKey": "yunan",
            "period": "2025年第2季度",
            "town": current_town,
            "point": _source_point(table, current_town, facility_type),
            "facilityType": facility_type,
            "sourceTableIndex": table["index"],
            "sourceScore": source_score,
            "sourceDeductionTotal": deduction_total,
            "currentRuleScore": round(max(0.0, 100.0 - deduction_total), 2),
            "deductions": _map_deductions("yunan", facility_type, rows),
        })
    unique: dict[tuple[str, str, str], dict[str, Any]] = {}
    for record in records:
        unique[(record["town"], record["point"], record["facilityType"])] = record
    return list(unique.values())


def build_maonan(data: dict[str, Any]) -> list[dict[str, Any]]:
    town_names = [item["name"] for item in MAONAN_TOWNS]
    records: list[dict[str, Any]] = []
    current_town: str | None = None
    for table in data.get("tables", []):
        index = int(table.get("index") or 0)
        if not 49 <= index <= 74:
            continue
        context_items = table.get("contextBefore") or []
        context = _context(table)
        title = _current_title(table)
        town = _known_name(title, town_names) or next(
            (_known_name(item, town_names) for item in reversed(context_items) if _known_name(item, town_names)),
            None,
        )
        current_town = town or current_town
        facility_type = _facility_type(title)
        if not current_town or not facility_type or "扣分" not in "|".join(table.get("header") or []):
            continue
        # 金塘镇配套管网尚未移交，例文附件虽保留评分草表，但汇总结果未纳入考核。
        if current_town == "金塘镇" and facility_type == "town_network":
            continue
        period = "2025年上半年度" if index <= 61 else "2025年下半年度"
        rows = _candidate_rows(table, facility_type)
        source_score = _score(table.get("rows") or [])
        deduction_total = round(sum(item["deduction"] for item in rows), 4)
        records.append({
            "project": "茂南项目",
            "projectKey": "maonan",
            "period": period,
            "town": current_town,
            "point": current_town,
            "facilityType": facility_type,
            "sourceTableIndex": index,
            "sourceScore": source_score,
            "sourceDeductionTotal": deduction_total,
            "currentRuleScore": round(max(0.0, 100.0 - deduction_total), 2),
            "deductions": _map_deductions("maonan", facility_type, rows),
        })
    return records


def _summary(records: list[dict[str, Any]]) -> dict[str, Any]:
    review = [
        {
            "project": record["project"],
            "period": record["period"],
            "town": record["town"],
            "point": record["point"],
            "facilityType": record["facilityType"],
            "sourceTableIndex": record["sourceTableIndex"],
            "sourceItem": item["sourceItem"],
            "mappedItem": item["itemName"],
            "similarity": item["similarity"],
        }
        for record in records
        for item in record["deductions"]
        if item["mappingStatus"] != "matched"
    ]
    by_period: dict[str, int] = {}
    for record in records:
        key = f"{record['project']}|{record['period']}"
        by_period[key] = by_period.get(key, 0) + 1
    return {
        "recordCount": len(records),
        "deductionCount": sum(len(item["deductions"]) for item in records),
        "byPeriod": by_period,
        "mappingReviewCount": len(review),
        "mappingReview": review,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    yunan = json.loads((args.source_dir / "yunan-full.json").read_text(encoding="utf-8"))
    maonan = json.loads((args.source_dir / "maonan-full.json").read_text(encoding="utf-8"))
    records = [*build_yunan(yunan), *build_maonan(maonan)]
    payload = {"records": records, "summary": _summary(records)}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({key: value for key, value in payload["summary"].items() if key != "mappingReview"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
