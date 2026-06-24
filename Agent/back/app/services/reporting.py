from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from app.core.config import settings


SCRIPT_SUFFIX = Path("可迁移版") / "运行脚本" / "排水" / "报告生成" / "batch_generate_town_reports.py"


def _report_project_root() -> Path:
    for candidate in (settings.project_root, settings.project_root / "watersupplyassessment"):
        if (candidate / SCRIPT_SUFFIX).is_file():
            return candidate
    raise FileNotFoundError(f"Official report generator was not found below: {settings.project_root}")


def generate_official_reports() -> None:
    """Run the maintained DOCX generator against the current project materials."""
    report_project_root = _report_project_root()
    report_script = report_project_root / SCRIPT_SUFFIX
    output_dir = settings.project_root / "生成"
    if settings.backend_dir.parent.name != "Agent":
        output_dir = output_dir / "报告"

    env = os.environ.copy()
    env["REPORT_OUTPUT_DIR"] = str(output_dir)
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
