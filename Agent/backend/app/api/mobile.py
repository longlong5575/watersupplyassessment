from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import current_user
from app.core.storage import save_upload
from app.models import AssessmentCycle, AssessmentRecord, Attachment, City, DeductionOption, Indicator, IndicatorVersion, Town, User, Village
from app.services.assessment_ingest import (
    create_assessment_record,
    split_town_package,
    submit_record as mark_record_submitted,
    sync_scores,
    sync_surveys,
    sync_water_quality,
    unwrap_payload,
)
from app.services.project_catalog import PROJECT_CATALOG, project_by_name
from app.services.standard_names import clean_standard_name


router = APIRouter(prefix="/api/mobile", tags=["mobile"])
PROJECT_NAMES = {"郁南项目", "茂南项目"}


def _record_payload(record: AssessmentRecord) -> dict[str, Any]:
    return {
        "id": record.id,
        "status": record.status,
        "cityId": record.city_id,
        "cycleId": record.cycle_id,
        "townId": record.town_id,
        "town": record.town.name,
        "villageId": record.village_id,
        "indicatorVersionId": record.indicator_version_id,
        "totalScore": float(record.total_score) if record.total_score is not None else None,
        "period": record.raw_payload.get("period", "2026年第2季度"),
        "createdAt": record.created_at.isoformat(),
        "updatedAt": record.updated_at.isoformat(),
    }


@router.get("/cities")
def cities(session: Session = Depends(get_session)):
    return {"items": [{"id": city.id, "name": city.name} for city in session.scalars(select(City)).all()]}


@router.get("/projects")
def projects(session: Session = Depends(get_session)):
    statement = select(City).where(City.name.in_(PROJECT_NAMES)).order_by(City.name)
    items = []
    for city in session.scalars(statement).all():
        catalog = project_by_name(city.name) or {}
        items.append({
            "id": city.id,
            "name": city.name,
            "fullName": catalog.get("fullName", city.name),
            "standardScope": clean_standard_name(catalog.get("standard", city.name)),
            "sourceReport": catalog.get("sourceReport"),
        })
    return {"items": items}


@router.get("/projects/{city_id}/report-template")
def project_report_template(city_id: str, session: Session = Depends(get_session)):
    city = session.get(City, city_id)
    if city is None:
        raise HTTPException(status_code=404, detail="Project not found")
    catalog = project_by_name(city.name)
    if catalog is None:
        raise HTTPException(status_code=404, detail="Project template not found")
    return {
        "projectId": city.id,
        "projectName": city.name,
        "fullName": catalog["fullName"],
        "sourceReport": catalog["sourceReport"],
        "towns": catalog["towns"],
    }


@router.get("/assessment-cycles")
def cycles(city_id: str | None = None, session: Session = Depends(get_session)):
    statement = select(AssessmentCycle)
    if city_id:
        statement = statement.where(AssessmentCycle.city_id == city_id)
    return {"items": [{"id": item.id, "name": item.name, "status": item.status} for item in session.scalars(statement).all()]}


@router.get("/towns")
def towns(city_id: str | None = None, session: Session = Depends(get_session)):
    statement = select(Town).where(Town.is_active.is_(True))
    if city_id:
        statement = statement.where(Town.city_id == city_id)
    return {"items": [{
        "id": town.id,
        "cityId": town.city_id,
        "name": town.name,
        "chapterCode": town.chapter_code,
        "assessmentTargets": town.assessment_targets or [],
        "assessmentObject": town.assessment_object or {},
        "reportTemplate": town.report_template or {},
    } for town in session.scalars(statement.order_by(Town.sort_order, Town.name)).all()]}


@router.get("/towns/{town_id}/villages")
def villages(town_id: str, city_id: str | None = None, session: Session = Depends(get_session)):
    town = session.get(Town, town_id)
    if town is None:
        statement = select(Town).where(Town.name == town_id)
        if city_id:
            statement = statement.where(Town.city_id == city_id)
        town = session.scalar(statement)
    if town is None: raise HTTPException(status_code=404, detail="Town not found")
    statement = select(Village).where(Village.town_id == town.id, Village.is_active.is_(True)).order_by(Village.sort_order, Village.name)
    return {"items": [{
        "id": village.id,
        "name": village.name,
        "administrativeVillage": village.administrative_village,
        "chapterCode": village.chapter_code,
        "assessmentObject": village.assessment_object or {},
        "reportTemplate": village.report_template or {},
    } for village in session.scalars(statement).all()]}


@router.get("/indicator-standards")
def indicator_standards(city_id: str | None = None, cycle_id: str | None = None, facility_type: str | None = None, session: Session = Depends(get_session)):
    version_query = select(IndicatorVersion).where(IndicatorVersion.status == "published")
    if city_id: version_query = version_query.where(IndicatorVersion.city_id == city_id)
    if cycle_id: version_query = version_query.where(IndicatorVersion.cycle_id == cycle_id)
    version = session.scalar(version_query.order_by(IndicatorVersion.created_at.desc()))
    if version is None: return {"version": None, "items": []}
    indicators = list(session.scalars(select(Indicator).where(Indicator.version_id == version.id, Indicator.enabled.is_(True)).order_by(Indicator.sort_order)))
    option_map = {item.id: [] for item in indicators}
    for option in session.scalars(select(DeductionOption).where(DeductionOption.indicator_id.in_(option_map))).all():
        meta = option.meta if isinstance(option.meta, dict) else {}
        option_map[option.indicator_id].append(
            {
                "id": option.id,
                "name": option.name,
                "deduction": option.deduction_value,
                "type": option.deduction_type,
                "requiresPhoto": option.requires_photo,
                "unit": meta.get("unit"),
                "maxInstances": meta.get("maxInstances"),
            }
        )
    items = [{"id": item.id, "parentId": item.parent_id, "code": item.code, "name": item.name, "level": item.level, "fullScore": item.full_score, "facilityType": item.facility_type, "deductionOptions": option_map[item.id]} for item in indicators if not facility_type or not item.facility_type or item.facility_type == facility_type]
    return {"version": {"id": version.id, "name": clean_standard_name(version.name)}, "items": items}


@router.post("/assessment-records")
def create_record(payload: dict[str, Any], session: Session = Depends(get_session), user: User = Depends(current_user)):
    raw = unwrap_payload(payload)
    try:
        records = [create_assessment_record(session, item) for item in split_town_package(raw)]
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    session.commit()
    for record in records:
        session.refresh(record)
    response = _record_payload(records[0])
    response["recordIds"] = [record.id for record in records]
    return response


@router.get("/assessment-records")
def list_mobile_records(
    city_id: str | None = None,
    cycle_id: str | None = None,
    period: str | None = None,
    session: Session = Depends(get_session),
    user: User = Depends(current_user),
):
    statement = select(AssessmentRecord).where(AssessmentRecord.status.in_(["submitted", "returned", "reviewed", "locked"]))
    if city_id:
        statement = statement.where(AssessmentRecord.city_id == city_id)
    if cycle_id:
        statement = statement.where(AssessmentRecord.cycle_id == cycle_id)
    elif period:
        cycle_statement = select(AssessmentCycle.id).where(AssessmentCycle.name == period)
        if city_id:
            cycle_statement = cycle_statement.where(AssessmentCycle.city_id == city_id)
        matching_cycle_id = session.scalar(cycle_statement)
        if matching_cycle_id is None:
            return {"items": []}
        statement = statement.where(AssessmentRecord.cycle_id == matching_cycle_id)
    records = session.scalars(statement.order_by(AssessmentRecord.updated_at.desc())).all()
    return {
        "items": [
            {
                **_record_payload(record),
                "raw": record.raw_payload or {},
                "editable": record.status in {"submitted", "returned"},
            }
            for record in records
        ]
    }


@router.put("/assessment-records/{record_id}/scores")
def update_scores(record_id: str, payload: dict[str, Any], session: Session = Depends(get_session), user: User = Depends(current_user)):
    record = session.get(AssessmentRecord, record_id)
    if record is None: raise HTTPException(status_code=404, detail="Record not found")
    if record.status == "locked": raise HTTPException(status_code=409, detail="Record is locked")
    entries = payload.get("entries", payload)
    record.raw_payload = {**record.raw_payload, "entries": entries}
    sync_scores(session, record, entries)
    session.commit()
    return _record_payload(record)


@router.put("/assessment-records/{record_id}/surveys")
def update_surveys(record_id: str, payload: dict[str, Any], session: Session = Depends(get_session), user: User = Depends(current_user)):
    record = session.get(AssessmentRecord, record_id)
    if record is None: raise HTTPException(status_code=404, detail="Record not found")
    if record.status == "locked": raise HTTPException(status_code=409, detail="Record is locked")
    record.raw_payload = {**record.raw_payload, "surveyEntries": payload}
    sync_surveys(session, record, payload)
    session.commit()
    return _record_payload(record)


@router.put("/assessment-records/{record_id}/water-quality")
def update_water_quality(record_id: str, payload: dict[str, Any], session: Session = Depends(get_session), user: User = Depends(current_user)):
    record = session.get(AssessmentRecord, record_id)
    if record is None: raise HTTPException(status_code=404, detail="Record not found")
    if record.status == "locked": raise HTTPException(status_code=409, detail="Record is locked")
    record.raw_payload = {**record.raw_payload, "waterQuality": payload}
    sync_water_quality(session, record, payload)
    session.commit()
    return _record_payload(record)


@router.post("/assessment-records/{record_id}/attachments")
def upload_attachment(
    record_id: str,
    file: UploadFile = File(...),
    score_id: str | None = Form(default=None),
    deduction_option_id: str | None = Form(default=None),
    session: Session = Depends(get_session),
    user: User = Depends(current_user),
):
    record = session.get(AssessmentRecord, record_id)
    if record is None: raise HTTPException(status_code=404, detail="Record not found")
    if record.status == "locked": raise HTTPException(status_code=409, detail="Record is locked")
    if score_id and not any(score.id == score_id for score in record.scores):
        raise HTTPException(status_code=422, detail="Score not found for this record")
    if deduction_option_id and session.get(DeductionOption, deduction_option_id) is None:
        raise HTTPException(status_code=422, detail="Deduction option not found")
    storage_key, size = save_upload(file, "attachments")
    attachment = Attachment(record_id=record_id, score_id=score_id, deduction_option_id=deduction_option_id, filename=file.filename or "attachment", storage_key=storage_key, content_type=file.content_type, size=size)
    session.add(attachment)
    session.commit()
    return {"id": attachment.id, "filename": attachment.filename, "size": attachment.size, "scoreId": score_id, "deductionOptionId": deduction_option_id}


@router.post("/assessment-records/{record_id}/submit")
def submit_record(record_id: str, session: Session = Depends(get_session), user: User = Depends(current_user)):
    record = session.get(AssessmentRecord, record_id)
    if record is None: raise HTTPException(status_code=404, detail="Record not found")
    if record.status == "locked": raise HTTPException(status_code=409, detail="Record is locked")
    try:
        mark_record_submitted(session, record)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    session.commit()
    return _record_payload(record)
