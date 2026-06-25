from typing import Any

from pydantic import BaseModel, Field


class RecordPatch(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)
    reason: str | None = None


class ScorePatchItem(BaseModel):
    id: str
    score: float | None = None
    deduction: float | None = None
    reason: str | None = None


class ScorePatch(BaseModel):
    scores: list[ScorePatchItem] = Field(default_factory=list)
    reason: str | None = None


class ReportTaskRequest(BaseModel):
    source: str = "dashboard"
    period: str = "2023年下半年度"
    townNames: list[str] = Field(default_factory=list)
    townIds: list[str] = Field(default_factory=list)
    uploadIds: list[str] = Field(default_factory=list)
    methodText: str = ""
    outputs: list[str] = Field(default_factory=lambda: ["separate", "summary"])
