from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.models import AssessmentRecord
from app.schemas import RecordPatch
from app.services.review import review_record


router = APIRouter(tags=["records"])


def serialize(record: AssessmentRecord) -> dict[str, Any]:
    return {"id": record.id, "status": record.status, "town": record.town.name, "raw": record.raw_payload, "createdAt": record.created_at.isoformat(), "updatedAt": record.updated_at.isoformat()}


@router.get("/api/records")
def list_records(status: str | None = None, town: str | None = None, session: Session = Depends(get_session)):
    query = select(AssessmentRecord)
    if status: query = query.where(AssessmentRecord.status == status)
    items = session.scalars(query.order_by(AssessmentRecord.updated_at.desc())).all()
    return {"items": [serialize(item) for item in items if not town or item.town.name == town]}


@router.get("/api/records/{record_id}")
def get_record(record_id: str, session: Session = Depends(get_session)):
    record = session.get(AssessmentRecord, record_id)
    if record is None: raise HTTPException(status_code=404, detail="Record not found")
    return serialize(record)


@router.put("/api/records/{record_id}")
def update_record(record_id: str, payload: RecordPatch, session: Session = Depends(get_session)):
    record = session.get(AssessmentRecord, record_id)
    if record is None: raise HTTPException(status_code=404, detail="Record not found")
    if record.status == "locked": raise HTTPException(status_code=409, detail="Record is locked")
    record.raw_payload = {**record.raw_payload, **payload.data}
    session.commit()
    return serialize(record)


@router.delete("/api/records/{record_id}")
def delete_record(record_id: str, session: Session = Depends(get_session)):
    record = session.get(AssessmentRecord, record_id)
    if record is None: raise HTTPException(status_code=404, detail="Record not found")
    if record.status == "locked": raise HTTPException(status_code=409, detail="Record is locked")
    session.delete(record)
    session.commit()
    return {"id": record_id, "deleted": True}


@router.post("/api/records/{record_id}/review")
def review(record_id: str, session: Session = Depends(get_session)):
    return serialize(review_record(session, record_id, "review"))


@router.post("/api/records/{record_id}/return")
def return_for_correction(record_id: str, payload: RecordPatch, session: Session = Depends(get_session)):
    return serialize(review_record(session, record_id, "return", payload.reason))


@router.post("/api/records/{record_id}/lock")
def lock_record(record_id: str, session: Session = Depends(get_session)):
    return serialize(review_record(session, record_id, "lock"))


@router.post("/api/assessment-cycles/{cycle_id}/lock")
def lock_cycle(cycle_id: str, session: Session = Depends(get_session)):
    records = session.scalars(select(AssessmentRecord).where(AssessmentRecord.cycle_id == cycle_id)).all()
    for record in records:
        if record.status == "reviewed": review_record(session, record.id, "lock")
    return {"cycleId": cycle_id, "lockedRecords": len(records)}
