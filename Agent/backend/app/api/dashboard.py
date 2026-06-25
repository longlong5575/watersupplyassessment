from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.models import AssessmentRecord, AssessmentScore, Attachment, City, SurveyRecord, Town, Village, WaterQualityRecord


router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


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


@router.get("/towns")
def towns(city_id: str | None = None, town_id: str | None = None, session: Session = Depends(get_session)):
    query = select(Town).order_by(Town.name)
    if city_id:
        query = query.where(Town.city_id == city_id)
    if town_id:
        query = query.where(Town.id == town_id)
    rows = session.scalars(query).all()
    items = []
    completed_town_count = 0
    inprogress_town_count = 0
    pending_town_count = 0
    total_villages = 0
    completed_villages = 0
    for town in rows:
        records = list(session.scalars(select(AssessmentRecord).where(AssessmentRecord.town_id == town.id)).all())
        record_ids = [record.id for record in records]
        completed_count = session.scalar(
            select(func.count(AssessmentRecord.id)).where(
                AssessmentRecord.town_id == town.id,
                AssessmentRecord.status.in_(["submitted", "reviewed", "locked"]),
            )
        ) or 0
        village_count = session.scalar(select(func.count(Village.id)).where(Village.town_id == town.id)) or 0
        deduction_total = 0
        survey_count = 0
        water_quality_count = 0
        attachment_count = 0
        pending_review_count = 0
        reviewed_count = 0
        locked_count = 0
        returned_count = 0
        low_score_count = 0
        missing_photo_count = 0
        if record_ids:
            deduction_total = session.scalar(select(func.coalesce(func.sum(AssessmentScore.deduction), 0)).where(AssessmentScore.record_id.in_(record_ids))) or 0
            survey_count = session.scalar(select(func.count(SurveyRecord.id)).where(SurveyRecord.record_id.in_(record_ids))) or 0
            water_quality_count = session.scalar(select(func.count(WaterQualityRecord.id)).where(WaterQualityRecord.record_id.in_(record_ids))) or 0
            attachment_count = session.scalar(select(func.count(Attachment.id)).where(Attachment.record_id.in_(record_ids))) or 0
            attachments = list(session.scalars(select(Attachment).where(Attachment.record_id.in_(record_ids))).all())
            attachments_by_record: dict[str, list[Attachment]] = {}
            for attachment in attachments:
                if attachment.record_id:
                    attachments_by_record.setdefault(attachment.record_id, []).append(attachment)
            for record in records:
                record_attachments = attachments_by_record.get(record.id, [])
                pending_review_count += 1 if record.status == "submitted" else 0
                reviewed_count += 1 if record.status == "reviewed" else 0
                locked_count += 1 if record.status == "locked" else 0
                returned_count += 1 if record.status == "returned" else 0
                low_score_count += 1 if record.total_score is not None and float(record.total_score) < 80 else 0
                missing_photo_count += 1 if _has_missing_deduction_photo(record, record_attachments) else 0
        if completed_count >= max(village_count, 1):
            status = "completed"
        elif completed_count:
            status = "inprogress"
        else:
            status = "pending"
        completed_town_count += 1 if status == "completed" else 0
        inprogress_town_count += 1 if status == "inprogress" else 0
        pending_town_count += 1 if status == "pending" else 0
        total_villages += max(village_count, len(record_ids), 1)
        completed_villages += completed_count
        city = session.get(City, town.city_id)
        items.append(
            {
                "id": town.id,
                "name": town.name,
                "cityId": town.city_id,
                "cityName": city.name if city else None,
                "recordCount": len(record_ids),
                "completedCount": completed_count,
                "villageCount": max(village_count, len(record_ids), 1),
                "status": status,
                "deductionTotal": float(deduction_total),
                "surveyCount": survey_count,
                "waterQualityCount": water_quality_count,
                "attachmentCount": attachment_count,
                "pendingReviewCount": pending_review_count,
                "reviewedCount": reviewed_count,
                "lockedCount": locked_count,
                "returnedCount": returned_count,
                "lowScoreCount": low_score_count,
                "missingPhotoCount": missing_photo_count,
            }
        )
    return {
        "overview": {
            "cityId": city_id,
            "townCount": len(rows),
            "completedTownCount": completed_town_count,
            "inprogressTownCount": inprogress_town_count,
            "pendingTownCount": pending_town_count,
            "villageCount": total_villages,
            "completedVillageCount": completed_villages,
            "pendingVillageCount": max(total_villages - completed_villages, 0),
        },
        "items": items,
    }


@router.get("/overview")
def overview(session: Session = Depends(get_session)):
    total = session.scalar(select(func.count(AssessmentRecord.id))) or 0
    submitted = session.scalar(select(func.count(AssessmentRecord.id)).where(AssessmentRecord.status == "submitted")) or 0
    return {"totalRecords": total, "submittedRecords": submitted, "completionRate": round(submitted / total * 100, 1) if total else 0}


@router.get("/issues")
def issues(session: Session = Depends(get_session)):
    items = []
    scores = session.execute(
        select(AssessmentScore, AssessmentRecord)
        .join(AssessmentRecord, AssessmentRecord.id == AssessmentScore.record_id)
        .where(AssessmentRecord.status.in_(["submitted", "reviewed", "locked"]), AssessmentScore.deduction > 0)
    ).all()
    for score, record in scores:
        items.append({"recordId": record.id, "scoreId": score.id, "town": record.town.name, "reason": score.reason or "现场扣分项", "deduction": float(score.deduction), "source": score.source})
    return {"items": items}


@router.get("/deduction-ranking")
def deduction_ranking(session: Session = Depends(get_session)):
    totals: dict[str, float] = {}
    rows = session.execute(select(Town.name, func.coalesce(func.sum(AssessmentScore.deduction), 0)).join(AssessmentRecord, AssessmentRecord.town_id == Town.id).join(AssessmentScore, AssessmentScore.record_id == AssessmentRecord.id).group_by(Town.name)).all()
    for town, value in rows:
        totals[town] = float(value)
    return {"items": [{"town": town, "deduction": value} for town, value in sorted(totals.items(), key=lambda item: item[1], reverse=True)]}


@router.get("/villages")
def villages(town_id: str | None = None, session: Session = Depends(get_session)):
    query = select(Village)
    if town_id:
        query = query.where(Village.town_id == town_id)
    return {"items": [{"id": village.id, "name": village.name, "townId": village.town_id} for village in session.scalars(query).all()]}
