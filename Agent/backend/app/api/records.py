from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import admin_user
from app.models import (
    AssessmentCycle,
    AssessmentRecord,
    AssessmentScore,
    Attachment,
    City,
    DeductionOption,
    Indicator,
    IndicatorVersion,
    ReviewLog,
    SurveyRecord,
    Village,
    WaterQualityRecord,
)
from app.schemas import RecordPatch, ScorePatch
from app.services.assessment_ingest import sync_scores, sync_surveys, sync_water_quality
from app.services.review import review_record


router = APIRouter(tags=["records"])


def _has_missing_deduction_photo(record: AssessmentRecord, attachments: list[Attachment]) -> bool:
    deduction_score_ids = {
        score.id
        for score in record.scores
        if float(score.deduction or 0) > 0 and score.source in {"manual", "review"}
    }
    if not deduction_score_ids:
        return False
    attached_score_ids = {attachment.score_id for attachment in attachments if attachment.score_id}
    return bool(deduction_score_ids - attached_score_ids)


def serialize(record: AssessmentRecord, session: Session) -> dict[str, Any]:
    indicator_ids = [item.indicator_id for item in record.scores if item.indicator_id]
    option_ids = [item.deduction_option_id for item in record.scores if item.deduction_option_id]
    indicators = {item.id: item for item in session.scalars(select(Indicator).where(Indicator.id.in_(indicator_ids))).all()} if indicator_ids else {}
    options = {item.id: item for item in session.scalars(select(DeductionOption).where(DeductionOption.id.in_(option_ids))).all()} if option_ids else {}
    scores = [
        {
            "id": item.id,
            "indicatorId": item.indicator_id,
            "indicatorName": indicators[item.indicator_id].name if item.indicator_id in indicators else None,
            "indicatorFullScore": indicators[item.indicator_id].full_score if item.indicator_id in indicators else None,
            "deductionOptionId": item.deduction_option_id,
            "deductionOptionName": options[item.deduction_option_id].name if item.deduction_option_id in options else None,
            "score": float(item.score) if item.score is not None else None,
            "deduction": float(item.deduction),
            "reason": item.reason,
            "source": item.source,
        }
        for item in record.scores
    ]
    city = session.get(City, record.city_id)
    cycle = session.get(AssessmentCycle, record.cycle_id)
    village = session.get(Village, record.village_id) if record.village_id else None
    version = session.get(IndicatorVersion, record.indicator_version_id) if record.indicator_version_id else None
    raw_payload = record.raw_payload or {}
    primary_facility_type = raw_payload.get("primaryFacilityType") or raw_payload.get("facilityScope") or raw_payload.get("facilityType")
    standard_facility_type = raw_payload.get("standardFacilityType") or raw_payload.get("facilityType")
    facility_type_label = {
        "town_plant": "镇街污水厂",
        "town_network": "镇街污水收集管网",
        "rural_treatment": "农村污水处理设施",
        "treatment": "污水处理设施",
        "network": "污水收集管网",
    }.get(str(primary_facility_type or ""), str(primary_facility_type or standard_facility_type or ""))
    return {
        "id": record.id,
        "status": record.status,
        "cityId": record.city_id,
        "cityName": city.name if city else None,
        "projectId": record.city_id,
        "projectName": city.name if city else None,
        "cycleId": record.cycle_id,
        "cycleName": cycle.name if cycle else None,
        "townId": record.town_id,
        "town": record.town.name,
        "villageId": record.village_id,
        "villageName": village.name if village else None,
        "indicatorVersionId": record.indicator_version_id,
        "indicatorVersionName": version.name if version else None,
        "primaryFacilityType": primary_facility_type,
        "standardFacilityType": standard_facility_type,
        "facilityTypeLabel": facility_type_label,
        "totalScore": float(record.total_score) if record.total_score is not None else None,
        "scores": scores,
        "raw": record.raw_payload,
        "submittedAt": record.submitted_at.isoformat() if record.submitted_at else None,
        "reviewedAt": record.reviewed_at.isoformat() if record.reviewed_at else None,
        "lockedAt": record.locked_at.isoformat() if record.locked_at else None,
        "createdAt": record.created_at.isoformat(),
        "updatedAt": record.updated_at.isoformat(),
    }


@router.get("/api/records")
def list_records(status: str | None = None, town: str | None = None, risk: str | None = None, session: Session = Depends(get_session)):
    query = select(AssessmentRecord)
    if status: query = query.where(AssessmentRecord.status == status)
    items = session.scalars(query.order_by(AssessmentRecord.updated_at.desc())).all()
    filtered = [item for item in items if not town or item.town.name == town]
    if risk == "low_score":
        filtered = [item for item in filtered if item.total_score is not None and float(item.total_score) < 80]
    elif risk == "missing_photo":
        record_ids = [item.id for item in filtered]
        attachments = list(session.scalars(select(Attachment).where(Attachment.record_id.in_(record_ids))).all()) if record_ids else []
        attachments_by_record: dict[str, list[Attachment]] = {}
        for attachment in attachments:
            if attachment.record_id:
                attachments_by_record.setdefault(attachment.record_id, []).append(attachment)
        filtered = [item for item in filtered if _has_missing_deduction_photo(item, attachments_by_record.get(item.id, []))]
    return {"items": [serialize(item, session) for item in filtered]}


@router.get("/api/records/{record_id}")
def get_record(record_id: str, session: Session = Depends(get_session)):
    record = session.get(AssessmentRecord, record_id)
    if record is None: raise HTTPException(status_code=404, detail="Record not found")
    data = serialize(record, session)
    data["surveys"] = [
        {"id": item.id, "surveyType": item.survey_type, "respondent": item.respondent, "score": item.score, "payload": item.payload}
        for item in session.scalars(select(SurveyRecord).where(SurveyRecord.record_id == record.id)).all()
    ]
    data["waterQuality"] = [
        {"id": item.id, "sampledAt": item.sampled_at.isoformat() if item.sampled_at else None, "conclusion": item.conclusion, "payload": item.payload}
        for item in session.scalars(select(WaterQualityRecord).where(WaterQualityRecord.record_id == record.id)).all()
    ]
    data["attachments"] = [
        {"id": item.id, "scoreId": item.score_id, "deductionOptionId": item.deduction_option_id, "filename": item.filename, "storageKey": item.storage_key, "size": item.size}
        for item in session.scalars(select(Attachment).where(Attachment.record_id == record.id)).all()
    ]
    data["reviewLogs"] = [
        {
            "id": item.id,
            "action": item.action,
            "reason": item.reason,
            "beforePayload": item.before_payload,
            "afterPayload": item.after_payload,
            "createdAt": item.created_at.isoformat(),
        }
        for item in session.scalars(select(ReviewLog).where(ReviewLog.record_id == record.id).order_by(ReviewLog.created_at.desc())).all()
    ]
    return data


@router.put("/api/records/{record_id}")
def update_record(record_id: str, payload: RecordPatch, session: Session = Depends(get_session), user=Depends(admin_user)):
    record = session.get(AssessmentRecord, record_id)
    if record is None: raise HTTPException(status_code=404, detail="Record not found")
    if record.status == "locked": raise HTTPException(status_code=409, detail="Record is locked")
    record.raw_payload = {**record.raw_payload, **payload.data}
    if "entries" in payload.data:
        sync_scores(session, record, payload.data["entries"])
    if "surveys" in payload.data:
        sync_surveys(session, record, payload.data["surveys"])
    if "waterQuality" in payload.data:
        sync_water_quality(session, record, payload.data["waterQuality"])
    session.commit()
    return serialize(record, session)


@router.put("/api/records/{record_id}/scores")
def update_record_scores(record_id: str, payload: ScorePatch, session: Session = Depends(get_session), user=Depends(admin_user)):
    record = session.get(AssessmentRecord, record_id)
    if record is None: raise HTTPException(status_code=404, detail="Record not found")
    if record.status == "locked": raise HTTPException(status_code=409, detail="Record is locked")
    before = {
        "scores": [
            {"id": item.id, "score": float(item.score) if item.score is not None else None, "deduction": float(item.deduction), "reason": item.reason}
            for item in record.scores
        ]
    }
    score_ids = {item.id for item in record.scores}
    for item in payload.scores:
        if item.id not in score_ids:
            raise HTTPException(status_code=422, detail=f"Score {item.id} does not belong to this record")
        score = session.get(AssessmentScore, item.id)
        if score is None:
            continue
        if item.score is not None:
            score.score = max(item.score, 0)
        if item.deduction is not None:
            score.deduction = max(item.deduction, 0)
        if item.reason is not None:
            score.reason = item.reason
        score.source = "review"
    session.flush()
    total = sum(float(item.score or 0) for item in record.scores)
    record.total_score = total
    after = {
        "scores": [
            {"id": item.id, "score": float(item.score) if item.score is not None else None, "deduction": float(item.deduction), "reason": item.reason}
            for item in record.scores
        ]
    }
    session.add(ReviewLog(record_id=record.id, actor_id=user.id, action="score_update", reason=payload.reason, before_payload=before, after_payload=after))
    session.commit()
    session.refresh(record)
    return serialize(record, session)


@router.delete("/api/records/{record_id}")
def delete_record(record_id: str, session: Session = Depends(get_session), user=Depends(admin_user)):
    record = session.get(AssessmentRecord, record_id)
    if record is None: raise HTTPException(status_code=404, detail="Record not found")
    if record.status == "locked": raise HTTPException(status_code=409, detail="Record is locked")
    session.delete(record)
    session.commit()
    return {"id": record_id, "deleted": True}


@router.post("/api/records/{record_id}/review")
def review(record_id: str, session: Session = Depends(get_session), user=Depends(admin_user)):
    return serialize(review_record(session, record_id, "review"), session)


@router.post("/api/records/{record_id}/return")
def return_for_correction(record_id: str, payload: RecordPatch, session: Session = Depends(get_session), user=Depends(admin_user)):
    return serialize(review_record(session, record_id, "return", payload.reason), session)


@router.post("/api/records/{record_id}/lock")
def lock_record(record_id: str, session: Session = Depends(get_session), user=Depends(admin_user)):
    return serialize(review_record(session, record_id, "lock"), session)


@router.post("/api/assessment-cycles/{cycle_id}/lock")
def lock_cycle(cycle_id: str, session: Session = Depends(get_session), user=Depends(admin_user)):
    records = session.scalars(select(AssessmentRecord).where(AssessmentRecord.cycle_id == cycle_id)).all()
    for record in records:
        if record.status == "reviewed": review_record(session, record.id, "lock")
    return {"cycleId": cycle_id, "lockedRecords": len(records)}
