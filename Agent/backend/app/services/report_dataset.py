from __future__ import annotations

import hashlib
import json
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AssessmentCycle,
    AssessmentRecord,
    AssessmentScore,
    Attachment,
    DeductionOption,
    Indicator,
    IndicatorVersion,
    ReviewLog,
    SurveyRecord,
    Town,
    WaterQualityRecord,
)


def _json_safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def _normalize(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _normalize(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_normalize(item) for item in value]
    return _json_safe(value)


def _hash_payload(payload: dict[str, Any]) -> str:
    text = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=_json_safe)
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _score_payload(session: Session, score: AssessmentScore) -> dict[str, Any]:
    indicator = session.get(Indicator, score.indicator_id) if score.indicator_id else None
    option = session.get(DeductionOption, score.deduction_option_id) if score.deduction_option_id else None
    return {
        "id": score.id,
        "indicatorId": score.indicator_id,
        "indicatorName": indicator.name if indicator else None,
        "indicatorFullScore": indicator.full_score if indicator else None,
        "deductionOptionId": score.deduction_option_id,
        "deductionOptionName": option.name if option else None,
        "score": score.score,
        "deduction": score.deduction,
        "reason": score.reason,
        "source": score.source,
    }


def build_report_dataset(
    session: Session,
    *,
    cycle: AssessmentCycle | None,
    town_names: set[str] | None = None,
) -> dict[str, Any]:
    query = select(AssessmentRecord).where(AssessmentRecord.status.in_(["reviewed", "locked"]))
    if cycle is not None:
        query = query.where(AssessmentRecord.cycle_id == cycle.id)
    records = list(session.scalars(query).all())
    if town_names:
        records = [record for record in records if record.town.name in town_names]

    town_payloads: list[dict[str, Any]] = []
    record_payloads: list[dict[str, Any]] = []
    record_ids = [record.id for record in records]
    version_ids = sorted({record.indicator_version_id for record in records if record.indicator_version_id})

    for record in sorted(records, key=lambda item: (item.town.name, item.created_at.isoformat(), item.id)):
        surveys = list(session.scalars(select(SurveyRecord).where(SurveyRecord.record_id == record.id)).all())
        water = list(session.scalars(select(WaterQualityRecord).where(WaterQualityRecord.record_id == record.id)).all())
        attachments = list(session.scalars(select(Attachment).where(Attachment.record_id == record.id)).all())
        logs = list(session.scalars(select(ReviewLog).where(ReviewLog.record_id == record.id)).all())
        record_payloads.append(
            {
                "id": record.id,
                "cityId": record.city_id,
                "cycleId": record.cycle_id,
                "townId": record.town_id,
                "town": record.town.name,
                "villageId": record.village_id,
                "facilityId": record.facility_id,
                "indicatorVersionId": record.indicator_version_id,
                "status": record.status,
                "totalScore": record.total_score,
                "submittedAt": record.submitted_at,
                "reviewedAt": record.reviewed_at,
                "lockedAt": record.locked_at,
                "scoreCount": len(record.scores),
                "surveyCount": len(surveys),
                "waterQualityCount": len(water),
                "attachmentCount": len(attachments),
                "reviewLogCount": len(logs),
                "scores": [_score_payload(session, score) for score in record.scores],
                "surveys": [
                    {"id": item.id, "surveyType": item.survey_type, "respondent": item.respondent, "score": item.score, "payload": item.payload}
                    for item in surveys
                ],
                "waterQuality": [
                    {"id": item.id, "sampledAt": item.sampled_at, "conclusion": item.conclusion, "payload": item.payload}
                    for item in water
                ],
                "attachments": [
                    {
                        "id": item.id,
                        "filename": item.filename,
                        "scoreId": item.score_id,
                        "deductionOptionId": item.deduction_option_id,
                        "size": item.size,
                    }
                    for item in attachments
                ],
                "reviewLogs": [
                    {"id": item.id, "action": item.action, "reason": item.reason, "createdAt": item.created_at}
                    for item in logs
                ],
            }
        )

    by_town: dict[str, list[dict[str, Any]]] = {}
    for record in record_payloads:
        by_town.setdefault(record["town"], []).append(record)
    for town_name, town_records in sorted(by_town.items()):
        town_payloads.append(
            {
                "town": town_name,
                "recordCount": len(town_records),
                "lockedCount": sum(1 for item in town_records if item["status"] == "locked"),
                "reviewedCount": sum(1 for item in town_records if item["status"] == "reviewed"),
                "scoreCount": sum(item["scoreCount"] for item in town_records),
                "surveyCount": sum(item["surveyCount"] for item in town_records),
                "waterQualityCount": sum(item["waterQualityCount"] for item in town_records),
                "attachmentCount": sum(item["attachmentCount"] for item in town_records),
            }
        )

    versions = [
        session.get(IndicatorVersion, version_id)
        for version_id in version_ids
    ]
    towns = [
        session.scalar(select(Town).where(Town.name == name))
        for name in sorted(town_names or by_town.keys())
    ]
    snapshot = {
        "cycleId": cycle.id if cycle else None,
        "cycleName": cycle.name if cycle else None,
        "requestedTowns": sorted(town_names or []),
        "towns": town_payloads,
        "records": record_payloads,
        "recordIds": sorted(record_ids),
        "indicatorVersionIds": version_ids,
        "indicatorVersions": [
            {"id": item.id, "name": item.name, "status": item.status, "locked": item.locked}
            for item in versions
            if item is not None
        ],
        "townIds": [item.id for item in towns if item is not None],
    }
    normalized = _normalize(snapshot)
    normalized["hash"] = _hash_payload(normalized)
    return normalized


def validate_report_dataset(snapshot: dict[str, Any]) -> None:
    if not snapshot.get("records"):
        raise RuntimeError("No reviewed or locked assessment records are available for report generation.")
    missing_versions = [item["id"] for item in snapshot["records"] if not item.get("indicatorVersionId")]
    if missing_versions:
        raise RuntimeError("Report generation requires every record to bind an indicator version.")
    missing_scores = [item["id"] for item in snapshot["records"] if item.get("scoreCount", 0) <= 0]
    if missing_scores:
        raise RuntimeError("Report generation requires at least one score detail for every selected record.")
