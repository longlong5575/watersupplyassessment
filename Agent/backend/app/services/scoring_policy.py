from __future__ import annotations

from typing import Any, Iterable

from sqlalchemy.orm import Session

from app.models import AssessmentRecord, City
from app.services.project_catalog import town_scoring_policy
from app.services.standard_catalog import load_standard_groups


def project_key(project_name: str | None) -> str:
    return "maonan" if "茂南" in str(project_name or "") else "yunan"


def _excluded_items(
    project_name: str | None,
    facility_type: str,
    excluded_group_names: set[str],
) -> list[dict[str, Any]]:
    groups = load_standard_groups(project_key(project_name)).get(facility_type, [])
    return [
        item
        for level1 in groups
        for level2 in level1.get("children", [])
        if level2.get("name") in excluded_group_names
        for item in level2.get("items", [])
    ]


def scoring_policy(project_name: str | None, town_name: str | None, facility_type: str | None) -> dict[str, Any]:
    configured = town_scoring_policy(project_name, town_name, facility_type)
    if not configured or configured.get("mode") != "scaled_applicable" or not facility_type:
        return {
            "mode": "direct_100",
            "originalMaxScore": 100.0,
            "excludedScore": 0.0,
            "applicableMaxScore": 100.0,
            "excludedIndicatorCodes": [],
            "description": "按满分100分直接计分。",
        }

    excluded_group_names = {
        str(name)
        for name in configured.get("excludedGroupNames", [])
        if str(name).strip()
    }
    excluded_items = _excluded_items(project_name, facility_type, excluded_group_names)
    excluded_score = round(sum(float(item.get("maxScore") or 0) for item in excluded_items), 4)
    applicable_max = round(100.0 - excluded_score, 4)
    reason = str(configured.get("reason") or "存在不适用评分项")
    return {
        **configured,
        "mode": "scaled_applicable",
        "originalMaxScore": 100.0,
        "excludedScore": excluded_score,
        "applicableMaxScore": applicable_max,
        "excludedIndicatorCodes": [str(item.get("id")) for item in excluded_items if item.get("id")],
        "description": (
            f"本考核对象{reason}，{('、'.join(sorted(excluded_group_names)) or '相关评分项')}"
            f"{excluded_score:g}分不适用；"
            f"按适用满分{applicable_max:g}分折算为百分制。"
        ),
    }


def calculate_policy_score(policy: dict[str, Any], scores: Iterable[Any]) -> dict[str, Any]:
    excluded_codes = set(policy.get("excludedIndicatorCodes") or [])
    raw_score = 0.0
    raw_deduction = 0.0
    for item in scores:
        code = getattr(getattr(item, "indicator", None), "code", None)
        if code is None and isinstance(item, dict):
            code = item.get("indicatorCode")
        if code in excluded_codes:
            continue
        score = item.get("score") if isinstance(item, dict) else getattr(item, "score", 0)
        deduction = item.get("deduction") if isinstance(item, dict) else getattr(item, "deduction", 0)
        raw_score += float(score or 0)
        raw_deduction += float(deduction or 0)

    applicable_max = float(policy.get("applicableMaxScore") or 100)
    percent_score = round(max(0.0, min(raw_score / applicable_max * 100, 100.0)), 1) if applicable_max else 0.0
    result = {
        **policy,
        "rawApplicableScore": round(raw_score, 4),
        "rawDeduction": round(raw_deduction, 4),
        "percentScore": percent_score,
    }
    if policy.get("mode") == "scaled_applicable":
        result["formula"] = f"{raw_score:.2f}/{applicable_max:g}×100={percent_score:.1f}"
        result["displayText"] = (
            f"适用满分{applicable_max:g}分，实得{raw_score:.2f}分，"
            f"按{applicable_max:g}分换算百分制得{percent_score:.1f}分"
        )
    else:
        result["formula"] = f"100-{raw_deduction:.2f}={percent_score:.1f}"
        result["displayText"] = f"满分100分，原始扣分{raw_deduction:.2f}分，实得{percent_score:.1f}分"
    return result


def record_scoring_policy(session: Session, record: AssessmentRecord) -> dict[str, Any]:
    city = session.get(City, record.city_id) if record.city_id else None
    raw = record.raw_payload if isinstance(record.raw_payload, dict) else {}
    facility_type = raw.get("primaryFacilityType") or raw.get("facilityType")
    return scoring_policy(city.name if city else None, record.town.name if record.town else None, facility_type)
