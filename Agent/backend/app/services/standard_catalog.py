from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any


TREATMENT_MERGE_RULES = {
    "treatment_09": {"target_id": "treatment_08", "name": "稳定塘/生化工艺及其他处理工艺", "max_score": 15},
    "treatment_12": {"target_id": "treatment_11", "name": "污水收集管渠", "max_score": 8},
    "treatment_15": {"target_id": "treatment_14", "name": "机电设备、管路及附件", "max_score": 5},
}


def _standards_source_path() -> Path:
    return Path(__file__).resolve().parents[3] / "frontend" / "front-mobile" / "src" / "app" / "assessmentStandards.ts"


def _extract_export_array(text: str, name: str) -> list[dict[str, Any]]:
    marker = f"export const {name} = "
    start = text.index(marker) + len(marker)
    start = text.index("[", start)
    depth = 0
    in_string = False
    escaped = False
    for index in range(start, len(text)):
        char = text[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "[":
            depth += 1
        elif char == "]":
            depth -= 1
            if depth == 0:
                return json.loads(text[start : index + 1])
    raise ValueError(f"Cannot find export array {name}")


def _join_unique(values: list[str | None], separator: str = "\n") -> str:
    result: list[str] = []
    for value in values:
        if value and value.strip() and value not in result:
            result.append(value)
    return separator.join(result)


def _merge_items(groups: list[dict[str, Any]], rules: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    merged_groups = deepcopy(groups)
    for level1 in merged_groups:
        for level2 in level1.get("children", []):
            merged_items: list[dict[str, Any]] = []
            for item in level2.get("items", []):
                rule = rules.get(item.get("id"))
                if not rule:
                    merged_items.append(item)
                    continue
                target = next((existing for existing in merged_items if existing.get("id") == rule["target_id"]), None)
                if target is None:
                    item["id"] = rule["target_id"]
                    item["name"] = rule.get("name", item.get("name"))
                    item["maxScore"] = rule["max_score"]
                    merged_items.append(item)
                    continue
                target["name"] = rule.get("name", target.get("name"))
                target["maxScore"] = rule["max_score"]
                target["description"] = _join_unique([target.get("description"), item.get("description")], "；")
                target["evaluationStandard"] = _join_unique([target.get("evaluationStandard"), item.get("evaluationStandard")])
                target["standardText"] = _join_unique([target.get("standardText"), item.get("standardText")])
                target["scoringMethod"] = _join_unique([target.get("scoringMethod"), item.get("scoringMethod")], "、")
                target["dataSource"] = _join_unique([target.get("dataSource"), item.get("dataSource")], "、")
                target["options"] = [*target.get("options", []), *item.get("options", [])]
            level2["items"] = merged_items
    return merged_groups


def load_standard_groups() -> dict[str, list[dict[str, Any]]]:
    text = _standards_source_path().read_text(encoding="utf-8-sig")
    treatment = _merge_items(_extract_export_array(text, "TREATMENT_STANDARDS"), TREATMENT_MERGE_RULES)
    network = _extract_export_array(text, "NETWORK_STANDARDS")
    return {"facility": treatment, "network": network}


def item_score_total(groups: list[dict[str, Any]]) -> float:
    return sum(float(item.get("maxScore") or 0) for level1 in groups for level2 in level1.get("children", []) for item in level2.get("items", []))

