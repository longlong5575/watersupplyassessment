from __future__ import annotations

import re
import sys
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND))

from app.services.standard_catalog import _deduction_clauses, load_standard_groups  # noqa: E402


def main() -> None:
    failures: list[str] = []
    for project in ("yunan", "maonan"):
        groups_by_type = load_standard_groups(project)
        for facility_type, groups in groups_by_type.items():
            total = 0.0
            option_count = 0
            count_options = 0
            for group in groups:
                for child in group.get("children", []):
                    for item in child.get("items", []):
                        score = float(item.get("maxScore") or item.get("score") or 0)
                        total += score
                        options = item.get("options") or []
                        option_count += len(options)
                        if not options:
                            failures.append(f"{project}/{facility_type}/{item.get('name')}: 缺少扣分选项")
                        fixed_options = [option for option in options if (option.get("type") or "fixed") == "fixed"]
                        clauses = _deduction_clauses(item.get("evaluationStandard") or item.get("standardText") or "")
                        if clauses and len(fixed_options) != len(clauses):
                            failures.append(
                                f"{project}/{facility_type}/{item.get('name')}: "
                                f"原文扣分条款{len(clauses)}项，实际选项{len(fixed_options)}项"
                            )
                        option_keys: set[tuple[object, ...]] = set()
                        for option in options:
                            key = (
                                re.sub(r"\s+", "", str(option.get("reason") or "")),
                                option.get("type") or "fixed",
                                float(option.get("value") or 0),
                                float(option.get("min") or 0),
                                float(option.get("max") or 0),
                                option.get("unit"),
                            )
                            if key in option_keys:
                                failures.append(f"{project}/{facility_type}/{item.get('name')}: 存在重复扣分选项 {option.get('reason')}")
                            option_keys.add(key)
                            if option.get("unit"):
                                count_options += 1
                            if option.get("type") == "fixed" and float(option.get("value") or 0) > score + 1e-9:
                                failures.append(f"{project}/{facility_type}/{item.get('name')}: 固定扣分超过单项满分")
                            if option.get("type") == "range" and float(option.get("max") or 0) > score + 1e-9:
                                failures.append(f"{project}/{facility_type}/{item.get('name')}: 区间扣分超过单项满分")
            if round(total, 6) != 100.0:
                failures.append(f"{project}/{facility_type}: 满分合计为 {total}，不是 100")
            if option_count <= 0:
                failures.append(f"{project}/{facility_type}: 未生成扣分选项")
            if count_options <= 0:
                failures.append(f"{project}/{facility_type}: 未生成数量扣分选项")
    if failures:
        raise SystemExit("\n".join(failures))
    print("PASS: 两项目评分标准满分、扣分选项和数量扣分完整")


if __name__ == "__main__":
    main()
