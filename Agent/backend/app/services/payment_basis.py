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
    rows = data.get("maonan", {}).get("facilityBasis") or []
    names = [str(item.get("pointName") or "").strip() for item in rows]
    if len(rows) != 7 or len(set(names)) != 7 or any(not name for name in names):
        raise ValueError("茂南金额基础表必须包含7个不重复项目点。")
    numeric_fields = {
        "designScaleCubicMetersPerDay",
        "guaranteedVolumeFactor",
        "maximumVolumeFactor",
        "treatmentAvailabilityFeeTenThousandYuanPerYear",
        "treatmentOperationUnitPriceYuanPerCubicMeter",
        "networkAvailabilityFeeTenThousandYuanPerYear",
        "originalNetworkOperationFeeTenThousandYuanPerYear",
        "adjustedNetworkOperationFeeYuanPerYear",
    }
    for row in rows:
        for field in numeric_fields:
            value = row.get(field)
            if value is not None and float(value) < 0:
                raise ValueError(f"茂南金额基础表存在负数：{row['pointName']} / {field}")

    yunan = data.get("yunan", {})
    town_rows = yunan.get("townFacilityBasis") or []
    rural_rows = yunan.get("ruralFacilityBasis") or []
    if len(town_rows) != 15 or len({row.get("pointName") for row in town_rows}) != 15:
        raise ValueError("郁南附件18镇区金额基础表必须包含15个不重复项目点。")
    if len(rural_rows) != 15 or len({row.get("pointName") for row in rural_rows}) != 15:
        raise ValueError("郁南附件18农村金额基础表必须包含15个不重复镇街。")
    if sum(row.get("treatmentOperationUnitPriceYuanPerCubicMeter") is not None for row in town_rows) != 13:
        raise ValueError("郁南附件18镇区污水处理单价必须包含13个项目点。")

    expected_sums = {
        "networkAvailabilityFeeTenThousandYuanPerYear": 938.64,
        "networkOperationFeeTenThousandYuanPerYear": 23.78,
    }
    for field, expected in expected_sums.items():
        actual = round(sum(float(row.get(field) or 0) for row in town_rows), 2)
        if actual != expected:
            raise ValueError(f"郁南附件18镇区金额合计不一致：{field}={actual}，应为{expected}。")

    rural_expected_sums = {
        "availabilityFeeTenThousandYuanPerYear": 1489.66,
        "operationFeeTenThousandYuanPerYear": 372.21,
    }
    for field, expected in rural_expected_sums.items():
        actual = round(sum(float(row.get(field) or 0) for row in rural_rows), 2)
        if actual != expected:
            raise ValueError(f"郁南附件18农村金额合计不一致：{field}={actual}，应为{expected}。")
    return data


def payment_basis_for_project(project_name: str) -> dict[str, Any]:
    if "茂南" in project_name:
        key = "maonan"
    elif "郁南" in project_name:
        key = "yunan"
    else:
        raise ValueError(f"不支持的金额项目：{project_name}")
    return load_payment_basis()[key]


def maonan_payment_basis_rows() -> list[dict[str, Any]]:
    rows = load_payment_basis()["maonan"].get("facilityBasis") or []
    return [dict(row) for row in rows]


def _normalize_maonan_point_name(point_name: str) -> str:
    normalized = str(point_name or "").strip()
    suffixes = (
        "水质净化厂及配套管网",
        "水质净化厂配套管网及提升泵站",
        "污水管网及提升泵站",
        "污水收集管网",
        "水质净化厂",
        "配套管网",
    )
    for suffix in suffixes:
        if normalized.endswith(suffix):
            normalized = normalized[: -len(suffix)].strip()
            break
    return "茂南区" if normalized == "茂南区水质净化设施" else normalized


def maonan_payment_basis_for_point(point_name: str) -> dict[str, Any] | None:
    normalized = _normalize_maonan_point_name(point_name)
    for row in maonan_payment_basis_rows():
        if row["pointName"] == normalized:
            return row
    return None


def yunan_town_payment_basis_rows() -> list[dict[str, Any]]:
    rows = load_payment_basis()["yunan"].get("townFacilityBasis") or []
    return [dict(row) for row in rows]


def yunan_rural_payment_basis_rows() -> list[dict[str, Any]]:
    rows = load_payment_basis()["yunan"].get("ruralFacilityBasis") or []
    return [dict(row) for row in rows]


def yunan_county_network_basis() -> dict[str, Any]:
    return dict(load_payment_basis()["yunan"].get("countyNetworkBasis") or {})


def _normalize_yunan_point_name(point_name: str) -> str:
    normalized = str(point_name or "").strip()
    suffixes = (
        "农村污水处理设施",
        "镇区污水处理设施",
        "污水处理厂（站）",
        "污水处理厂",
        "污水收集管网",
        "污水管网",
    )
    for suffix in suffixes:
        if normalized.endswith(suffix):
            normalized = normalized[: -len(suffix)].strip()
            break
    return normalized


def yunan_town_payment_basis_for_point(point_name: str) -> dict[str, Any] | None:
    normalized = _normalize_yunan_point_name(point_name)
    for row in yunan_town_payment_basis_rows():
        if row["pointName"] == normalized:
            return row
    return None


def yunan_rural_payment_basis_for_point(point_name: str) -> dict[str, Any] | None:
    normalized = _normalize_yunan_point_name(point_name)
    for row in yunan_rural_payment_basis_rows():
        if row["pointName"] == normalized:
            return row
    return None


def payment_source_summary(project_name: str) -> str:
    basis = payment_basis_for_project(project_name)
    tables = "、".join(item["name"] for item in basis.get("sourceTables", []))
    row_count = len(basis.get("facilityBasis") or [])
    if "郁南" in project_name:
        row_count = len(basis.get("townFacilityBasis") or []) + len(basis.get("ruralFacilityBasis") or [])
    row_summary = f"已结构化{row_count}个项目点金额基数。" if row_count else ""
    return f"{basis['sourcePolicy']}当前金额基数状态：{basis['basisStatus']}。结构化来源包括：{tables}。{row_summary}"
