from __future__ import annotations

import json
import math
import re
from copy import deepcopy
from pathlib import Path
from typing import Any


def _standards_json_path() -> Path:
    return Path(__file__).resolve().parents[1] / "data" / "project_standards.json"


def _is_knowledge_only_option(option: dict[str, Any]) -> bool:
    reason = str(option.get("reason") or "")
    return any(
        marker in reason
        for marker in (
            "检查单元",
            "抽查5个井段",
            "最多扣",
            "合并入管道检查评分项目",
            "根据随机抽查的维护作业现场情况进行综合打分",
            "设施半年累计负荷率小于70%时",
            "得分=10×（半年累计负荷/70%）",
        )
    )


def _infer_count_unit(reason: str) -> str | None:
    patterns = (
        (r"每(?:增加)?\s*1?\s*天", "天"),
        (r"每(?:一|发现1|发现一)?\s*处", "处"),
        (r"每(?:缺少)?\s*1?\s*项/次", "项/次"),
        (r"每(?:缺少|发现|出现|有)?\s*(?:1|一)?\s*项", "项"),
        (r"每(?:缺少)?\s*(?:1|一)?\s*类", "类"),
        (r"每(?:出现)?\s*(?:1|一)?\s*次", "次"),
        (r"每(?:缺少)?\s*1?\s*人", "人"),
        (r"每(?:一个|一)?\s*岗位", "岗位"),
        (r"每(?:有)?\s*(?:一|1)?\s*座", "座"),
        (r"每个问题", "个"),
    )
    return next((unit for pattern, unit in patterns if re.search(pattern, reason)), None)


def _clean_option(item: dict[str, Any], option: dict[str, Any]) -> dict[str, Any]:
    cleaned = deepcopy(option)
    cleaned["reason"] = re.sub(r"^\s*\d+\.\s*", "", str(cleaned.get("reason") or ""))
    unit = cleaned.get("unit") or _infer_count_unit(cleaned["reason"])
    value = float(cleaned.get("value") or 0)
    if unit and cleaned.get("type", "fixed") == "fixed" and value > 0:
        cleaned["unit"] = unit
        cleaned["maxInstances"] = max(1, math.ceil(float(item.get("maxScore") or value) / value))
    return cleaned


def load_standard_groups(project_key: str = "yunan") -> dict[str, list[dict[str, Any]]]:
    standards = json.loads(_standards_json_path().read_text(encoding="utf-8"))
    groups = deepcopy(standards.get(project_key) or standards["yunan"])
    for facility_groups in groups.values():
        for level1 in facility_groups:
            for level2 in level1.get("children", []):
                for item in level2.get("items", []):
                    item["options"] = [
                        _clean_option(item, option)
                        for option in item.get("options", [])
                        if not _is_knowledge_only_option(option)
                    ]
    return groups


def item_score_total(groups: list[dict[str, Any]]) -> float:
    return sum(
        float(item.get("maxScore") or 0)
        for level1 in groups
        for level2 in level1.get("children", [])
        for item in level2.get("items", [])
    )
