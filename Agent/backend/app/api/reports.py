from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_session
from app.core.security import admin_user
from app.models import AssessmentCycle, AssessmentRecord, Report, ReportTask, Town
from app.schemas import ReportTaskRequest
from app.services.report_tasks import run_report_task


router = APIRouter(tags=["reports"])


def serialize_report(item: Report) -> dict:
    return {"id": item.id, "name": item.name, "status": item.status, "size": item.size, "createdAt": item.created_at.isoformat(), "town": item.town_id}


@router.post("/api/report-tasks")
def create_task(payload: ReportTaskRequest, session: Session = Depends(get_session), user=Depends(admin_user)):
    cycle = session.scalar(select(AssessmentCycle).where(AssessmentCycle.name == payload.period))
    if cycle is None:
        cycle = session.scalar(select(AssessmentCycle).where(AssessmentCycle.status == "active"))
    task_payload = payload.model_dump()
    if payload.townIds:
        towns = session.scalars(select(Town).where(Town.id.in_(payload.townIds))).all()
        task_payload["townNames"] = sorted({*payload.townNames, *(town.name for town in towns)})
    if task_payload.get("source") == "dashboard":
        record_query = select(AssessmentRecord).where(AssessmentRecord.status.in_(["reviewed", "locked"]))
        if cycle is not None:
            record_query = record_query.where(AssessmentRecord.cycle_id == cycle.id)
        reviewed_records = list(session.scalars(record_query).all())
        town_names = set(task_payload.get("townNames", []))
        if town_names:
            reviewed_records = [record for record in reviewed_records if record.town.name in town_names]
        if not reviewed_records:
            raise HTTPException(status_code=422, detail="Report generation requires reviewed or locked assessment records.")
    task = ReportTask(cycle_id=cycle.id if cycle else None, payload=task_payload)
    session.add(task)
    session.commit()
    # Redis/Celery is the production path; local development remains usable without a worker.
    if settings.celery_task_always_eager:
        run_report_task(task.id)
    else:
        from app.workers.tasks import generate_report

        try:
            generate_report.delay(task.id)
        except Exception:
            run_report_task(task.id)
    session.refresh(task)
    return {"id": task.id, "status": task.status, "progress": task.progress, "reports": []}


@router.get("/api/report-tasks/{task_id}")
def get_task(task_id: str, session: Session = Depends(get_session)):
    task = session.get(ReportTask, task_id)
    if task is None: raise HTTPException(status_code=404, detail="Report task not found")
    reports = session.scalars(select(Report).where(Report.task_id == task.id)).all()
    return {"id": task.id, "status": task.status, "progress": task.progress, "error": task.error, "reports": [serialize_report(item) for item in reports]}


@router.get("/api/reports")
def reports(session: Session = Depends(get_session)):
    return {"items": [serialize_report(item) for item in session.scalars(select(Report).order_by(Report.created_at.desc())).all()]}


@router.get("/api/reports/{report_id}/download")
def download(report_id: str, session: Session = Depends(get_session)):
    report = session.get(Report, report_id)
    if report is None: raise HTTPException(status_code=404, detail="Report not found")
    path = Path(report.storage_key)
    if not path.is_file(): raise HTTPException(status_code=404, detail="Report file is missing")
    return FileResponse(path, filename=path.name)
