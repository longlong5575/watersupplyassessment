from copy import deepcopy

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.models import AssessmentCycle, City, DeductionOption, Indicator, IndicatorVersion


router = APIRouter(prefix="/api/indicator-versions", tags=["standards"])


@router.get("")
def list_versions(city_id: str | None = None, cycle_id: str | None = None, session: Session = Depends(get_session)):
    statement = select(IndicatorVersion).order_by(IndicatorVersion.created_at.desc())
    if city_id:
        statement = statement.where(IndicatorVersion.city_id == city_id)
    if cycle_id:
        statement = statement.where(IndicatorVersion.cycle_id == cycle_id)
    versions = session.scalars(statement).all()
    counts = dict(
        session.execute(
            select(Indicator.version_id, func.count(Indicator.id))
            .where(Indicator.version_id.in_([item.id for item in versions]), Indicator.enabled.is_(True), Indicator.level == 3)
            .group_by(Indicator.version_id)
        ).all()
    ) if versions else {}
    return {
        "items": [
            {
                "id": item.id,
                "name": item.name,
                "status": item.status,
                "locked": item.locked,
                "cityId": item.city_id,
                "cityName": session.get(City, item.city_id).name if session.get(City, item.city_id) else None,
                "cycleId": item.cycle_id,
                "cycleName": session.get(AssessmentCycle, item.cycle_id).name if session.get(AssessmentCycle, item.cycle_id) else None,
                "indicatorCount": counts.get(item.id, 0),
            }
            for item in versions
        ]
    }


@router.get("/{version_id}")
def get_version(version_id: str, session: Session = Depends(get_session)):
    version = session.get(IndicatorVersion, version_id)
    if version is None:
        raise HTTPException(status_code=404, detail="Indicator version not found")
    indicators = list(session.scalars(select(Indicator).where(Indicator.version_id == version.id, Indicator.enabled.is_(True)).order_by(Indicator.sort_order)).all())
    option_map = {item.id: [] for item in indicators}
    if option_map:
        for option in session.scalars(select(DeductionOption).where(DeductionOption.indicator_id.in_(option_map))).all():
            option_map[option.indicator_id].append(
                {
                    "id": option.id,
                    "name": option.name,
                    "deductionType": option.deduction_type,
                    "deductionValue": option.deduction_value,
                    "requiresPhoto": option.requires_photo,
                }
            )
    return {
        "id": version.id,
        "name": version.name,
        "status": version.status,
        "locked": version.locked,
        "cityId": version.city_id,
        "cycleId": version.cycle_id,
        "items": [
            {
                "id": item.id,
                "parentId": item.parent_id,
                "code": item.code,
                "name": item.name,
                "level": item.level,
                "fullScore": item.full_score,
                "facilityType": item.facility_type,
                "options": option_map[item.id],
            }
            for item in indicators
        ],
    }


@router.post("/{version_id}/clone")
def clone_version(version_id: str, payload: dict, session: Session = Depends(get_session)):
    source = session.get(IndicatorVersion, version_id)
    if source is None: raise HTTPException(status_code=404, detail="Indicator version not found")
    target = IndicatorVersion(city_id=source.city_id, cycle_id=source.cycle_id, name=payload.get("name", f"{source.name}副本"), status="draft")
    session.add(target)
    session.flush()
    id_map = {}
    for item in session.scalars(select(Indicator).where(Indicator.version_id == source.id).order_by(Indicator.sort_order)).all():
        copied = Indicator(version_id=target.id, parent_id=id_map.get(item.parent_id), code=item.code, name=item.name, level=item.level, full_score=item.full_score, sort_order=item.sort_order, facility_type=item.facility_type, enabled=item.enabled)
        session.add(copied)
        session.flush()
        id_map[item.id] = copied.id
        for option in session.scalars(select(DeductionOption).where(DeductionOption.indicator_id == item.id)).all():
            session.add(DeductionOption(indicator_id=copied.id, name=option.name, deduction_type=option.deduction_type, deduction_value=option.deduction_value, requires_photo=option.requires_photo))
    session.commit()
    return {"id": target.id, "name": target.name, "status": target.status}


@router.post("/{version_id}/publish")
def publish_version(version_id: str, session: Session = Depends(get_session)):
    version = session.get(IndicatorVersion, version_id)
    if version is None:
        raise HTTPException(status_code=404, detail="Indicator version not found")
    if version.locked:
        raise HTTPException(status_code=409, detail="Locked version cannot be published")
    for existing in session.scalars(
        select(IndicatorVersion).where(
            IndicatorVersion.city_id == version.city_id,
            IndicatorVersion.cycle_id == version.cycle_id,
            IndicatorVersion.status == "published",
            IndicatorVersion.id != version.id,
        )
    ).all():
        existing.status = "locked"
        existing.locked = True
    version.status = "published"
    version.locked = False
    session.commit()
    return {"id": version.id, "name": version.name, "status": version.status, "locked": version.locked}


@router.post("/{version_id}/lock")
def lock_version(version_id: str, session: Session = Depends(get_session)):
    version = session.get(IndicatorVersion, version_id)
    if version is None:
        raise HTTPException(status_code=404, detail="Indicator version not found")
    version.status = "locked"
    version.locked = True
    session.commit()
    return {"id": version.id, "name": version.name, "status": version.status, "locked": version.locked}
