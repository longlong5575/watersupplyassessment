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
    AgentRun,
    DeductionOption,
    Indicator,
    IndicatorVersion,
    ReviewLog,
    SurveyRecord,
    Town,
    User,
    Village,
    WaterQualityRecord,
    City,
)
from app.services.payment_context import build_payment_context


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


def _chapter_sort_key(code: str | None) -> tuple[int, ...]:
    if not code:
        return (9999,)
    parts: list[int] = []
    for part in str(code).split("."):
        try:
            parts.append(int(part))
        except ValueError:
            parts.append(9999)
    return tuple(parts) or (9999,)


def _hash_payload(payload: dict[str, Any]) -> str:
    text = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=_json_safe)
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _score_payload(session: Session, score: AssessmentScore) -> dict[str, Any]:
    indicator = session.get(Indicator, score.indicator_id) if score.indicator_id else None
    option = session.get(DeductionOption, score.deduction_option_id) if score.deduction_option_id else None
    return {
        "id": score.id,
        "indicatorId": score.indicator_id,
        "indicatorCode": indicator.code if indicator else None,
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
    city_id: str | None = None,
) -> dict[str, Any]:
    query = select(AssessmentRecord).where(AssessmentRecord.status.in_(["submitted", "reviewed", "locked"]))
    project_id = city_id or (cycle.city_id if cycle else None)
    if project_id:
        query = query.where(AssessmentRecord.city_id == project_id)
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
        village = session.get(Village, record.village_id) if record.village_id else None
        owner = session.get(User, record.owner_user_id) if record.owner_user_id else None
        surveys = list(session.scalars(select(SurveyRecord).where(SurveyRecord.record_id == record.id)).all())
        water = list(session.scalars(select(WaterQualityRecord).where(WaterQualityRecord.record_id == record.id)).all())
        attachments = list(session.scalars(select(Attachment).where(Attachment.record_id == record.id)).all())
        accepted_agent_runs = list(
            session.scalars(
                select(AgentRun)
                .where(AgentRun.record_id == record.id, AgentRun.accepted.is_(True))
                .order_by(AgentRun.created_at.desc())
            ).all()
        )
        logs = list(session.scalars(select(ReviewLog).where(ReviewLog.record_id == record.id).order_by(ReviewLog.created_at)).all())
        record_payloads.append(
            {
                "id": record.id,
                "cityId": record.city_id,
                "cycleId": record.cycle_id,
                "townId": record.town_id,
                "town": record.town.name,
                "villageId": record.village_id,
                "village": village.name if village else None,
                "administrativeVillage": village.administrative_village if village else None,
                "villageChapterCode": village.chapter_code if village else None,
                "villageAssessmentObject": village.assessment_object if village else {},
                "villageReportTemplate": village.report_template if village else {},
                "facilityId": record.facility_id,
                "facilityType": (record.raw_payload or {}).get("primaryFacilityType") or (record.raw_payload or {}).get("facilityType"),
                "indicatorVersionId": record.indicator_version_id,
                "status": record.status,
                "totalScore": record.total_score,
                "ownerUserId": record.owner_user_id,
                "ownerDisplayName": (owner.display_name or owner.username) if owner else None,
                "rawPayload": record.raw_payload or {},
                "paymentContext": build_payment_context(session, record),
                "submittedAt": record.submitted_at,
                "reviewedAt": record.reviewed_at,
                "lockedAt": record.locked_at,
                "updatedAt": record.updated_at,
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
                        "contentType": item.content_type,
                        "size": item.size,
                        "storageKey": item.storage_key,
                    }
                    for item in attachments
                ],
                "agentRuns": [
                    {
                        "id": item.id,
                        "capability": item.capability,
                        "confidence": item.confidence,
                        "confirmedAt": item.confirmed_at,
                        "output": item.output,
                        "evidenceRefs": item.evidence_refs,
                    }
                    for item in accepted_agent_runs
                ],
                "reviewLogs": [
                    {
                        "id": item.id,
                        "action": item.action,
                        "reason": item.reason,
                        "actorId": item.actor_id,
                        "actorDisplayName": (
                            (actor.display_name or actor.username)
                            if item.actor_id and (actor := session.get(User, item.actor_id))
                            else None
                        ),
                        "createdAt": item.created_at,
                    }
                    for item in logs
                ],
            }
        )

    by_town: dict[str, list[dict[str, Any]]] = {}
    for record in record_payloads:
        by_town.setdefault(record["town"], []).append(record)

    if by_town:
        town_query = select(Town).where(Town.name.in_(by_town.keys()))
        if project_id:
            town_query = town_query.where(Town.city_id == project_id)
        catalog_towns = list(session.scalars(town_query).all())
    else:
        catalog_towns = []

    catalog_by_name = {town.name: town for town in catalog_towns}
    ordered_town_names = sorted(
        {*catalog_by_name.keys(), *by_town.keys()},
        key=lambda name: (_chapter_sort_key(catalog_by_name.get(name).chapter_code if catalog_by_name.get(name) else None), name),
    )
    for town_name in ordered_town_names:
        town_records = by_town.get(town_name, [])
        town = catalog_by_name.get(town_name)
        town_payloads.append(
            {
                "town": town_name,
                "townId": town.id if town else None,
                "chapterCode": town.chapter_code if town else None,
                "assessmentTargets": town.assessment_targets if town else [],
                "assessmentObject": town.assessment_object if town else {},
                "reportTemplate": town.report_template if town else {},
                "recordCount": len(town_records),
                "submittedCount": sum(1 for item in town_records if item["status"] == "submitted"),
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
    project = session.get(City, project_id) if project_id else None
    snapshot = {
        "cycleId": cycle.id if cycle else None,
        "cycleName": cycle.name if cycle else None,
        "projectId": project_id,
        "projectName": project.name if project else None,
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
        "townIds": [catalog_by_name[name].id for name in ordered_town_names if catalog_by_name.get(name) is not None],
    }
    normalized = _normalize(snapshot)
    normalized["hash"] = _hash_payload(normalized)
    return normalized


def validate_report_dataset(snapshot: dict[str, Any]) -> None:
    if not snapshot.get("records"):
        raise RuntimeError("没有可用于生成报告的已提交、已复核或已锁定考核记录。")
    missing_versions = [item["id"] for item in snapshot["records"] if not item.get("indicatorVersionId")]
    if missing_versions:
        raise RuntimeError("生成报告前，每条考核记录都需要绑定评分标准版本。")
    missing_scores = [item["id"] for item in snapshot["records"] if item.get("scoreCount", 0) <= 0]
    if missing_scores:
        raise RuntimeError("生成报告前，每条已选择记录都至少需要一条评分明细。")
    incomplete = [item["id"] for item in snapshot["records"] if any(not entry.get("done") for entry in ((item.get("rawPayload") or {}).get("entries") or {}).values())]
    if incomplete:
        raise RuntimeError("生成报告前，所有评分项都需要完成检查。")
