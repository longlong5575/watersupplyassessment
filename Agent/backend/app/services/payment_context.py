from __future__ import annotations

import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AssessmentCycle, AssessmentRecord, City, Village
from app.services.payment import maonan_operation_coefficient, yunan_operation_coefficient
from app.services.payment_basis import (
    maonan_payment_basis_for_point,
    payment_basis_for_project,
    yunan_county_network_basis,
    yunan_rural_payment_basis_for_point,
    yunan_town_payment_basis_for_point,
)


QUARTER_PATTERN = re.compile(r"(?P<year>20\d{2})年第(?P<quarter>[1-4])季度")
HALF_YEAR_PATTERN = re.compile(r"(?P<year>20\d{2})年(?P<half>上|下)半年度")


def _period_descriptor(name: str) -> tuple[str, int, int] | None:
    quarter = QUARTER_PATTERN.search(str(name or ""))
    if quarter:
        return "quarter", int(quarter.group("year")), int(quarter.group("quarter"))
    half_year = HALF_YEAR_PATTERN.search(str(name or ""))
    if half_year:
        return "half", int(half_year.group("year")), 1 if half_year.group("half") == "上" else 2
    return None


def _period_order(name: str) -> int | None:
    descriptor = _period_descriptor(name)
    if descriptor is None:
        return None
    kind, year, index = descriptor
    return year * (4 if kind == "quarter" else 2) + index


def adjacent_period_name(name: str, offset: int) -> str | None:
    descriptor = _period_descriptor(name)
    if descriptor is None:
        return None
    kind, year, index = descriptor
    size = 4 if kind == "quarter" else 2
    absolute = year * size + (index - 1) + offset
    next_year, next_index_zero = divmod(absolute, size)
    next_index = next_index_zero + 1
    if kind == "quarter":
        return f"{next_year}年第{next_index}季度"
    return f"{next_year}年{'上' if next_index == 1 else '下'}半年度"


def months_for_period(name: str) -> list[str]:
    descriptor = _period_descriptor(name)
    if descriptor is None:
        return []
    kind, year, index = descriptor
    start_month = (index - 1) * (3 if kind == "quarter" else 6) + 1
    count = 3 if kind == "quarter" else 6
    return [f"{year}-{month:02d}" for month in range(start_month, start_month + count)]


def _facility_type(record: AssessmentRecord) -> str:
    raw = record.raw_payload or {}
    return str(raw.get("primaryFacilityType") or raw.get("facilityType") or "")


def _record_point_name(session: Session, record: AssessmentRecord) -> str:
    if record.village_id:
        village = session.get(Village, record.village_id)
        if village is not None:
            return village.name
    return record.town.name


def _previous_record(session: Session, record: AssessmentRecord, cycle: AssessmentCycle) -> tuple[AssessmentRecord, AssessmentCycle] | None:
    current_order = _period_order(cycle.name)
    if current_order is None:
        return None
    query = select(AssessmentRecord).where(
        AssessmentRecord.city_id == record.city_id,
        AssessmentRecord.town_id == record.town_id,
        AssessmentRecord.id != record.id,
        AssessmentRecord.status.in_(["submitted", "reviewed", "locked"]),
    )
    if record.village_id:
        query = query.where(AssessmentRecord.village_id == record.village_id)
    else:
        query = query.where(AssessmentRecord.village_id.is_(None))

    candidates: list[tuple[int, AssessmentRecord, AssessmentCycle]] = []
    facility_type = _facility_type(record)
    for candidate in session.scalars(query).all():
        if _facility_type(candidate) != facility_type:
            continue
        candidate_cycle = session.get(AssessmentCycle, candidate.cycle_id)
        if candidate_cycle is None:
            continue
        candidate_order = _period_order(candidate_cycle.name)
        if candidate_order is not None and candidate_order < current_order:
            candidates.append((candidate_order, candidate, candidate_cycle))
    if not candidates:
        return None
    _, previous, previous_cycle = max(candidates, key=lambda item: item[0])
    return previous, previous_cycle


def _basis_for_record(session: Session, record: AssessmentRecord, project_name: str) -> dict[str, Any] | None:
    point_name = _record_point_name(session, record)
    facility_type = _facility_type(record)
    if "茂南" in project_name:
        return maonan_payment_basis_for_point(point_name)
    if facility_type == "rural_treatment":
        return yunan_rural_payment_basis_for_point(record.town.name)
    if facility_type == "town_network" and record.town.name in {"都城镇", "县城区"}:
        return yunan_county_network_basis()
    return yunan_town_payment_basis_for_point(point_name)


def build_payment_context(session: Session, record: AssessmentRecord) -> dict[str, Any]:
    cycle = session.get(AssessmentCycle, record.cycle_id)
    project = session.get(City, record.city_id)
    if cycle is None or project is None:
        return {}

    raw = record.raw_payload or {}
    payment_data = raw.get("paymentData") if isinstance(raw.get("paymentData"), dict) else {}
    previous_pair = _previous_record(session, record, cycle)
    previous_record = previous_pair[0] if previous_pair else None
    previous_cycle = previous_pair[1] if previous_pair else None
    previous_score = float(previous_record.total_score) if previous_record and previous_record.total_score is not None else None
    first_payment_period = bool(payment_data.get("firstPaymentPeriod"))
    coefficient_converter = maonan_operation_coefficient if "茂南" in project.name else yunan_operation_coefficient
    applied_coefficient = coefficient_converter(previous_score) if previous_score is not None else (1.0 if first_payment_period else None)
    current_score = float(record.total_score) if record.total_score is not None else None

    stored_months = payment_data.get("months") if isinstance(payment_data.get("months"), list) else []
    stored_by_month = {
        str(item.get("month")): dict(item)
        for item in stored_months
        if isinstance(item, dict) and item.get("month")
    }
    month_rows = []
    for month in months_for_period(cycle.name):
        month_rows.append({"month": month, **stored_by_month.get(month, {})})
    if not month_rows:
        month_rows = [dict(item) for item in stored_months if isinstance(item, dict)]

    basis = _basis_for_record(session, record, project.name)
    design_scale = payment_data.get("designScaleCubicMetersPerDay")
    if design_scale in (None, "") and basis:
        design_scale = basis.get("designScaleCubicMetersPerDay")

    next_period = adjacent_period_name(cycle.name, 1)
    basis_status = payment_basis_for_project(project.name).get("basisStatus")
    return {
        "assessmentPeriod": cycle.name,
        "paymentPeriod": cycle.name,
        "coefficientSourcePeriod": previous_cycle.name if previous_cycle else None,
        "previousRecordId": previous_record.id if previous_record else None,
        "previousScore": previous_score,
        "appliedOperationCoefficient": applied_coefficient,
        "firstPaymentPeriod": first_payment_period,
        "coefficientStatus": "已继承上一期考核结果" if previous_score is not None else ("首个付费周期按1执行" if first_payment_period else "缺少上一期已提交考核结果"),
        "currentScore": current_score,
        "currentScoreAppliesTo": next_period,
        "nextPaymentPeriod": next_period,
        "months": month_rows,
        "designScaleCubicMetersPerDay": design_scale,
        "adjustedTreatmentUnitPriceYuanPerCubicMeter": payment_data.get("adjustedTreatmentUnitPriceYuanPerCubicMeter"),
        "adjustedNetworkOperationFeeTenThousandYuanPerYear": payment_data.get("adjustedNetworkOperationFeeTenThousandYuanPerYear"),
        "note": payment_data.get("note") or "",
        "basis": basis,
        "basisStatus": basis_status,
    }
