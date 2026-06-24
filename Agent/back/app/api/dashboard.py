from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.models import AssessmentRecord, Town, Village


router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/towns")
def towns(session: Session = Depends(get_session)):
    rows = session.execute(select(Town, func.count(AssessmentRecord.id)).outerjoin(AssessmentRecord, AssessmentRecord.town_id == Town.id).group_by(Town.id).order_by(Town.name)).all()
    return {"items": [{"id": town.id, "name": town.name, "recordCount": count, "completedCount": count, "villageCount": max(count, 1), "status": "completed" if count else "pending"} for town, count in rows]}


@router.get("/overview")
def overview(session: Session = Depends(get_session)):
    total = session.scalar(select(func.count(AssessmentRecord.id))) or 0
    submitted = session.scalar(select(func.count(AssessmentRecord.id)).where(AssessmentRecord.status == "submitted")) or 0
    return {"totalRecords": total, "submittedRecords": submitted, "completionRate": round(submitted / total * 100, 1) if total else 0}


@router.get("/issues")
def issues(session: Session = Depends(get_session)):
    items = []
    for record in session.scalars(select(AssessmentRecord).where(AssessmentRecord.status.in_(["submitted", "reviewed", "locked"]))).all():
        for entry in record.raw_payload.get("entries", []):
            deduction = entry.get("deduction") or entry.get("deduct") or 0
            if deduction:
                items.append({"recordId": record.id, "town": record.town.name, "reason": entry.get("reason", "现场扣分项"), "deduction": deduction})
    return {"items": items}


@router.get("/deduction-ranking")
def deduction_ranking(session: Session = Depends(get_session)):
    totals: dict[str, float] = {}
    for record in session.scalars(select(AssessmentRecord)).all():
        totals[record.town.name] = totals.get(record.town.name, 0) + sum(float(entry.get("deduction") or entry.get("deduct") or 0) for entry in record.raw_payload.get("entries", []))
    return {"items": [{"town": town, "deduction": value} for town, value in sorted(totals.items(), key=lambda item: item[1], reverse=True)]}


@router.get("/villages")
def villages(town_id: str | None = None, session: Session = Depends(get_session)):
    query = select(Village)
    if town_id:
        query = query.where(Village.town_id == town_id)
    return {"items": [{"id": village.id, "name": village.name, "townId": village.town_id} for village in session.scalars(query).all()]}
