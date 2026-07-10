from __future__ import annotations

import calendar


def _bounded_score(score: float) -> float:
    return max(0.0, min(float(score), 100.0))


def maonan_operation_coefficient(score: float) -> float:
    """茂南例文表1-4：W>=70 时 E1=1，否则 E1=W/70。"""
    value = _bounded_score(score)
    return 1.0 if value >= 70.0 else value / 70.0


def yunan_operation_coefficient(score: float) -> float:
    """郁南例文：W>=90 时 E2=1，否则 E2=W/90。"""
    value = _bounded_score(score)
    return 1.0 if value >= 90.0 else value / 90.0


def town_average_coefficient(scores: list[float], *, project: str) -> float | None:
    if not scores:
        return None
    converter = maonan_operation_coefficient if project == "maonan" else yunan_operation_coefficient
    return sum(converter(score) for score in scores) / len(scores)


def maonan_water_quality_coefficient(influent_cod: float, effluent_cod: float) -> float:
    influent = max(float(influent_cod), 0.0)
    effluent = max(float(effluent_cod), 30.0)
    if influent < 140.0:
        return min(max((influent - effluent) / 90.0, 0.0), 1.0)
    if influent < 200.0:
        return 1.0
    if influent < 250.0:
        return 1.05
    return 1.1


def yunan_water_quality_coefficient(influent_cod: float, effluent_cod: float, *, effluent_qualified: bool = True) -> float:
    influent = max(float(influent_cod), 0.0)
    effluent = max(float(effluent_cod), 30.0)
    if influent < 140.0:
        return min(max((influent - effluent) / 90.0, 0.0), 1.0)
    if not effluent_qualified:
        return 0.9
    if influent < 200.0:
        return 1.0
    if influent < 220.0:
        return 1.05
    return 1.1


def yunan_town_treatment_monthly_fee(
    *,
    operation_unit_price: float,
    monthly_volume_ten_thousand_cubic_meters: float,
    water_quality_coefficient: float,
    operation_coefficient: float,
) -> float:
    """附件18：PCi=P0×QB×(3/4×Kq+1/4×E2)，返回万元/月。"""
    p0 = max(float(operation_unit_price), 0.0)
    qb = max(float(monthly_volume_ten_thousand_cubic_meters), 0.0)
    kq = max(float(water_quality_coefficient), 0.0)
    e2 = max(float(operation_coefficient), 0.0)
    return p0 * qb * (3 / 4 * kq + 1 / 4 * e2)


def yunan_network_monthly_fee(
    *,
    annual_network_fee_ten_thousand_yuan: float,
    load_coefficient: float,
    water_quality_coefficient: float,
    dry_season_quality_coefficient: float,
    operation_coefficient: float,
) -> float:
    """附件18：Pwi=P0/12×(5/6×KQ×Kq+1/6×E1×E2)，返回万元/月。"""
    p0 = max(float(annual_network_fee_ten_thousand_yuan), 0.0)
    k_load = max(float(load_coefficient), 0.0)
    k_quality = max(float(water_quality_coefficient), 0.0)
    e1 = max(float(dry_season_quality_coefficient), 0.0)
    e2 = max(float(operation_coefficient), 0.0)
    return p0 / 12 * (5 / 6 * k_load * k_quality + 1 / 6 * e1 * e2)


def yunan_dry_season_quality_coefficient(days_over_160: int) -> float:
    days = max(int(days_over_160), 0)
    return 1.0 if days >= 21 else (days + 69) / 90


def yunan_town_network_load_coefficient(average_daily_volume: float, design_scale: float) -> float:
    design = max(float(design_scale), 0.0)
    if design == 0:
        raise ValueError("设计规模必须大于0。")
    return min(max(float(average_daily_volume), 0.0) / (design * 0.9), 1.0)


def yunan_center_network_load_coefficient(average_daily_volume: float, design_or_sales_volume: float) -> float:
    basis = max(float(design_or_sales_volume), 0.0)
    if basis == 0:
        raise ValueError("设计规模或售水量基数必须大于0。")
    volume = max(float(average_daily_volume), 0.0)
    return 1.0 if volume >= basis * 0.8 else volume / basis


def bounded_monthly_volume(
    *,
    actual_volume_ten_thousand_cubic_meters: float,
    design_scale_cubic_meters_per_day: float,
    month: str,
    maximum_factor: float,
    guaranteed_factor: float | None = None,
) -> dict[str, float]:
    year_text, month_text = str(month).split("-", 1)
    days = calendar.monthrange(int(year_text), int(month_text))[1]
    design_monthly = max(float(design_scale_cubic_meters_per_day), 0.0) * days / 10000
    if design_monthly <= 0:
        raise ValueError("设计规模必须大于0。")
    actual = max(float(actual_volume_ten_thousand_cubic_meters), 0.0)
    maximum = design_monthly * max(float(maximum_factor), 0.0)
    minimum = design_monthly * max(float(guaranteed_factor or 0), 0.0)
    applied = min(max(actual, minimum), maximum)
    return {
        "days": float(days),
        "actual": actual,
        "designMonthly": design_monthly,
        "minimum": minimum,
        "maximum": maximum,
        "applied": applied,
    }


def maonan_annual_maximum_treatment_fee(
    *,
    annual_availability_fee_ten_thousand_yuan: float,
    operation_unit_price_yuan_per_cubic_meter: float,
    design_scale_cubic_meters_per_day: float,
) -> float:
    availability = max(float(annual_availability_fee_ten_thousand_yuan), 0.0)
    operation = (
        max(float(operation_unit_price_yuan_per_cubic_meter), 0.0)
        * max(float(design_scale_cubic_meters_per_day), 0.0)
        * 350
        / 10000
    )
    return availability + operation


def maonan_treatment_monthly_fee(
    *,
    operation_unit_price: float,
    monthly_volume_ten_thousand_tons: float,
    water_quality_coefficient: float,
    operation_coefficient: float,
    annual_availability_fee_ten_thousand_yuan: float,
) -> float:
    """返回万元/月，对应茂南例文城镇水质净化厂付费公式。"""
    py = max(float(operation_unit_price), 0.0)
    qb = max(float(monthly_volume_ten_thousand_tons), 0.0)
    kq = max(float(water_quality_coefficient), 0.0)
    e1 = max(float(operation_coefficient), 0.0)
    pk = max(float(annual_availability_fee_ten_thousand_yuan), 0.0)
    operation_fee = py * qb * (3 / 5 + kq / 10 + 3 * e1 / 10)
    availability_fee = pk / 12 * (2 / 3 + e1 / 3)
    return operation_fee + availability_fee


def maonan_network_monthly_operation_fee(
    *,
    annual_operation_fee_yuan: float,
    water_quality_coefficient: float,
    operation_coefficient: float,
) -> float:
    """返回元/月；与例文表4-7至表4-11的管网运营维护费计算一致。"""
    annual_fee = max(float(annual_operation_fee_yuan), 0.0)
    kq = max(float(water_quality_coefficient), 0.0)
    e1 = max(float(operation_coefficient), 0.0)
    return annual_fee * (3 / 5 + kq / 10 + 3 * e1 / 10) / 12


def maonan_network_monthly_fee(
    *,
    annual_availability_fee_ten_thousand_yuan: float,
    annual_operation_fee_ten_thousand_yuan: float,
    water_quality_coefficient: float,
    operation_coefficient: float,
) -> float:
    """返回万元/月，包含管网可用性付费和调整后运营维护费。"""
    pk = max(float(annual_availability_fee_ten_thousand_yuan), 0.0)
    py = max(float(annual_operation_fee_ten_thousand_yuan), 0.0)
    kq = max(float(water_quality_coefficient), 0.0)
    e1 = max(float(operation_coefficient), 0.0)
    availability_fee = pk / 12 * (2 / 3 + e1 / 3)
    operation_fee = py / 12 * (3 / 5 + kq / 10 + 3 * e1 / 10)
    return availability_fee + operation_fee
