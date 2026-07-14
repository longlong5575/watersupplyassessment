from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class IdMixin:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class User(IdMixin, TimestampMixin, Base):
    __tablename__ = "users"
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(30), default="inspector")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    token_version: Mapped[int] = mapped_column(Integer, default=0)


class City(IdMixin, TimestampMixin, Base):
    __tablename__ = "cities"
    name: Mapped[str] = mapped_column(String(120), unique=True)


class AssessmentCycle(IdMixin, TimestampMixin, Base):
    __tablename__ = "assessment_cycles"
    city_id: Mapped[str] = mapped_column(ForeignKey("cities.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(30), default="active")
    city: Mapped[City] = relationship()


class Town(IdMixin, TimestampMixin, Base):
    __tablename__ = "towns"
    city_id: Mapped[str] = mapped_column(ForeignKey("cities.id"), index=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    chapter_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    assessment_targets: Mapped[list] = mapped_column(JSON, default=list)
    assessment_object: Mapped[dict] = mapped_column(JSON, default=dict)
    report_template: Mapped[dict] = mapped_column(JSON, default=dict)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    city: Mapped[City] = relationship()
    villages: Mapped[list[Village]] = relationship(back_populates="town")


class Village(IdMixin, TimestampMixin, Base):
    __tablename__ = "villages"
    town_id: Mapped[str] = mapped_column(ForeignKey("towns.id"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    administrative_village: Mapped[str | None] = mapped_column(String(160), nullable=True)
    chapter_code: Mapped[str | None] = mapped_column(String(60), nullable=True)
    assessment_object: Mapped[dict] = mapped_column(JSON, default=dict)
    report_template: Mapped[dict] = mapped_column(JSON, default=dict)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    town: Mapped[Town] = relationship(back_populates="villages")


class Facility(IdMixin, TimestampMixin, Base):
    __tablename__ = "facilities"
    village_id: Mapped[str] = mapped_column(ForeignKey("villages.id"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    facility_type: Mapped[str] = mapped_column(String(60))


class IndicatorVersion(IdMixin, TimestampMixin, Base):
    __tablename__ = "indicator_versions"
    city_id: Mapped[str] = mapped_column(ForeignKey("cities.id"))
    cycle_id: Mapped[str] = mapped_column(ForeignKey("assessment_cycles.id"))
    name: Mapped[str] = mapped_column(String(160))
    status: Mapped[str] = mapped_column(String(30), default="published")
    locked: Mapped[bool] = mapped_column(Boolean, default=False)


class Indicator(IdMixin, TimestampMixin, Base):
    __tablename__ = "indicators"
    version_id: Mapped[str] = mapped_column(ForeignKey("indicator_versions.id"), index=True)
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("indicators.id"), nullable=True)
    code: Mapped[str] = mapped_column(String(80))
    name: Mapped[str] = mapped_column(String(240))
    level: Mapped[int] = mapped_column(Integer)
    full_score: Mapped[float] = mapped_column(Float, default=0)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    facility_type: Mapped[str | None] = mapped_column(String(60), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class DeductionOption(IdMixin, TimestampMixin, Base):
    __tablename__ = "deduction_options"
    indicator_id: Mapped[str] = mapped_column(ForeignKey("indicators.id"), index=True)
    name: Mapped[str] = mapped_column(String(300))
    deduction_type: Mapped[str] = mapped_column(String(40), default="fixed")
    deduction_value: Mapped[float] = mapped_column(Float, default=0)
    requires_photo: Mapped[bool] = mapped_column(Boolean, default=False)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)


class AssessmentRecord(IdMixin, TimestampMixin, Base):
    __tablename__ = "assessment_records"
    city_id: Mapped[str] = mapped_column(ForeignKey("cities.id"), index=True)
    owner_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    cycle_id: Mapped[str] = mapped_column(ForeignKey("assessment_cycles.id"), index=True)
    town_id: Mapped[str] = mapped_column(ForeignKey("towns.id"), index=True)
    village_id: Mapped[str | None] = mapped_column(ForeignKey("villages.id"), nullable=True)
    facility_id: Mapped[str | None] = mapped_column(ForeignKey("facilities.id"), nullable=True)
    indicator_version_id: Mapped[str | None] = mapped_column(ForeignKey("indicator_versions.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="draft", index=True)
    total_score: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    raw_payload: Mapped[dict] = mapped_column(JSON, default=dict)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    town: Mapped[Town] = relationship()
    scores: Mapped[list[AssessmentScore]] = relationship(back_populates="record", cascade="all, delete-orphan")


class AssessmentScore(IdMixin, TimestampMixin, Base):
    __tablename__ = "assessment_scores"
    record_id: Mapped[str] = mapped_column(ForeignKey("assessment_records.id"), index=True)
    indicator_id: Mapped[str | None] = mapped_column(ForeignKey("indicators.id"), nullable=True)
    deduction_option_id: Mapped[str | None] = mapped_column(ForeignKey("deduction_options.id"), nullable=True)
    score: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    deduction: Mapped[float] = mapped_column(Numeric(8, 2), default=0)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(40), default="manual")
    record: Mapped[AssessmentRecord] = relationship(back_populates="scores")


class SurveyRecord(IdMixin, TimestampMixin, Base):
    __tablename__ = "survey_records"
    record_id: Mapped[str] = mapped_column(ForeignKey("assessment_records.id"), index=True)
    survey_type: Mapped[str] = mapped_column(String(80))
    respondent: Mapped[str | None] = mapped_column(String(160), nullable=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)


class WaterQualityRecord(IdMixin, TimestampMixin, Base):
    __tablename__ = "water_quality_records"
    record_id: Mapped[str] = mapped_column(ForeignKey("assessment_records.id"), index=True)
    sampled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    conclusion: Mapped[str | None] = mapped_column(String(80), nullable=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)


class ScoreSourceMapping(IdMixin, TimestampMixin, Base):
    __tablename__ = "score_source_mappings"
    indicator_id: Mapped[str] = mapped_column(ForeignKey("indicators.id"), index=True)
    source_type: Mapped[str] = mapped_column(String(40))
    source_key: Mapped[str] = mapped_column(String(160))
    rule: Mapped[dict] = mapped_column(JSON, default=dict)


class Attachment(IdMixin, TimestampMixin, Base):
    __tablename__ = "attachments"
    record_id: Mapped[str | None] = mapped_column(ForeignKey("assessment_records.id"), nullable=True, index=True)
    score_id: Mapped[str | None] = mapped_column(ForeignKey("assessment_scores.id"), nullable=True)
    deduction_option_id: Mapped[str | None] = mapped_column(ForeignKey("deduction_options.id"), nullable=True)
    filename: Mapped[str] = mapped_column(String(255))
    storage_key: Mapped[str] = mapped_column(String(500))
    content_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    size: Mapped[int] = mapped_column(Integer, default=0)


class ReviewLog(IdMixin, TimestampMixin, Base):
    __tablename__ = "review_logs"
    record_id: Mapped[str] = mapped_column(ForeignKey("assessment_records.id"), index=True)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(40))
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    before_payload: Mapped[dict] = mapped_column(JSON, default=dict)
    after_payload: Mapped[dict] = mapped_column(JSON, default=dict)


class ReportTask(IdMixin, TimestampMixin, Base):
    __tablename__ = "report_tasks"
    cycle_id: Mapped[str | None] = mapped_column(ForeignKey("assessment_cycles.id"), nullable=True)
    created_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="queued")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    data_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    dataset_hash: Mapped[str | None] = mapped_column(String(80), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Report(IdMixin, TimestampMixin, Base):
    __tablename__ = "reports"
    task_id: Mapped[str | None] = mapped_column(ForeignKey("report_tasks.id"), nullable=True)
    town_id: Mapped[str | None] = mapped_column(ForeignKey("towns.id"), nullable=True)
    cycle_id: Mapped[str | None] = mapped_column(ForeignKey("assessment_cycles.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(300))
    storage_key: Mapped[str] = mapped_column(String(500))
    size: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default="completed")
    version: Mapped[int] = mapped_column(Integer, default=1)
    format: Mapped[str] = mapped_column(String(20), default="docx")
    dataset_hash: Mapped[str | None] = mapped_column(String(80), nullable=True)
    data_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    task_parameters: Mapped[dict] = mapped_column(JSON, default=dict)
    town: Mapped[Town | None] = relationship()


class AgentRun(IdMixin, TimestampMixin, Base):
    __tablename__ = "agent_runs"
    record_id: Mapped[str | None] = mapped_column(ForeignKey("assessment_records.id"), nullable=True, index=True)
    report_task_id: Mapped[str | None] = mapped_column(ForeignKey("report_tasks.id"), nullable=True, index=True)
    capability: Mapped[str] = mapped_column(String(80))
    provider: Mapped[str] = mapped_column(String(60), default="deterministic")
    model: Mapped[str] = mapped_column(String(120), default="rules-v1")
    status: Mapped[str] = mapped_column(String(30), default="completed")
    input_summary: Mapped[dict] = mapped_column(JSON, default=dict)
    output: Mapped[dict] = mapped_column(JSON, default=dict)
    evidence_refs: Mapped[list] = mapped_column(JSON, default=list)
    warnings: Mapped[list] = mapped_column(JSON, default=list)
    confidence: Mapped[float] = mapped_column(Float, default=0)
    accepted: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    confirmed_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
