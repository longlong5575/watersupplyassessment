from __future__ import annotations

import json
import os
import re
from pathlib import Path

from docx import Document


BAD_TOKENS = ["None", "nan", "NaN", "Decimal(", "reviewed", "submitted", "locked", "returned", "E+", "e+"]
PROJECT_EXPECTATIONS = {
    "郁南": ["镇村污水处理设施绩效考核报告", "问卷调查（村级考核有）", "农村污水处理设施", "DB44/2208-2019", "TP", "1"],
    "茂南": ["城镇设施绩效考核报告", "水质净化厂", "城镇污水处理设施", "TP", "0.5"],
}


def table_text(table) -> str:
    return "\n".join(cell.text.strip() for row in table.rows for cell in row.cells)


def all_text(document: Document) -> str:
    return "\n".join([p.text for p in document.paragraphs] + [table_text(table) for table in document.tables])


def serial_errors(document: Document) -> list[dict[str, object]]:
    errors: list[dict[str, object]] = []
    for index, table in enumerate(document.tables, 1):
        if not table.rows:
            continue
        headers = [cell.text.strip() for cell in table.rows[0].cells]
        if "序号" not in headers:
            continue
        serial_index = headers.index("序号")
        serials = [row.cells[serial_index].text.strip() for row in table.rows[1:]]
        expected = [str(number) for number in range(1, len(serials) + 1)]
        if serials != expected:
            errors.append({"table": index, "serials": serials, "expected": expected})
    return errors


def latest_reports(report_root: Path) -> list[Path]:
    candidates = sorted(report_root.rglob("*.docx"), key=lambda path: path.stat().st_mtime, reverse=True)
    selected: list[Path] = []
    for keyword in ("郁南", "茂南"):
        match = next((path for path in candidates if keyword in path.name and "汇总" not in path.name), None)
        if match:
            selected.append(match)
    return selected


def inspect_report(path: Path) -> dict[str, object]:
    document = Document(path)
    text = all_text(document)
    project_key = "郁南" if "郁南" in path.name or "郁南" in text else "茂南" if "茂南" in path.name or "茂南" in text else "未知"
    expected = PROJECT_EXPECTATIONS.get(project_key, [])
    missing = [item for item in expected if item not in text]
    bad_tokens = [token for token in BAD_TOKENS if token in text]
    replacement_chars = text.count("\ufffd")
    sequence_errors = serial_errors(document)
    required_sections = ["考核对象", "考核结果", "证据附件目录", "Agent辅助校验", "附录A 水质评价限值"]
    missing_sections = [item for item in required_sections if item not in text]
    weird_numbers = re.findall(r"\d+\.\d{5,}", text)
    passed = not missing and not bad_tokens and replacement_chars == 0 and not sequence_errors and not missing_sections and not weird_numbers
    return {
        "report": str(path),
        "project": project_key,
        "passed": passed,
        "missingExpectedText": missing,
        "missingSections": missing_sections,
        "badTokens": bad_tokens,
        "replacementChars": replacement_chars,
        "serialErrors": sequence_errors,
        "overlongDecimals": weird_numbers[:20],
        "tableCount": len(document.tables),
        "paragraphCount": len(document.paragraphs),
    }


def main() -> None:
    root = Path(__file__).resolve().parent
    agent_root = root.parent
    base = agent_root.parent.parent if agent_root.parent.name.lower() == "watersupplyassessment" else agent_root.parent
    runtime_root = Path(os.environ.get("WATERSUPPLY_RUNTIME_DIR") or base / "运行脚本" / "watersupply-agent-runtime")
    result_root = runtime_root / "test-results"
    report_root = result_root / "project-pipeline" / "storage" / "generated_reports"
    reports = latest_reports(report_root)
    if len(reports) < 2:
        raise FileNotFoundError(f"未找到郁南和茂南两类最新版报告：{report_root}")
    items = [inspect_report(path) for path in reports]
    result = {"passed": all(item["passed"] for item in items), "items": items}
    output = result_root / "report-quality-summary.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
