from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.storage import save_upload
from app.models import AssessmentCycle, AssessmentRecord, Attachment, City, DeductionOption, Indicator, IndicatorVersion, Town, Village


router = APIRouter(prefix="/api/mobile", tags=["mobile"])


def _record_payload(record: AssessmentRecord) -> dict[str, Any]:
    return {"id": record.id, "status": record.status, "town": record.town.name, "period": record.raw_payload.get("period", "2023年下半年度"), "createdAt": record.created_at.isoformat(), "updatedAt": record.updated_at.isoformat()}


@router.get("/cities")
def cities(session: Session = Depends(get_session)):
    return {"items": [{"id": city.id, "name": city.name} for city in session.scalars(select(City)).all()]}


@router.get("/assessment-cycles")
def cycles(city_id: str | None = None, session: Session = Depends(get_session)):
    statement = select(AssessmentCycle)
    if city_id:
        statement = statement.where(AssessmentCycle.city_id == city_id)
    return {"items": [{"id": item.id, "name": item.name, "status": item.status} for item in session.scalars(statement).all()]}


@router.get("/towns")
def towns(session: Session = Depends(get_session)):
    return {"items": [{"id": town.id, "name": town.name} for town in session.scalars(select(Town).order_by(Town.name)).all()]}


@router.get("/towns/{town_id}/villages")
def villages(town_id: str, session: Session = Depends(get_session)):
    town = session.get(Town, town_id) or session.scalar(select(Town).where(Town.name == town_id))
    if town is None: raise HTTPException(status_code=404, detail="Town not found")
    return {"items": [{"id": village.id, "name": village.name} for village in session.scalars(select(Village).where(Village.town_id == town.id)).all()]}


@router.get("/indicator-standards")
def indicator_standards(cycle_id: str | None = None, facility_type: str | None = None, session: Session = Depends(get_session)):
    version_query = select(IndicatorVersion).where(IndicatorVersion.status == "published")
    if cycle_id: version_query = version_query.where(IndicatorVersion.cycle_id == cycle_id)
    version = session.scalar(version_query)
    if version is None: return {"version": None, "items": []}
    indicators = list(session.scalars(select(Indicator).where(Indicator.version_id == version.id).order_by(Indicator.sort_order)))
    option_map = {item.id: [] for item in indicators}
    for option in session.scalars(select(DeductionOption).where(DeductionOption.indicator_id.in_(option_map))).all():
        option_map[option.indicator_id].append({"id": option.id, "name": option.name, "deduction": option.deduction_value, "requiresPhoto": option.requires_photo})
    items = [{"id": item.id, "parentId": item.parent_id, "code": item.code, "name": item.name, "level": item.level, "fullScore": item.full_score, "facilityType": item.facility_type, "deductionOptions": option_map[item.id]} for item in indicators if not facility_type or not item.facility_type or item.facility_type == facility_type]
    return {"version": {"id": version.id, "name": version.name}, "items": items}


@router.post("/assessment-records")
def create_record(payload: dict[str, Any], session: Session = Depends(get_session)):
    raw = payload.get("data") if set(payload) == {"data"} and isinstance(payload.get("data"), dict) else payload
    town_name = raw.get("town") or raw.get("townName")
    town = session.scalar(select(Town).where(Town.name == town_name))
    if town is None:
        raise HTTPException(status_code=422, detail="A valid town is required")
    city = session.get(City, town.city_id)
    cycle = session.scalar(select(AssessmentCycle).where(AssessmentCycle.city_id == city.id, AssessmentCycle.status == "active"))
    record = AssessmentRecord(city_id=city.id, cycle_id=cycle.id, town_id=town.id, status=raw.get("status", "draft"), raw_payload=raw)
    session.add(record)
    session.commit()
    session.refresh(record)
    return _record_payload(record)


@router.put("/assessment-records/{record_id}/scores")
def update_scores(record_id: str, payload: dict[str, Any], session: Session = Depends(get_session)):
    record = session.get(AssessmentRecord, record_id)
    if record is None: raise HTTPException(status_code=404, detail="Record not found")
    if record.status == "locked": raise HTTPException(status_code=409, detail="Record is locked")
    record.raw_payload = {**record.raw_payload, "entries": payload.get("entries", payload)}
    session.commit()
    return _record_payload(record)


@router.put("/assessment-records/{record_id}/surveys")
def update_surveys(record_id: str, payload: dict[str, Any], session: Session = Depends(get_session)):
    record = session.get(AssessmentRecord, record_id)
    if record is None: raise HTTPException(status_code=404, detail="Record not found")
    record.raw_payload = {**record.raw_payload, "surveys": payload}
    session.commit()
    return _record_payload(record)


@router.put("/assessment-records/{record_id}/water-quality")
def update_water_quality(record_id: str, payload: dict[str, Any], session: Session = Depends(get_session)):
    record = session.get(AssessmentRecord, record_id)
    if record is None: raise HTTPException(status_code=404, detail="Record not found")
    record.raw_payload = {**record.raw_payload, "waterQuality": payload}
    session.commit()
    return _record_payload(record)


@router.post("/assessment-records/{record_id}/attachments")
def upload_attachment(record_id: str, file: UploadFile = File(...), session: Session = Depends(get_session)):
    if session.get(AssessmentRecord, record_id) is None: raise HTTPException(status_code=404, detail="Record not found")
    storage_key, size = save_upload(file, "attachments")
    attachment = Attachment(record_id=record_id, filename=file.filename or "attachment", storage_key=storage_key, content_type=file.content_type, size=size)
    session.add(attachment)
    session.commit()
    return {"id": attachment.id, "filename": attachment.filename, "size": attachment.size}


@router.post("/assessment-records/{record_id}/submit")
def submit_record(record_id: str, session: Session = Depends(get_session)):
    record = session.get(AssessmentRecord, record_id)
    if record is None: raise HTTPException(status_code=404, detail="Record not found")
    record.status = "submitted"
    record.submitted_at = datetime.now(timezone.utc)
    session.commit()
    return _record_payload(record)
