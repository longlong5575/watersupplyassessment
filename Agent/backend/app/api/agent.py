from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import admin_user
from app.models import AgentRun, AssessmentRecord, ReportTask
from app.services.agent import (
    confirm_agent_run,
    create_record_agent_run,
    create_report_task_agent_run,
    serialize_agent_run,
    summarize_assessment_payload,
)


router = APIRouter(prefix="/api/agent", tags=["agent"])


class AgentConfirmation(BaseModel):
    accepted: bool


@router.post("/summaries")
def summarize(payload: dict[str, Any]):
    return summarize_assessment_payload(payload)


@router.post("/records/{record_id}/analysis")
def analyze_record(record_id: str, session: Session = Depends(get_session), user=Depends(admin_user)):
    record = session.get(AssessmentRecord, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found")
    return serialize_agent_run(create_record_agent_run(session, record))


@router.get("/records/{record_id}/runs")
def record_runs(record_id: str, session: Session = Depends(get_session)):
    runs = session.scalars(
        select(AgentRun)
        .where(AgentRun.record_id == record_id)
        .order_by(AgentRun.created_at.desc())
    ).all()
    return {"items": [serialize_agent_run(item) for item in runs]}


@router.post("/report-tasks/{task_id}/analysis")
def analyze_report_task(task_id: str, session: Session = Depends(get_session), user=Depends(admin_user)):
    task = session.get(ReportTask, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Report task not found")
    return serialize_agent_run(create_report_task_agent_run(session, task))


@router.get("/report-tasks/{task_id}/runs")
def report_task_runs(task_id: str, session: Session = Depends(get_session)):
    runs = session.scalars(
        select(AgentRun)
        .where(AgentRun.report_task_id == task_id)
        .order_by(AgentRun.created_at.desc())
    ).all()
    return {"items": [serialize_agent_run(item) for item in runs]}


@router.post("/runs/{run_id}/confirm")
def confirm_run(run_id: str, payload: AgentConfirmation, session: Session = Depends(get_session), user=Depends(admin_user)):
    run = session.get(AgentRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Agent run not found")
    return serialize_agent_run(confirm_agent_run(session, run, accepted=payload.accepted, user_id=user.id))
