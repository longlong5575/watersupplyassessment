from copy import deepcopy

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.models import DeductionOption, Indicator, IndicatorVersion


router = APIRouter(prefix="/api/indicator-versions", tags=["standards"])


@router.get("")
def list_versions(session: Session = Depends(get_session)):
    return {"items": [{"id": item.id, "name": item.name, "status": item.status, "locked": item.locked} for item in session.scalars(select(IndicatorVersion)).all()]}


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
