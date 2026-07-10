from __future__ import annotations

import json
import os
import re
from pathlib import Path
from zipfile import ZipFile

from docx import Document
from docx.oxml.ns import qn


BAD_TOKENS = ["None", "nan", "NaN", "Decimal(", "reviewed", "submitted", "locked", "returned", "E+", "e+", "原文例文", "例文口径", "原文镇名", "原文报告", "模板版", "系统生成版", "极端重复扣分", "第二原因", "极端问卷", "后台极端", "封顶验证", "修改后再次同步", "按项目目录列示全部镇街"]
BAD_AMOUNT_TEXT = ["使用通用金额基础表", "按通用金额基础表", "合同单价 × 核定处理水量", "奖励金额", "季度奖励金"]
PROJECT_EXPECTATIONS = {
    "郁南": ["镇级及农村设施考核报告", "项目人员组成", "公众调查", "农村污水处理设施", "DB44/2208-2019", "TP", "附件1 考核标准", "附件2 考核评分表"],
    "茂南": ["城镇设施绩效考核报告", "项目人员组成", "水质净化厂", "城镇污水处理设施", "TP", "附件1 考核标准", "附件8 月平均值统计"],
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


def chapter_order_errors(document: Document) -> list[dict[str, object]]:
    chapters: list[tuple[int, str]] = []
    for paragraph in document.paragraphs:
        text = paragraph.text.strip()
        match = re.match(r"^2\.(\d+)\s+", text)
        if match:
            chapters.append((int(match.group(1)), text))
    numbers = [number for number, _ in chapters]
    if numbers != sorted(numbers):
        return [{"chapters": [text for _, text in chapters], "expectedOrder": sorted(numbers)}]
    return []


def font_errors(document: Document) -> list[dict[str, str]]:
    errors: list[dict[str, str]] = []
    for style_name in ("Normal", "Heading 1", "Heading 2", "Heading 3"):
        style = document.styles[style_name]
        fonts = style._element.rPr.rFonts if style._element.rPr is not None else None
        east_asia = fonts.get(qn("w:eastAsia")) if fonts is not None else None
        if east_asia != "宋体":
            errors.append({"location": f"style:{style_name}", "font": east_asia or ""})
    paragraphs = list(document.paragraphs)
    paragraphs.extend(paragraph for table in document.tables for row in table.rows for cell in row.cells for paragraph in cell.paragraphs)
    for paragraph_index, paragraph in enumerate(paragraphs, 1):
        for run in paragraph.runs:
            if not run.text.strip() or run._element.rPr is None or run._element.rPr.rFonts is None:
                continue
            east_asia = run._element.rPr.rFonts.get(qn("w:eastAsia"))
            if east_asia not in (None, "宋体"):
                errors.append({"location": f"run:{paragraph_index}", "font": east_asia})
                if len(errors) >= 20:
                    return errors
    return errors


def latest_reports(report_root: Path) -> list[Path]:
    candidates = sorted(report_root.rglob("*.docx"), key=lambda path: path.stat().st_mtime, reverse=True)
    selected: list[Path] = []
    for keyword in ("郁南", "茂南"):
        for is_summary in (False, True):
            match = next(
                (
                    path
                    for path in candidates
                    if keyword in path.name and (("汇总" in path.name) == is_summary)
                ),
                None,
            )
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
    bad_amount_text = [token for token in BAD_AMOUNT_TEXT if token in text]
    replacement_chars = text.count("\ufffd")
    sequence_errors = serial_errors(document)
    chapter_errors = chapter_order_errors(document)
    report_font_errors = font_errors(document)
    if project_key == "茂南":
        required_sections = ["摘  要", "目录", "第一章 考核工作概述", "1.6.1 现场检查", "1.6.2 查阅资料", "1.6.3 水质检测", "第二章 城镇水质净化设施考核结果", "第三章 绩效付费计算", "第四章 主要改进点、主要问题和整改工作建议", "附件1 考核标准", "附件2 周期评分表", "附件3 现场检查照片", "附件5 水质抽检汇总", "附件8 月平均值统计"]
        amount_boundary_missing = "不引用其他项目" not in text and "本项目既有例文和历史付费表" not in text
    else:
        required_sections = ["摘要", "目录", "第一章 考核工作概述", "1.6.1 现场检查", "1.6.2 查阅资料", "1.6.3 问卷调查", "1.6.4 水质检测", "第二章 镇级设施运维考核情况", "第三章 绩效付费计算", "附件18金额基础", "第四章 主要问题及整改建议", "附件1 考核标准", "附件2 考核评分表", "附件3 现场照片", "附件5 水质抽检情况汇总表"]
        amount_boundary_missing = "不引用茂南或其他项目金额资料" not in text
    missing_sections = [item for item in required_sections if item not in text]
    with ZipFile(path) as package:
        document_xml = package.read("word/document.xml")
        settings_xml = package.read("word/settings.xml")
        footer_xml = b"".join(
            package.read(name) for name in package.namelist() if name.startswith("word/footer") and name.endswith(".xml")
        )
    toc_field_missing = b"w:instrText" not in document_xml or b"TOC " not in document_xml
    update_fields_missing = b"updateFields" not in settings_xml
    page_field_missing = b" PAGE " not in footer_xml
    weird_numbers = re.findall(r"\d+\.\d{5,}", text)
    is_summary = "汇总" in path.name
    summary_scope_missing = is_summary and ("已提交、已复核或已锁定" not in text or "草稿、退回和未提交" not in text)
    min_tables = (18 if project_key == "茂南" else 20) if is_summary else 12
    min_paragraphs = (95 if project_key == "茂南" else 105) if is_summary else 70
    too_short = len(document.paragraphs) < min_paragraphs or len(document.tables) < min_tables
    passed = not missing and not bad_tokens and not bad_amount_text and not amount_boundary_missing and not toc_field_missing and not update_fields_missing and not page_field_missing and replacement_chars == 0 and not sequence_errors and not chapter_errors and not report_font_errors and not summary_scope_missing and not missing_sections and not weird_numbers and not too_short
    return {
        "report": str(path),
        "project": project_key,
        "passed": passed,
        "missingExpectedText": missing,
        "missingSections": missing_sections,
        "badTokens": bad_tokens,
        "badAmountText": bad_amount_text,
        "amountBoundaryMissing": amount_boundary_missing,
        "tocFieldMissing": toc_field_missing,
        "updateFieldsMissing": update_fields_missing,
        "pageFieldMissing": page_field_missing,
        "replacementChars": replacement_chars,
        "serialErrors": sequence_errors,
        "chapterOrderErrors": chapter_errors,
        "fontErrors": report_font_errors,
        "summaryScopeMissing": summary_scope_missing,
        "overlongDecimals": weird_numbers[:20],
        "tooShort": too_short,
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
    if len(reports) < 4:
        raise FileNotFoundError(f"未找到郁南和茂南两类正文及汇总报告：{report_root}")
    items = [inspect_report(path) for path in reports]
    result = {"passed": all(item["passed"] for item in items), "items": items}
    output = result_root / "report-quality-summary.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    if not result["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
