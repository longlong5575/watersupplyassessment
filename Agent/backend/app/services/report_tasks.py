from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.config import settings
from app.models import AssessmentRecord, Attachment, Report, ReportTask, SurveyRecord, Town, WaterQualityRecord


def _append_database_summary(session: Session, paths: list[Path], records: list[AssessmentRecord]) -> None:
    """Keep a traceable database-derived summary inside each generated DOCX."""
    from docx import Document

    by_town: dict[str, list[AssessmentRecord]] = {}
    for record in records:
        by_town.setdefault(record.town.name, []).append(record)
    for path in paths:
        target_town = path.name.split("2023")[0]
        selected = records if target_town not in by_town else by_town[target_town]
        if not selected:
            continue
        document = Document(path)
        document.add_heading("系统采集数据复核摘要", level=2)
        table = document.add_table(rows=1, cols=7)
        table.style = "Table Grid"
        for cell, text in zip(table.rows[0].cells, ["镇街", "已复核记录", "状态", "评分条目", "问卷", "水质", "照片"]):
            cell.text = text
        for town, items in by_town.items():
            record_ids = [item.id for item in items]
            row = table.add_row().cells
            row[0].text = town
            row[1].text = str(len(items))
            row[2].text = "、".join(sorted({item.status for item in items}))
            row[3].text = str(sum(len(item.scores) for item in items))
            row[4].text = str(session.scalar(select(func.count(SurveyRecord.id)).where(SurveyRecord.record_id.in_(record_ids))) or 0)
            row[5].text = str(session.scalar(select(func.count(WaterQualityRecord.id)).where(WaterQualityRecord.record_id.in_(record_ids))) or 0)
            row[6].text = str(session.scalar(select(func.count(Attachment.id)).where(Attachment.record_id.in_(record_ids))) or 0)
        document.save(path)


def run_report_task(task_id: str) -> None:
    from app.services.reporting import generate_official_reports

    with SessionLocal() as session:
        task = session.get(ReportTask, task_id)
        if task is None:
            return
        task.status, task.progress = "running", 10
        session.commit()
        try:
            town_names = set(task.payload.get("townNames", []))
            records = list(session.scalars(select(AssessmentRecord).where(AssessmentRecord.cycle_id == task.cycle_id, AssessmentRecord.status.in_(["reviewed", "locked"]))))
            if town_names:
                records = [record for record in records if record.town.name in town_names]
            if task.payload.get("source") == "dashboard" and not records:
                raise RuntimeError("No reviewed assessment records are available for report generation.")
            include_summary = "summary" in task.payload.get("outputs", [])
            output_dir = generate_official_reports(town_names=town_names or None, include_summary=include_summary)
            task.progress = 90
            names = town_names
            output_paths = []
            for path in output_dir.glob("*.docx"):
                report_town = path.name.split("2023")[0]
                is_summary = report_town in {"台山市", "项目"}
                if names and report_town not in names and not (include_summary and is_summary):
                    continue
                output_paths.append(path)
            _append_database_summary(session, output_paths, records)
            for path in output_paths:
                report_town = path.name.split("2023")[0]
                town = session.scalar(select(Town).where(Town.name == report_town))
                if session.scalar(select(Report).where(Report.storage_key == str(path), Report.task_id == task.id)) is None:
                    session.add(Report(task_id=task.id, town_id=town.id if town else None, cycle_id=task.cycle_id, name=path.name, storage_key=str(path), size=path.stat().st_size))
            task.status, task.progress = "completed", 100
        except Exception as exc:
            task.status, task.error = "failed", str(exc)
        session.commit()
