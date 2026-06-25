from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import AssessmentRecord, ReviewLog


def review_record(session: Session, record_id: str, action: str, reason: str | None = None) -> AssessmentRecord:
    record = session.get(AssessmentRecord, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found")
    before = {"status": record.status, "raw": record.raw_payload}
    if action == "review":
        record.status, record.reviewed_at = "reviewed", datetime.now(timezone.utc)
    elif action == "return":
        record.status = "returned"
    elif action == "lock":
        record.status, record.locked_at = "locked", datetime.now(timezone.utc)
    else:
        raise HTTPException(status_code=400, detail="Unsupported review action")
    session.add(ReviewLog(record_id=record.id, action=action, reason=reason, before_payload=before, after_payload={"status": record.status}))
    session.commit()
    session.refresh(record)
    return record
