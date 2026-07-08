from __future__ import annotations

import sys
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND))

from app.services.project_standards import split_deduction_options  # noqa: E402


def close(actual: float, expected: float, tolerance: float = 1e-8) -> None:
    assert abs(actual - expected) <= tolerance, (actual, expected)


def main() -> None:
    per_place = split_deduction_options("问题未及时处理或处理记录不符合要求，每处扣0.1分。", 7)
    assert per_place[0]["type"] == "fixed"
    close(per_place[0]["value"], 0.1)
    assert per_place[0]["unit"] == "处"
    assert per_place[0]["maxInstances"] == 70

    per_item = split_deduction_options("工艺参数监控分析每缺一项次扣0.5分。", 6)
    assert per_item[0]["unit"] == "项次"
    assert per_item[0]["maxInstances"] == 12

    ranged = split_deduction_options("运行管理机构或岗位职责不健全分别扣0.5至1分。", 1)
    assert ranged[0]["type"] == "range"
    close(ranged[0]["min"], 0.5)
    close(ranged[0]["max"], 1.0)

    manual = split_deduction_options("积泥超限、塌陷、变形、堵塞或污水冒出按报告标准逐处扣分。", 10)
    assert manual[0]["type"] == "range"
    close(manual[0]["min"], 0.0)
    close(manual[0]["max"], 10.0)
    assert manual[0].get("value") != 1.0

    sampled_unit = split_deduction_options(
        "以7个井段为一个管道检查单元，每次抽检5个管道检查单元\n每发现1处扣0.5分。",
        2,
    )
    assert len(sampled_unit) == 1
    assert "检查单元" not in sampled_unit[0]["reason"]
    assert sampled_unit[0]["unit"] == "处"
    assert sampled_unit[0]["maxInstances"] == 4

    per_one = split_deduction_options("每一个扣0.4分。", 4)
    assert per_one[0]["unit"] == "个"
    assert per_one[0]["maxInstances"] == 10

    print("PASS: 扣分选项、数量扣分和人工区间兜底生成正确")


if __name__ == "__main__":
    main()
