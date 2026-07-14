from typing import Any, Literal

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


class PaymentMonthInput(BaseModel):
    month: str = Field(pattern=r"^20\d{2}-(0[1-9]|1[0-2])$")
    monthlyVolumeTenThousandCubicMeters: float | None = Field(default=None, ge=0)
    averageDailyVolumeCubicMeters: float | None = Field(default=None, ge=0)
    influentCod: float | None = Field(default=None, ge=0)
    effluentCod: float | None = Field(default=None, ge=0)
    effluentQualified: bool | None = None
    influentCodDaysOver160: int | None = Field(default=None, ge=0, le=31)
    note: str = Field(default="", max_length=500)


class PaymentDataPatch(BaseModel):
    months: list[PaymentMonthInput] = Field(default_factory=list, max_length=12)
    designScaleCubicMetersPerDay: float | None = Field(default=None, gt=0)
    firstPaymentPeriod: bool = False
    adjustedTreatmentUnitPriceYuanPerCubicMeter: float | None = Field(default=None, ge=0)
    adjustedNetworkOperationFeeTenThousandYuanPerYear: float | None = Field(default=None, ge=0)
    note: str = Field(default="", max_length=1000)


class ReportTaskRequest(BaseModel):
    source: Literal["dashboard", "mobile", "upload"] = "dashboard"
    period: str = Field(default="", max_length=40)
    projectId: str | None = None
    townNames: list[str] = Field(default_factory=list, max_length=200)
    townIds: list[str] = Field(default_factory=list, max_length=200)
    uploadIds: list[str] = Field(default_factory=list, max_length=200)
    methodText: str = Field(default="", max_length=5000)
    outputs: list[Literal["separate", "summary"]] = Field(default_factory=lambda: ["separate", "summary"], min_length=1, max_length=2)
