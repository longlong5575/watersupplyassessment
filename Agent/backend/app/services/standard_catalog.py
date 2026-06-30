from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any


def _standards_json_path() -> Path:
    return Path(__file__).resolve().parents[1] / "data" / "project_standards.json"


def load_standard_groups(project_key: str = "yunan") -> dict[str, list[dict[str, Any]]]:
    standards = json.loads(_standards_json_path().read_text(encoding="utf-8"))
    return deepcopy(standards.get(project_key) or standards["yunan"])


def item_score_total(groups: list[dict[str, Any]]) -> float:
    return sum(
        float(item.get("maxScore") or 0)
        for level1 in groups
        for level2 in level1.get("children", [])
        for item in level2.get("items", [])
    )
