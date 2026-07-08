from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any


def _basis_path() -> Path:
    return Path(__file__).resolve().parents[1] / "data" / "payment_basis.json"


@lru_cache(maxsize=1)
def load_payment_basis() -> dict[str, dict[str, Any]]:
    data = json.loads(_basis_path().read_text(encoding="utf-8"))
    allowed = {"yunan", "maonan"}
    unknown = set(data) - allowed
    if unknown:
        raise ValueError(f"金额基础资料包含未允许项目：{', '.join(sorted(unknown))}")
    return data


def payment_basis_for_project(project_name: str) -> dict[str, Any]:
    key = "maonan" if "茂南" in project_name else "yunan"
    return load_payment_basis()[key]


def payment_source_summary(project_name: str) -> str:
    basis = payment_basis_for_project(project_name)
    tables = "、".join(item["name"] for item in basis.get("sourceTables", []))
    return f"{basis['sourcePolicy']}当前结构化金额来源包括：{tables}。"
