from __future__ import annotations


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
