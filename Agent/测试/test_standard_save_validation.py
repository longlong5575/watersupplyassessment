from __future__ import annotations

import sys
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND))

from app.services.standard_validation import validate_standard_payload  # noqa: E402


def main() -> None:
    valid_items = [
        {"id": "l1", "name": "一级", "level": 1, "fullScore": 100},
        {"id": "l2", "parentId": "l1", "name": "二级", "level": 2, "fullScore": 100},
        {
            "id": "l3",
            "parentId": "l2",
            "name": "三级",
            "level": 3,
            "facilityType": "town_plant",
            "fullScore": 100,
            "options": [{"id": "o1", "name": "扣分原因", "deductionValue": 1}],
        },
    ]
    assert validate_standard_payload(valid_items) == []

    invalid_items = [
        {"id": "l1", "name": "一级", "level": 1, "fullScore": 99},
        {"id": "l2", "parentId": "l1", "name": "二级", "level": 2, "fullScore": 99},
        {
            "id": "l3",
            "parentId": "l2",
            "name": "三级",
            "level": 3,
            "facilityType": "town_plant",
            "fullScore": 99,
            "options": [{"id": "o1", "name": "扣分原因", "deductionValue": 120}],
        },
    ]
    errors = validate_standard_payload(invalid_items)
    assert any("应为100" in error for error in errors)
    assert any("不能超过单项满分" in error for error in errors)
    print("PASS: 标准保存校验能拦截满分和扣分错误")


if __name__ == "__main__":
    main()
