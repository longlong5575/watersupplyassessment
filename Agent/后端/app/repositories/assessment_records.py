from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AssessmentRecord


class AssessmentRecordRepository:
    def __init__(self, session: Session):
        self.session = session

    def get(self, record_id: str) -> AssessmentRecord | None:
        return self.session.get(AssessmentRecord, record_id)

    def list_for_cycle(self, cycle_id: str) -> list[AssessmentRecord]:
        return list(self.session.scalars(select(AssessmentRecord).where(AssessmentRecord.cycle_id == cycle_id)))

    def save(self, record: AssessmentRecord) -> AssessmentRecord:
        self.session.add(record)
        self.session.commit()
        self.session.refresh(record)
        return record
