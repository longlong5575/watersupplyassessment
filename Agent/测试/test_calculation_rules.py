from __future__ import annotations

import sys
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND))

from app.services.payment import (  # noqa: E402
    maonan_network_monthly_operation_fee,
    maonan_operation_coefficient,
    maonan_treatment_monthly_fee,
    maonan_water_quality_coefficient,
    town_average_coefficient,
    yunan_operation_coefficient,
    yunan_water_quality_coefficient,
)
from app.services.payment_basis import load_payment_basis, payment_source_summary  # noqa: E402


def close(actual: float, expected: float, tolerance: float = 1e-8) -> None:
    assert abs(actual - expected) <= tolerance, (actual, expected)


def main() -> None:
    close(maonan_operation_coefficient(70), 1)
    close(maonan_operation_coefficient(69), 69 / 70)
    close(yunan_operation_coefficient(90), 1)
    close(yunan_operation_coefficient(81), 0.9)
    close(town_average_coefficient([90, 81], project="yunan") or 0, 0.95)

    # 茂南例文表4-3：108.29/12.21 按出水最低30计算，Kq=0.87（显示值）。
    kq = maonan_water_quality_coefficient(108.29, 12.21)
    close(round(kq, 2), 0.87)
    # 表4-7：Py=1.69、Kq=0.87、E1=1，运营单价折算显示为1.67。
    operation_part = 1.69 * (3 / 5 + kq / 10 + 3 / 10)
    close(round(operation_part, 2), 1.67)
    # 表4-7山阁镇2025年6月：Kq显示0.92，但金额使用(113.12-30)/90的未舍入值。
    shange_kq = maonan_water_quality_coefficient(113.12, 10.91)
    close(maonan_network_monthly_operation_fee(
        annual_operation_fee_yuan=302277.33,
        water_quality_coefficient=shange_kq,
        operation_coefficient=1,
    ), 24997.33, tolerance=0.2)
    close(maonan_network_monthly_operation_fee(
        annual_operation_fee_yuan=120000,
        water_quality_coefficient=0.8,
        operation_coefficient=0.9,
    ), 120000 * (3 / 5 + 0.8 / 10 + 3 * 0.9 / 10) / 12)

    # 污水处理费同时包含运营费和可用性付费，单位为万元/月。
    close(maonan_treatment_monthly_fee(
        operation_unit_price=1.69,
        monthly_volume_ten_thousand_tons=3,
        water_quality_coefficient=0.87,
        operation_coefficient=1,
        annual_availability_fee_ten_thousand_yuan=33.59,
    ), 1.69 * 3 * (3 / 5 + 0.87 / 10 + 3 / 10) + 33.59 / 12)

    close(yunan_water_quality_coefficient(210, 35), 1.05)
    close(yunan_water_quality_coefficient(230, 35), 1.1)
    close(yunan_water_quality_coefficient(160, 35, effluent_qualified=False), 0.9)
    basis = load_payment_basis()
    assert set(basis) == {"yunan", "maonan"}
    assert "茂南项目既有例文" in payment_source_summary("茂南项目")
    assert "表4-1 水质净化设施项目服务费" in payment_source_summary("茂南项目")
    print("PASS: 郁南/茂南扣分系数与金额公式反算")


if __name__ == "__main__":
    main()
