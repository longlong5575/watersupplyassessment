from fastapi import APIRouter

from app.services.agent import summarize_assessment_payload


router = APIRouter(prefix="/api/agent", tags=["agent"])


@router.post("/summaries")
def summarize(payload: dict):
    return summarize_assessment_payload(payload)
