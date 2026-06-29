import shutil
import traceback
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.config import settings
from app.models import AssessmentCycle, AssessmentRecord, Attachment, Report, ReportTask, SurveyRecord, Town, WaterQualityRecord
from app.models.entities import utcnow
from app.services.report_dataset import build_report_dataset, validate_report_dataset


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


def _storage_root() -> Path:
    if settings.storage_dir.is_absolute():
        return settings.storage_dir
    return settings.backend_dir / settings.storage_dir


def _next_report_version(session: Session, *, name: str, cycle_id: str | None, town_id: str | None) -> int:
    existing = session.scalars(
        select(Report).where(
            Report.name == name,
            Report.cycle_id == cycle_id,
            Report.town_id == town_id,
        )
    ).all()
    return max([report.version or 1 for report in existing], default=0) + 1


def _versioned_report_path(task_id: str, version: int, source: Path) -> Path:
    output_dir = _storage_root() / "generated_reports" / "tasks" / task_id / f"v{version:03d}"
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir / source.name


def run_report_task(task_id: str) -> None:
    from app.services.reporting import generate_official_reports

    with SessionLocal() as session:
        task = session.get(ReportTask, task_id)
        if task is None:
            return
        task.status, task.progress, task.started_at, task.error = "running", 10, utcnow(), None
        session.commit()
        try:
            town_names = set(task.payload.get("townNames", []))
            cycle = session.get(AssessmentCycle, task.cycle_id) if task.cycle_id else None
            record_query = select(AssessmentRecord).where(AssessmentRecord.status.in_(["reviewed", "locked"]))
            if task.cycle_id:
                record_query = record_query.where(AssessmentRecord.cycle_id == task.cycle_id)
            records = list(session.scalars(record_query))
            if town_names:
                records = [record for record in records if record.town.name in town_names]
            snapshot = build_report_dataset(session, cycle=cycle, town_names=town_names or None)
            if task.payload.get("source") == "dashboard":
                validate_report_dataset(snapshot)
            task.data_snapshot = snapshot
            task.dataset_hash = snapshot.get("hash")
            session.commit()
            include_summary = "summary" in task.payload.get("outputs", [])
            output_dir = generate_official_reports(town_names=town_names or None, include_summary=include_summary)
            task.progress = 80
            names = town_names
            output_paths = []
            for path in output_dir.glob("*.docx"):
                report_town = path.name.split("2023")[0]
                is_summary = report_town in {"台山市", "项目"}
                if names and report_town not in names and not (include_summary and is_summary):
                    continue
                output_paths.append(path)
            if not output_paths:
                raise RuntimeError("Official report generator did not produce any matching DOCX files.")
            _append_database_summary(session, output_paths, records)
            task.progress = 90
            for path in output_paths:
                report_town = path.name.split("2023")[0]
                town = session.scalar(select(Town).where(Town.name == report_town))
                town_id = town.id if town else None
                version = _next_report_version(session, name=path.name, cycle_id=task.cycle_id, town_id=town_id)
                final_path = _versioned_report_path(task.id, version, path)
                shutil.copy2(path, final_path)
                town_records = [item for item in snapshot.get("records", []) if item.get("town") == report_town]
                if report_town in {"台山市", "项目"}:
                    town_records = snapshot.get("records", [])
                report_snapshot = {
                    "hash": task.dataset_hash,
                    "cycleId": snapshot.get("cycleId"),
                    "cycleName": snapshot.get("cycleName"),
                    "town": report_town,
                    "recordIds": [item["id"] for item in town_records],
                    "indicatorVersionIds": sorted({item["indicatorVersionId"] for item in town_records if item.get("indicatorVersionId")}),
                    "towns": snapshot.get("towns", []),
                }
                session.add(
                    Report(
                        task_id=task.id,
                        town_id=town_id,
                        cycle_id=task.cycle_id,
                        name=path.name,
                        storage_key=str(final_path),
                        size=final_path.stat().st_size,
                        version=version,
                        format="docx",
                        dataset_hash=task.dataset_hash,
                        data_snapshot=report_snapshot,
                        task_parameters=task.payload,
                    )
                )
            task.status, task.progress, task.completed_at = "completed", 100, utcnow()
        except Exception as exc:
            task.status = "failed"
            task.error = f"{exc}\n{traceback.format_exc(limit=5)}"
        session.commit()
