from __future__ import annotations

import sys
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND))

from app.services.standard_catalog import load_standard_groups  # noqa: E402


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
                        for option in options:
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
