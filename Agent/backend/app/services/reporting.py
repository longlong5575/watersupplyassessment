from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from app.core.config import settings


SCRIPT_SUFFIX = Path("可迁移版") / "运行脚本" / "排水" / "报告生成" / "batch_generate_town_reports.py"


def _report_project_root() -> Path:
    for candidate in (
        settings.project_root,
        settings.project_root.parent,
        settings.project_root / "watersupplyassessment",
        settings.project_root.parent / "watersupplyassessment",
    ):
        if (candidate / SCRIPT_SUFFIX).is_file():
            return candidate
    raise FileNotFoundError(f"Official report generator was not found below: {settings.project_root}")


def _backend_storage_dir() -> Path:
    if settings.storage_dir.is_absolute():
        return settings.storage_dir
    return settings.backend_dir / settings.storage_dir


def generate_official_reports(town_names: set[str] | None = None, include_summary: bool = True) -> Path:
    """Run the maintained DOCX generator against the current project materials."""
    report_project_root = _report_project_root()
    report_script = report_project_root / SCRIPT_SUFFIX
    output_dir = _backend_storage_dir() / "generated_reports"
    output_dir.mkdir(parents=True, exist_ok=True)

    env = os.environ.copy()
    env["REPORT_OUTPUT_DIR"] = str(output_dir)
    if town_names:
        env["REPORT_TOWNS"] = ",".join(sorted(town_names))
    env["REPORT_INCLUDE_SUMMARY"] = "1" if include_summary else "0"
    completed = subprocess.run(
        [sys.executable, str(report_script)],
        cwd=report_project_root,
        env=env,
        capture_output=True,
        text=True,
        timeout=300,
        check=False,
    )
    if completed.returncode:
        detail = (completed.stderr or completed.stdout).strip()
        raise RuntimeError(detail or "Official report generation failed.")
    return output_dir
