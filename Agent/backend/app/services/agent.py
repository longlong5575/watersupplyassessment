from __future__ import annotations

from collections import Counter
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AgentRun,
    AssessmentRecord,
    Attachment,
    DeductionOption,
    Indicator,
    ReportTask,
    ReviewLog,
    SurveyRecord,
    WaterQualityRecord,
)
from app.models.entities import utcnow


def _evidence(kind: str, source_id: str, label: str, field: str | None = None) -> dict[str, str]:
    item = {"kind": kind, "id": source_id, "label": label}
    if field:
        item["field"] = field
    return item


def _score_context(session: Session, record: AssessmentRecord) -> list[dict[str, Any]]:
    indicator_ids = [score.indicator_id for score in record.scores if score.indicator_id]
    option_ids = [score.deduction_option_id for score in record.scores if score.deduction_option_id]
    indicators = {item.id: item for item in session.scalars(select(Indicator).where(Indicator.id.in_(indicator_ids))).all()} if indicator_ids else {}
    options = {item.id: item for item in session.scalars(select(DeductionOption).where(DeductionOption.id.in_(option_ids))).all()} if option_ids else {}
    rows: list[dict[str, Any]] = []
    for score in record.scores:
        indicator = indicators.get(score.indicator_id or "")
        option = options.get(score.deduction_option_id or "")
        rows.append(
            {
                "id": score.id,
                "indicatorId": score.indicator_id,
                "indicatorName": indicator.name if indicator else "未绑定指标",
                "fullScore": indicator.full_score if indicator else None,
                "deductionOptionId": score.deduction_option_id,
                "deductionOptionName": option.name if option else None,
                "score": float(score.score) if score.score is not None else None,
                "deduction": float(score.deduction or 0),
                "reason": score.reason or "",
                "source": score.source,
            }
        )
    return rows


def summarize_assessment_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Deterministic fallback for the optional external Agent service."""
    entries = payload.get("entries", [])
    reasons = [item.get("reason", "未说明") for item in entries if item.get("deduction") or item.get("deduct")]
    return {
        "summary": f"共接收 {len(entries)} 条评分记录，其中 {len(reasons)} 条存在扣分。",
        "issues": [
            {"title": reason, "severity": "medium", "evidenceRefs": []}
            for reason, _ in Counter(reasons).most_common(5)
        ],
        "suggestions": [],
        "evidenceRefs": [],
        "warnings": ["该结果为确定性 fallback，不参与评分和金额计算。"],
        "confidence": 0.7 if entries else 0.4,
        "source": "deterministic-fallback",
    }


def build_record_agent_output(session: Session, record: AssessmentRecord) -> dict[str, Any]:
    scores = _score_context(session, record)
    surveys = list(session.scalars(select(SurveyRecord).where(SurveyRecord.record_id == record.id)).all())
    water = list(session.scalars(select(WaterQualityRecord).where(WaterQualityRecord.record_id == record.id)).all())
    attachments = list(session.scalars(select(Attachment).where(Attachment.record_id == record.id)).all())
    logs = list(session.scalars(select(ReviewLog).where(ReviewLog.record_id == record.id).order_by(ReviewLog.created_at.desc())).all())

    attachment_score_ids = {item.score_id for item in attachments if item.score_id}
    deduction_scores = [score for score in scores if score["deduction"] > 0]
    missing_photo_scores = [score for score in deduction_scores if score["id"] not in attachment_score_ids]
    high_deduction = sorted(deduction_scores, key=lambda item: item["deduction"], reverse=True)[:5]
    water_unqualified = [item for item in water if (item.conclusion or "").lower() not in {"qualified", "合格", ""}]

    evidence_refs: list[dict[str, str]] = []
    issues: list[dict[str, Any]] = []
    for score in high_deduction:
        refs = [_evidence("score", score["id"], score["indicatorName"], "deduction")]
        if score["deductionOptionId"]:
            refs.append(_evidence("deduction_option", score["deductionOptionId"], score["deductionOptionName"] or "扣分项"))
        evidence_refs.extend(refs)
        issues.append(
            {
                "title": score["indicatorName"],
                "description": score["reason"] or score["deductionOptionName"] or "存在扣分记录",
                "severity": "high" if score["deduction"] >= 5 else "medium",
                "deduction": score["deduction"],
                "evidenceRefs": refs,
            }
        )

    warnings: list[str] = []
    if missing_photo_scores:
        warnings.append(f"{len(missing_photo_scores)} 个扣分项缺少绑定照片，建议复核证据完整性。")
        evidence_refs.extend(_evidence("score", score["id"], score["indicatorName"], "photo") for score in missing_photo_scores[:5])
    if record.total_score is not None and float(record.total_score) < 80:
        warnings.append("总分低于 80 分，建议重点复核主要扣分项。")
    if water_unqualified:
        warnings.append(f"{len(water_unqualified)} 条水质记录未判定为合格，建议作为报告佐证。")
        evidence_refs.extend(_evidence("water_quality", item.id, item.conclusion or "水质记录") for item in water_unqualified[:5])
    if not logs:
        warnings.append("尚无复核日志，Agent 结果只能作为复核前辅助提示。")

    town = record.town.name
    issue_names = "、".join(item["title"] for item in issues[:3]) or "暂无明显扣分问题"
    suggestions = [
        {"title": "复核证据完整性", "text": "优先核对扣分项照片、问卷、水质记录是否与评分说明一致。", "evidenceRefs": evidence_refs[:5]},
        {"title": "报告表述建议", "text": f"报告问题段落可围绕{issue_names}展开，并引用复核后的确定性评分数据。", "evidenceRefs": evidence_refs[:5]},
    ]
    semantic_checks = [
        {"name": "分数边界", "passed": True, "message": "Agent 未改写分数，分数仍来自数据库。"},
        {"name": "金额边界", "passed": True, "message": "Agent 未参与金额计算。"},
        {"name": "证据引用", "passed": bool(evidence_refs) or not issues, "message": "发现问题均已绑定来源引用。" if evidence_refs or not issues else "部分问题缺少来源引用。"},
    ]
    summary = (
        f"{town}本次记录包含 {len(scores)} 条评分、{len(surveys)} 条问卷、{len(water)} 条水质记录和 {len(attachments)} 个附件。"
        f"识别到 {len(deduction_scores)} 条扣分记录，{len(warnings)} 条复核提示。"
    )
    confidence = 0.86 if record.status in {"reviewed", "locked"} else 0.72
    if missing_photo_scores:
        confidence -= 0.08
    return {
        "summary": summary,
        "issues": issues,
        "suggestions": suggestions,
        "draftParagraphs": [
            {
                "title": "问题归纳",
                "text": f"根据系统采集和复核数据，{town}主要需关注{issue_names}等事项。上述表述仅为报告草稿，正式分数、扣分和金额以数据库确定性结果为准。",
                "evidenceRefs": evidence_refs[:8],
            }
        ],
        "semanticChecks": semantic_checks,
        "evidenceRefs": evidence_refs,
        "warnings": warnings,
        "confidence": round(max(confidence, 0.35), 2),
        "source": "deterministic-agent-v1",
        "boundaries": ["不决定分数", "不决定金额", "不绕过锁定", "人工确认后才可采用段落"],
    }


def create_record_agent_run(session: Session, record: AssessmentRecord) -> AgentRun:
    output = build_record_agent_output(session, record)
    run = AgentRun(
        record_id=record.id,
        capability="record_review_assist",
        provider="deterministic",
        model="rules-v1",
        status="completed",
        input_summary={
            "recordId": record.id,
            "town": record.town.name,
            "status": record.status,
            "scoreCount": len(record.scores),
            "totalScore": float(record.total_score) if record.total_score is not None else None,
        },
        output=output,
        evidence_refs=output["evidenceRefs"],
        warnings=output["warnings"],
        confidence=output["confidence"],
    )
    session.add(run)
    session.commit()
    session.refresh(run)
    return run


def create_report_task_agent_run(session: Session, task: ReportTask) -> AgentRun:
    snapshot = task.data_snapshot or {}
    towns = snapshot.get("towns", [])
    warnings = []
    if not snapshot.get("recordIds"):
        warnings.append("报告任务缺少可追溯记录范围。")
    if not task.dataset_hash:
        warnings.append("报告任务缺少数据快照哈希。")
    issue_towns = [item["town"] for item in towns if item.get("recordCount", 0) and item.get("attachmentCount", 0) == 0]
    if issue_towns:
        warnings.append("部分镇街缺少照片附件：" + "、".join(issue_towns[:5]))
    evidence_refs = [
        _evidence("report_task", task.id, "报告任务", "datasetHash"),
        *[_evidence("record", record_id, "报告数据记录") for record_id in snapshot.get("recordIds", [])[:10]],
    ]
    output = {
        "summary": f"报告任务包含 {len(snapshot.get('recordIds', []))} 条复核/锁定记录，覆盖 {len(towns)} 个镇街。",
        "issues": [
            {"title": item["town"], "description": f"记录 {item.get('recordCount', 0)} 条，附件 {item.get('attachmentCount', 0)} 个。", "severity": "medium", "evidenceRefs": evidence_refs[:3]}
            for item in towns
        ],
        "suggestions": [
            {"title": "生成前复核", "text": "确认报告范围、数据快照哈希和评分标准版本后再采用 Agent 草稿段落。", "evidenceRefs": evidence_refs[:3]}
        ],
        "draftParagraphs": [
            {"title": "报告生成说明", "text": "本报告基于后台已复核或已锁定数据生成，Agent 仅进行问题归纳和语义校验，不参与分数及金额计算。", "evidenceRefs": evidence_refs[:3]}
        ],
        "semanticChecks": [
            {"name": "数据快照", "passed": bool(task.dataset_hash), "message": "报告任务已绑定数据快照哈希。" if task.dataset_hash else "报告任务缺少数据快照哈希。"},
            {"name": "记录范围", "passed": bool(snapshot.get("recordIds")), "message": "报告任务已保存记录范围。" if snapshot.get("recordIds") else "报告任务缺少记录范围。"},
            {"name": "确定性边界", "passed": True, "message": "Agent 未参与分数、金额和锁定状态判断。"},
        ],
        "evidenceRefs": evidence_refs,
        "warnings": warnings,
        "confidence": 0.88 if not warnings else 0.76,
        "source": "deterministic-agent-v1",
        "boundaries": ["不决定分数", "不决定金额", "不绕过锁定", "失败不影响基础报告生成"],
    }
    run = AgentRun(
        report_task_id=task.id,
        capability="report_semantic_check",
        provider="deterministic",
        model="rules-v1",
        status="completed",
        input_summary={"taskId": task.id, "datasetHash": task.dataset_hash, "recordCount": len(snapshot.get("recordIds", []))},
        output=output,
        evidence_refs=evidence_refs,
        warnings=warnings,
        confidence=output["confidence"],
    )
    session.add(run)
    session.commit()
    session.refresh(run)
    return run


def serialize_agent_run(run: AgentRun) -> dict[str, Any]:
    return {
        "id": run.id,
        "recordId": run.record_id,
        "reportTaskId": run.report_task_id,
        "capability": run.capability,
        "provider": run.provider,
        "model": run.model,
        "status": run.status,
        "inputSummary": run.input_summary,
        "output": run.output,
        "evidenceRefs": run.evidence_refs,
        "warnings": run.warnings,
        "confidence": run.confidence,
        "accepted": run.accepted,
        "confirmedById": run.confirmed_by_id,
        "confirmedAt": run.confirmed_at.isoformat() if run.confirmed_at else None,
        "error": run.error,
        "createdAt": run.created_at.isoformat(),
    }


def confirm_agent_run(session: Session, run: AgentRun, *, accepted: bool, user_id: str) -> AgentRun:
    run.accepted = accepted
    run.confirmed_by_id = user_id
    run.confirmed_at = utcnow()
    session.commit()
    session.refresh(run)
    return run
