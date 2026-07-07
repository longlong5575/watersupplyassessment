import shutil
import traceback
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.config import settings
from app.models import AssessmentCycle, AssessmentRecord, Attachment, Report, ReportTask, SurveyRecord, Town, WaterQualityRecord
from app.models.entities import utcnow
from app.services.report_dataset import build_report_dataset, validate_report_dataset


REPORT_TYPE_LABELS = {
    "town_plant": "镇街污水处理厂",
    "town_network": "镇街污水收集管网",
    "rural_treatment": "农村污水处理设施",
}
STATUS_LABELS = {
    "reviewed": "已复核",
    "locked": "已锁定",
    "submitted": "已提交",
    "draft": "草稿",
}
SURVEY_TYPE_LABELS = {
    "satisfaction": "满意度调查",
    "sewage_collection": "污水收集效果调查",
    "overall_effect": "整体效果调查",
}
RESPONDENT_LABELS = {
    "villager1": "村民代表一",
    "villager2": "村民代表二",
    "gov_rep": "镇街代表",
    "assessment_team": "考核小组",
    "implementation_org": "实施机构",
}

PROJECT_REPORT_PROFILES = {
    "郁南项目": {
        "shortName": "郁南",
        "titleSuffix": "镇村污水处理设施绩效考核报告",
        "basis": "依据《PPP项目合同》、补充协议及郁南项目镇村考核报告确定的考核频次、考核对象、评分标准和水质限值执行。",
        "methods": ["现场检查", "查阅资料", "问卷调查（村级考核有）", "水质检测", "评分复核"],
        "waterStandard": "镇级污水处理设施出水执行城镇一级A及广东省地方标准较严值；农村生活污水处理设施执行广东省《农村生活污水处理排放标准》（DB44/2208-2019）。",
        "waterRows": [
            ["镇级污水厂及管网", "CODCr", "40", "mg/L"],
            ["镇级污水厂及管网", "NH3-N", "5（8）", "mg/L"],
            ["镇级污水厂及管网", "TP", "0.5", "mg/L"],
            ["农村污水处理设施", "CODCr", "60", "mg/L"],
            ["农村污水处理设施", "NH3-N", "8（15）", "mg/L"],
            ["农村污水处理设施", "TP", "1", "mg/L"],
        ],
        "hasSurvey": True,
    },
    "茂南项目": {
        "shortName": "茂南",
        "titleSuffix": "城镇设施绩效考核报告",
        "basis": "依据茂南区水质净化处理设施全区捆绑PPP项目城镇设施绩效考核报告口径，对水质净化厂及配套管网分别开展周期绩效考核。",
        "methods": ["现场检查", "查阅资料", "水质检测", "评分复核"],
        "waterStandard": "城镇污水处理设施出水执行《城镇污水处理厂污染物排放标准》一级A标准及广东省《水污染物排放限值》较严值。",
        "waterRows": [
            ["城镇污水处理设施", "CODCr", "40", "mg/L"],
            ["城镇污水处理设施", "BOD5", "10", "mg/L"],
            ["城镇污水处理设施", "SS", "10", "mg/L"],
            ["城镇污水处理设施", "NH3-N", "5（8）", "mg/L"],
            ["城镇污水处理设施", "TP", "0.5", "mg/L"],
        ],
        "hasSurvey": False,
    },
}


def _set_cell_text(cell, value: Any, *, bold: bool = False) -> None:
    from docx.shared import Pt

    text = "" if value is None else str(value)
    cell.text = text
    for paragraph in cell.paragraphs:
        for run in paragraph.runs:
            run.font.name = "宋体"
            run.font.size = Pt(9)
            run.bold = bold


def _prepare_document(title: str):
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml.ns import qn
    from docx.shared import Cm, Pt, RGBColor

    document = Document()
    section = document.sections[0]
    section.top_margin = Cm(2.5)
    section.bottom_margin = Cm(2.5)
    section.left_margin = Cm(2.6)
    section.right_margin = Cm(2.4)
    normal = document.styles["Normal"]
    normal.font.name = "宋体"
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), "宋体")
    normal.font.size = Pt(10.5)
    for style_name, size in (("Heading 1", 16), ("Heading 2", 14), ("Heading 3", 12)):
        style = document.styles[style_name]
        style.font.name = "黑体"
        style._element.rPr.rFonts.set(qn("w:eastAsia"), "黑体")
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor(0, 0, 0)
    heading = document.add_paragraph()
    heading.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = heading.add_run(title)
    run.bold = True
    run.font.name = "黑体"
    run._element.rPr.rFonts.set(qn("w:eastAsia"), "黑体")
    run.font.size = Pt(18)
    return document


def _add_assessment_object(document, town_data: dict[str, Any], records: list[dict[str, Any]]) -> None:
    section_code = (town_data.get("reportTemplate") or {}).get("assessmentObjectSection") or town_data.get("chapterCode") or "1"
    document.add_heading(f"{section_code} 考核对象", level=1)
    objects = town_data.get("assessmentObject") or {}
    for facility_type in town_data.get("assessmentTargets") or []:
        item = objects.get(facility_type) or {}
        document.add_heading(item.get("title") or REPORT_TYPE_LABELS.get(facility_type, facility_type), level=2)
        document.add_paragraph(item.get("description") or "本次考核对象以系统项目目录及经复核的现场资料为准。")

    villages: dict[str, dict[str, Any]] = {}
    for record in records:
        if record.get("villageId"):
            villages[record["villageId"]] = record
    if villages:
        document.add_heading("农村设施点清单", level=2)
        table = document.add_table(rows=1, cols=5)
        table.style = "Table Grid"
        for cell, value in zip(table.rows[0].cells, ["序号", "行政村", "设施点", "章节号", "考核对象"]):
            _set_cell_text(cell, value, bold=True)
        for index, record in enumerate(sorted(villages.values(), key=lambda item: (item.get("villageChapterCode") or "", item.get("village") or "")), 1):
            row = table.add_row().cells
            obj = record.get("villageAssessmentObject") or {}
            for cell, value in zip(row, [index, record.get("administrativeVillage"), record.get("village"), record.get("villageChapterCode"), obj.get("title") or obj.get("description")]):
                _set_cell_text(cell, value)


def _add_paragraph(document, text: str, *, bold_prefix: str | None = None, indent: bool = True) -> None:
    from docx.shared import Pt

    paragraph = document.add_paragraph()
    paragraph.paragraph_format.line_spacing = 1.5
    if indent:
        paragraph.paragraph_format.first_line_indent = Pt(21)
    if bold_prefix and text.startswith(bold_prefix):
        run = paragraph.add_run(bold_prefix)
        run.bold = True
        run.font.name = "宋体"
        run.font.size = Pt(10.5)
        text = text[len(bold_prefix):]
    run = paragraph.add_run(text)
    run.font.name = "宋体"
    run.font.size = Pt(10.5)


def _add_simple_table(document, headers: list[str], rows: list[list[Any]]) -> None:
    from docx.oxml import OxmlElement

    def keep_row_together(row) -> None:
        row._tr.get_or_add_trPr().append(OxmlElement("w:cantSplit"))

    table = document.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    table.rows[0]._tr.get_or_add_trPr().append(OxmlElement("w:tblHeader"))
    keep_row_together(table.rows[0])
    for cell, value in zip(table.rows[0].cells, headers):
        _set_cell_text(cell, value, bold=True)
    for row_values in rows:
        table_row = table.add_row()
        keep_row_together(table_row)
        for cell, value in zip(table_row.cells, row_values):
            _set_cell_text(cell, value)


def _facility_types(records: list[dict[str, Any]]) -> list[str]:
    order = ["town_plant", "town_network", "rural_treatment"]
    present = {record.get("facilityType") or record.get("rawFacilityType") for record in records}
    return [item for item in order if item in present]


def _record_score_rows(records: list[dict[str, Any]]) -> list[list[Any]]:
    rows = []
    for index, record in enumerate(records, 1):
        raw_type = record.get("facilityType") or record.get("rawFacilityType")
        rows.append([
            index,
            REPORT_TYPE_LABELS.get(raw_type, raw_type or "-"),
            record.get("administrativeVillage") or "-",
            record.get("village") or record.get("town") or "-",
            STATUS_LABELS.get(record.get("status"), record.get("status") or "-"),
            f"{float(record.get('totalScore') or 0):.2f}",
        ])
    return rows


def _record_point_name(record: dict[str, Any]) -> str:
    return record.get("village") or record.get("town") or "该项目点"


def _format_report_time(value: Any) -> str:
    if not value:
        return "-"
    text = str(value).strip()
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return parsed.strftime("%Y-%m-%d %H:%M")
    except ValueError:
        return text.replace("T", " ")


def _deduction_rows(records: list[dict[str, Any]]) -> list[list[Any]]:
    rows = []
    for record in records:
        for score in record.get("scores") or []:
            if float(score.get("deduction") or 0) <= 0:
                continue
            rows.append([
                len(rows) + 1,
                record.get("village") or record.get("town") or "-",
                score.get("indicatorName") or "-",
                score.get("indicatorFullScore") or "-",
                score.get("deduction") or "0",
                score.get("reason") or score.get("deductionOptionName") or "-",
            ])
    return rows


def _all_score_rows(records: list[dict[str, Any]]) -> list[list[Any]]:
    rows = []
    for record in records:
        point_name = record.get("village") or record.get("town") or "-"
        for score in record.get("scores") or []:
            full_score = float(score.get("indicatorFullScore") or 0)
            deduction = float(score.get("deduction") or 0)
            rows.append([
                len(rows) + 1,
                point_name,
                score.get("indicatorCode") or "-",
                score.get("indicatorName") or "-",
                f"{full_score:.2f}",
                f"{max(full_score - deduction, 0):.2f}",
                f"{deduction:.2f}",
                score.get("reason") or score.get("deductionOptionName") or ("无扣分" if deduction == 0 else "-"),
            ])
    return rows


def _water_quality_rows(records: list[dict[str, Any]]) -> list[list[Any]]:
    rows = []
    for record in records:
        for item in record.get("waterQuality") or []:
            payload = item.get("payload") or {}
            rows.append([
                len(rows) + 1,
                record.get("village") or record.get("town") or "-",
                _format_report_time(payload.get("sampleTime") or item.get("sampledAt")),
                payload.get("codValue") or "-",
                payload.get("codLimit") or "-",
                payload.get("bod5Value") or "-",
                payload.get("bod5Limit") or "-",
                payload.get("ssValue") or "-",
                payload.get("ssLimit") or "-",
                payload.get("nh3nValue") or "-",
                payload.get("nh3nLimit") or "-",
                payload.get("tpValue") or "-",
                payload.get("tpLimit") or "-",
                "达标" if (item.get("conclusion") or payload.get("conclusion")) == "qualified" else "不达标" if (item.get("conclusion") or payload.get("conclusion")) == "unqualified" else "待判定",
            ])
    return rows


def _survey_rows(records: list[dict[str, Any]]) -> list[list[Any]]:
    rows = []
    for record in records:
        for item in record.get("surveys") or []:
            rows.append([
                len(rows) + 1,
                record.get("village") or "-",
                SURVEY_TYPE_LABELS.get(item.get("surveyType"), item.get("surveyType") or "-"),
                RESPONDENT_LABELS.get(item.get("respondent"), item.get("respondent") or "-"),
                item.get("score") if item.get("score") is not None else "-",
            ])
    return rows


def _attachment_rows(records: list[dict[str, Any]]) -> list[list[Any]]:
    rows = []
    for record in records:
        for item in record.get("attachments") or []:
            rows.append([
                len(rows) + 1,
                record.get("village") or record.get("town") or "-",
                item.get("filename") or "-",
                item.get("scoreId") or "-",
                item.get("deductionOptionId") or "-",
                item.get("size") or 0,
            ])
    return rows


def _accepted_agent_rows(records: list[dict[str, Any]]) -> list[list[Any]]:
    capability_labels = {
        "record_review_assist": "复核记录辅助校验",
        "report_semantic_check": "报告语义一致性校验",
    }
    rows = []
    for record in records:
        for item in record.get("agentRuns") or []:
            output = item.get("output") or {}
            capability = item.get("capability") or "-"
            rows.append([
                len(rows) + 1,
                record.get("village") or record.get("town") or "-",
                capability_labels.get(capability, capability),
                f"{float(item.get('confidence') or 0):.2f}",
                output.get("summary") or "-",
            ])
    return rows


def _score_stats(records: list[dict[str, Any]]) -> dict[str, float]:
    scores = [float(item.get("totalScore") or 0) for item in records]
    deductions = [float(row[4] or 0) for row in _deduction_rows(records)]
    return {
        "count": float(len(scores)),
        "average": sum(scores) / len(scores) if scores else 0.0,
        "min": min(scores) if scores else 0.0,
        "max": max(scores) if scores else 0.0,
        "deduction": sum(deductions),
    }


def _score_level(score: float) -> str:
    if score >= 90:
        return "较好"
    if score >= 80:
        return "基本达标"
    if score >= 70:
        return "需持续整改"
    if score >= 60:
        return "问题较多"
    return "不达标"


def _project_report_type(project_name: str, is_summary: bool) -> str:
    if "茂南" in project_name:
        return "城镇设施全区捆绑PPP项目绩效考核报告" if is_summary else "城镇设施绩效考核报告"
    return "镇村污水处理设施绩效考核报告" if is_summary else "镇村污水处理设施绩效考核报告"


def _add_cover_and_front_matter(
    document,
    *,
    title: str,
    project_name: str,
    cycle_name: str,
    scope_name: str,
    records: list[dict[str, Any]],
    towns: list[dict[str, Any]],
    profile: dict[str, Any],
    is_summary: bool,
) -> None:
    stats = _score_stats(records)
    document.add_paragraph("")
    _add_paragraph(document, f"项目名称：{project_name}", indent=False)
    _add_paragraph(document, f"报告名称：{_project_report_type(project_name, is_summary)}", indent=False)
    _add_paragraph(document, f"考核周期：{cycle_name}", indent=False)
    _add_paragraph(document, f"考核范围：{scope_name}", indent=False)
    _add_paragraph(document, f"编制时间：{datetime.now().strftime('%Y年%m月%d日')}", indent=False)
    document.add_page_break()

    document.add_heading("摘要", level=1)
    _add_paragraph(
        document,
        f"受项目绩效考核工作安排要求，本报告依据合同文件、项目绩效评价标准及现场核查资料，对{scope_name}在{cycle_name}的污水处理设施运行维护、资料管理、水质达标、现场管理及相关整改情况开展综合评价。",
    )
    _add_paragraph(
        document,
        f"本期纳入报告的考核记录共{int(stats['count'])}条，覆盖{len(towns) or 1}个镇街，平均得分为{stats['average']:.2f}分，最低得分为{stats['min']:.2f}分，最高得分为{stats['max']:.2f}分，累计扣分{stats['deduction']:.2f}分。总体评价结果为“{_score_level(stats['average'])}”。",
    )
    deductions = _deduction_rows(records)
    if deductions:
        leading = "、".join(str(row[2]) for row in deductions[:5])
        _add_paragraph(document, f"本期主要扣分问题集中在{leading}等方面。上述问题反映部分项目点在制度台账、现场运维、管网巡查、水质控制或资料闭环方面仍需加强。")
    else:
        _add_paragraph(document, "本期系统已复核数据未形成扣分明细，现场运维和资料提交总体符合当前评分记录要求。后续仍需持续保持日常巡查、台账归档和水质检测的完整性。")
    _add_paragraph(document, f"考核方式包括{'、'.join(profile['methods'])}。报告正文按考核工作概述、考核实施情况、考核结果、绩效付费建议、主要问题及整改建议、附件资料的顺序展开。")

    document.add_heading("目录", level=1)
    toc_rows = [
        [1, "第一章", "考核工作概述"],
        [2, "第二章", "考核对象及实施情况"],
        [3, "第三章", "绩效考核结果"],
        [4, "第四章", "绩效付费计算及结果应用"],
        [5, "第五章", "主要问题和整改工作建议"],
        [6, "附件1", "绩效考核评分明细"],
        [7, "附件2", "水质抽检及限值依据"],
        [8, "附件3", "现场照片及资料清单"],
    ]
    _add_simple_table(document, ["序号", "章节", "内容"], toc_rows)
    document.add_page_break()


def _add_chapter_one(document, *, project_name: str, cycle_name: str, scope_name: str, profile: dict[str, Any], is_summary: bool) -> None:
    document.add_heading("第一章 考核工作概述", level=1)
    document.add_heading("1.1 考核目的", level=2)
    _add_paragraph(document, f"本次绩效考核旨在客观评价{project_name}{cycle_name}污水处理设施运行维护成效，核查项目公司履行运营维护义务、设施稳定运行、污染物达标排放、资料归档和问题整改闭环等情况，为项目绩效评价、运营管理改进及后续付费结果应用提供依据。")
    _add_paragraph(document, "考核工作坚持以合同约定和现行评分标准为基础，以现场事实、运行台账、水质检测和复核资料为证据，避免以单一材料替代综合判断。对已形成扣分的事项，报告按评分点、扣分原因、扣分数量和最终扣分结果进行列示。")

    document.add_heading("1.2 考核依据", level=2)
    _add_paragraph(document, profile["basis"])
    _add_simple_table(
        document,
        ["序号", "依据类别", "主要内容"],
        [
            [1, "合同及补充文件", "PPP项目合同、补充协议、绩效考核办法及相关付费约定。"],
            [2, "考核标准", "本系统已发布并锁定的项目评分标准、扣分规则、水质限值及考核对象目录。"],
            [3, "现场资料", "现场检查记录、照片附件、运行维护台账、巡查记录、水质检测数据、问卷或访谈资料。"],
            [4, "监管要求", "国家和广东省污水处理、农村生活污水排放、城镇污水厂运行维护等相关规范要求。"],
        ],
    )

    document.add_heading("1.3 考核范围", level=2)
    _add_paragraph(document, f"本报告考核范围为{scope_name}。{'汇总报告覆盖当前项目和当前周期内所有已复核或已锁定的数据。' if is_summary else '单镇报告仅反映该镇街当前周期已复核或已锁定的数据。'}")
    _add_paragraph(document, "报告中涉及的镇街、项目点、考核对象和章节编号均以后台项目目录及本期提交数据为准；未提交或未复核的数据不作为本次报告评分依据。")

    document.add_heading("1.4 考核方法", level=2)
    _add_simple_table(document, ["序号", "方法", "工作要点"], [[index, item, "按项目评分标准对应的数据来源和检查方法核查，形成可追溯评分记录。"] for index, item in enumerate(profile["methods"], 1)])

    document.add_heading("1.5 评分及结果应用口径", level=2)
    _add_paragraph(document, "各评分点按满分值逐项扣减，单项扣分不超过该评分点满分。涉及“每处、每项、每次、每天”扣分的条款，按系统记录的扣分数量自动计算；涉及水质不合格或全月不合格判定的条款，按检测结论和评分标准回填对应扣分。")
    _add_paragraph(document, "绩效结果用于反映本期运维服务质量和整改重点。正式付费金额仍需结合合同约定的基数、周期、可用性付费和运维服务费公式，经业主或主管部门确认后执行。")


def _add_chapter_two(
    document,
    *,
    project_name: str,
    scope_name: str,
    records: list[dict[str, Any]],
    towns: list[dict[str, Any]],
    profile: dict[str, Any],
) -> None:
    document.add_heading("第二章 考核对象及实施情况", level=1)
    document.add_heading("2.1 考核对象", level=2)
    rows = []
    if towns:
        for index, town in enumerate(towns, 1):
            town_records = [item for item in records if item.get("town") == town.get("town")]
            types = "、".join(REPORT_TYPE_LABELS.get(item, item) for item in (town.get("assessmentTargets") or _facility_types(town_records)))
            rows.append([index, town.get("town") or "-", town.get("chapterCode") or "-", types or "-", len(town_records)])
    else:
        types = "、".join(REPORT_TYPE_LABELS.get(item, item) for item in _facility_types(records))
        rows.append([1, scope_name, "-", types or "-", len(records)])
    _add_simple_table(document, ["序号", "镇街", "章节号", "考核对象类别", "已复核记录数"], rows)

    village_records = [record for record in records if record.get("villageId")]
    if village_records:
        document.add_heading("2.2 项目点清单", level=2)
        point_rows = []
        for index, record in enumerate(sorted(village_records, key=lambda item: (item.get("town") or "", item.get("villageChapterCode") or "", item.get("village") or "")), 1):
            point_rows.append([
                index,
                record.get("town") or "-",
                record.get("administrativeVillage") or "-",
                record.get("village") or "-",
                record.get("villageChapterCode") or "-",
                REPORT_TYPE_LABELS.get(record.get("facilityType"), record.get("facilityType") or "-"),
            ])
        _add_simple_table(document, ["序号", "镇街", "行政村", "项目点", "章节号", "考核对象"], point_rows)

    document.add_heading("2.3 考核实施过程", level=2)
    _add_paragraph(document, f"考核组围绕{scope_name}已提交数据开展资料复核和结果汇总，对各评分点按标准逐项判定。对现场照片、巡查记录、设备运行记录、水质抽检和调查问卷等材料，报告按其对应评分点纳入证据目录。")
    _add_paragraph(document, "对存在扣分的评分点，本报告不以笼统问题描述替代评分依据，而是将扣分条目、满分、扣分、实得分、扣分原因及必要说明逐项列入附件，便于后续整改闭环。")

    document.add_heading("2.4 数据完整性核查", level=2)
    completeness_rows = []
    for index, record in enumerate(records, 1):
        completeness_rows.append([
            index,
            record.get("town") or "-",
            _record_point_name(record),
            record.get("scoreCount") or 0,
            record.get("surveyCount") or 0,
            record.get("waterQualityCount") or 0,
            record.get("attachmentCount") or 0,
            STATUS_LABELS.get(record.get("status"), record.get("status") or "-"),
        ])
    _add_simple_table(document, ["序号", "镇街", "项目点", "评分条目", "问卷", "水质", "附件", "状态"], completeness_rows)


def _add_chapter_three(document, *, records: list[dict[str, Any]], profile: dict[str, Any]) -> None:
    document.add_heading("第三章 绩效考核结果", level=1)
    stats = _score_stats(records)
    document.add_heading("3.1 评分结果汇总", level=2)
    _add_paragraph(document, f"本期共形成{int(stats['count'])}条有效评分记录，平均得分{stats['average']:.2f}分，整体评价为“{_score_level(stats['average'])}”。")
    _add_simple_table(document, ["序号", "考核类型", "行政村", "项目点", "状态", "得分"], _record_score_rows(records))

    by_type: dict[str, list[dict[str, Any]]] = {}
    for record in records:
        by_type.setdefault(record.get("facilityType") or record.get("rawFacilityType") or "unknown", []).append(record)
    type_rows = []
    for index, (facility_type, items) in enumerate(by_type.items(), 1):
        item_stats = _score_stats(items)
        type_rows.append([index, REPORT_TYPE_LABELS.get(facility_type, facility_type), len(items), f"{item_stats['average']:.2f}", f"{item_stats['deduction']:.2f}", _score_level(item_stats["average"])])
    document.add_heading("3.2 分类考核结果", level=2)
    _add_simple_table(document, ["序号", "类别", "记录数", "平均得分", "累计扣分", "评价"], type_rows)

    document.add_heading("3.3 评分明细", level=2)
    score_rows = _all_score_rows(records)
    if score_rows:
        _add_simple_table(document, ["序号", "项目点", "指标编号", "评分条目", "满分", "实得分", "扣分", "核查情况"], score_rows)
    else:
        _add_paragraph(document, "本次系统数据未记录完整评分明细。")

    document.add_heading("3.4 主要问题及扣分分析", level=2)
    deductions = _deduction_rows(records)
    if deductions:
        _add_simple_table(document, ["序号", "设施点", "评分条目", "满分", "扣分", "依据或说明"], deductions)
        grouped: dict[str, float] = {}
        for row in deductions:
            grouped[str(row[2])] = grouped.get(str(row[2]), 0) + float(row[4] or 0)
        leading = sorted(grouped.items(), key=lambda item: item[1], reverse=True)[:8]
        _add_paragraph(document, "从扣分分布看，主要问题集中在" + "、".join(f"{name}（累计扣{score:.2f}分）" for name, score in leading) + "。上述问题应分别建立整改台账，落实复核材料、现场照片和责任闭环。")
    else:
        _add_paragraph(document, "本次已复核数据未记录扣分项。")

    if profile.get("hasSurvey"):
        document.add_heading("3.5 问卷调查及公众反馈", level=2)
        rows = _survey_rows(records)
        if rows:
            _add_paragraph(document, f"本期共纳入{len(rows)}份问卷或访谈记录，作为农村设施污水收集效果、整体效果及满意度评价的辅助依据。")
            _add_simple_table(document, ["序号", "设施点", "调查类型", "对象", "得分"], rows)
        else:
            _add_paragraph(document, "本期系统未记录问卷调查数据。若正式考核需要引用调查结果，应在移动端补充后重新生成报告。")

    water_index = "3.6" if profile.get("hasSurvey") else "3.5"
    document.add_heading(f"{water_index} 水质抽检结果", level=2)
    water_rows = _water_quality_rows(records)
    if water_rows:
        qualified = sum(1 for row in water_rows if row[-1] == "达标")
        _add_paragraph(document, f"本期共记录{len(water_rows)}组水质抽检数据，其中{qualified}组达标，{len(water_rows) - qualified}组不达标或待判定。水质结论已回填至对应评分点。")
        _add_simple_table(document, ["序号", "项目点", "取样时间", "CODCr实测", "CODCr限值", "BOD5实测", "BOD5限值", "SS实测", "SS限值", "NH3-N实测", "NH3-N限值", "TP实测", "TP限值", "结论"], water_rows)
    else:
        _add_paragraph(document, "本期系统未记录水质抽检实测值。报告附件仍列示项目适用水质限值，供后续补充检测记录时比对。")


def _add_chapter_four(document, *, records: list[dict[str, Any]], profile: dict[str, Any]) -> None:
    document.add_heading("第四章 绩效付费计算及结果应用", level=1)
    stats = _score_stats(records)
    document.add_heading("4.1 绩效系数测算口径", level=2)
    _add_paragraph(document, "根据项目合同常用绩效付费逻辑，评分结果可用于测算可用性付费系数和运营维护服务费系数。系统当前报告优先输出评分结果、扣分明细和建议系数，不在缺少金额基数时自动虚构付费金额。")
    coefficient = 1.0 if stats["average"] >= 90 else max(stats["average"] / 100, 0)
    _add_simple_table(
        document,
        ["序号", "项目", "本期结果", "说明"],
        [
            [1, "平均得分", f"{stats['average']:.2f}", "按本期已复核记录算术平均。"],
            [2, "累计扣分", f"{stats['deduction']:.2f}", "按评分明细中扣分合计。"],
            [3, "建议绩效系数", f"{coefficient:.3f}", "未配置金额基数时仅作为结果应用参考。"],
        ],
    )
    document.add_heading("4.2 结果应用建议", level=2)
    _add_paragraph(document, "建议业主单位或主管部门在确认本报告评分结果后，结合合同约定的服务费基数、付费周期、扣减公式和考核确认程序，形成最终付费意见。")
    _add_paragraph(document, "对涉及水质不达标、停产、重大安全隐患、资料缺失等可能影响付费或整改责任的事项，应同步纳入问题清单并在下一周期进行复核。")


def _add_chapter_five_and_appendices(document, *, records: list[dict[str, Any]], profile: dict[str, Any]) -> None:
    document.add_heading("第五章 主要问题和整改工作建议", level=1)
    deductions = _deduction_rows(records)
    if deductions:
        grouped: dict[str, list[list[Any]]] = {}
        for row in deductions:
            grouped.setdefault(str(row[2]), []).append(row)
        for index, (name, rows) in enumerate(sorted(grouped.items(), key=lambda item: sum(float(row[4] or 0) for row in item[1]), reverse=True), 1):
            total = sum(float(row[4] or 0) for row in rows)
            points = "、".join(str(row[1]) for row in rows[:6])
            document.add_heading(f"5.{index} {name}", level=2)
            _add_paragraph(document, f"该类问题涉及{len(rows)}项扣分，累计扣{total:.2f}分，主要出现在{points}等项目点。建议项目实施单位对照评分标准逐项核查，补齐资料或整改现场问题，并形成复核记录。")
    else:
        document.add_heading("5.1 持续管理建议", level=2)
        _add_paragraph(document, "本期未形成扣分明细。建议继续加强日常巡查、台账归档、水质检测和设施维护工作，避免因资料不完整或现场管理松懈影响后续周期考核。")

    document.add_heading("附件1 绩效考核评分明细", level=1)
    score_rows = _all_score_rows(records)
    if score_rows:
        _add_simple_table(document, ["序号", "项目点", "指标编号", "评分条目", "满分", "实得分", "扣分", "核查情况"], score_rows)
    else:
        _add_paragraph(document, "本期无评分明细。")

    document.add_heading("附件2 水质抽检及限值依据", level=1)
    _add_paragraph(document, profile["waterStandard"])
    _add_simple_table(document, ["序号", "对象", "指标", "限值", "单位"], [[index, *row] for index, row in enumerate(profile["waterRows"], 1)])
    water_rows = _water_quality_rows(records)
    if water_rows:
        _add_simple_table(document, ["序号", "项目点", "取样时间", "CODCr实测", "CODCr限值", "BOD5实测", "BOD5限值", "SS实测", "SS限值", "NH3-N实测", "NH3-N限值", "TP实测", "TP限值", "结论"], water_rows)

    document.add_heading("附件3 现场照片及资料清单", level=1)
    attachment_rows = _attachment_rows(records)
    if attachment_rows:
        _add_simple_table(document, ["序号", "设施点", "文件名", "评分记录", "扣分项", "大小"], attachment_rows)
    else:
        _add_paragraph(document, "本期系统未记录现场照片或附件。")

    agent_rows = _accepted_agent_rows(records)
    if agent_rows:
        document.add_heading("附件4 系统辅助复核记录", level=1)
        _add_simple_table(document, ["序号", "项目点", "复核能力", "置信度", "摘要"], agent_rows)


def _generate_town_document(project_name: str, cycle_name: str, town_data: dict[str, Any], records: list[dict[str, Any]]):
    profile = PROJECT_REPORT_PROFILES.get(project_name) or PROJECT_REPORT_PROFILES["郁南项目"]
    town_name = town_data["town"]
    title = f"{project_name}{town_name}{cycle_name}{profile['titleSuffix']}"
    document = _prepare_document(title)
    towns = [town_data]
    _add_cover_and_front_matter(document, title=title, project_name=project_name, cycle_name=cycle_name, scope_name=town_name, records=records, towns=towns, profile=profile, is_summary=False)
    _add_chapter_one(document, project_name=project_name, cycle_name=cycle_name, scope_name=town_name, profile=profile, is_summary=False)
    _add_chapter_two(document, project_name=project_name, scope_name=town_name, records=records, towns=towns, profile=profile)
    _add_chapter_three(document, records=records, profile=profile)
    _add_chapter_four(document, records=records, profile=profile)
    _add_chapter_five_and_appendices(document, records=records, profile=profile)
    return document


def _generate_summary_document(project_name: str, cycle_name: str, snapshot: dict[str, Any]):
    profile = PROJECT_REPORT_PROFILES.get(project_name) or PROJECT_REPORT_PROFILES["郁南项目"]
    title = f"{project_name}{cycle_name}{profile['titleSuffix']}汇总报告"
    document = _prepare_document(title)
    all_records = snapshot.get("records") or []
    towns = snapshot.get("towns") or []
    scope_name = f"{project_name}全部项目"
    _add_cover_and_front_matter(document, title=title, project_name=project_name, cycle_name=cycle_name, scope_name=scope_name, records=all_records, towns=towns, profile=profile, is_summary=True)
    _add_chapter_one(document, project_name=project_name, cycle_name=cycle_name, scope_name=scope_name, profile=profile, is_summary=True)
    _add_chapter_two(document, project_name=project_name, scope_name=scope_name, records=all_records, towns=towns, profile=profile)
    _add_chapter_three(document, records=all_records, profile=profile)
    _add_chapter_four(document, records=all_records, profile=profile)
    _add_chapter_five_and_appendices(document, records=all_records, profile=profile)
    return document


def _add_record_results(document, records: list[dict[str, Any]]) -> None:
    document.add_heading("考核结果", level=1)
    summary = document.add_table(rows=1, cols=6)
    summary.style = "Table Grid"
    for cell, value in zip(summary.rows[0].cells, ["序号", "考核类型", "行政村", "设施点", "状态", "得分"]):
        _set_cell_text(cell, value, bold=True)
    for index, record in enumerate(records, 1):
        raw_type = record.get("facilityType") or record.get("rawFacilityType")
        row = summary.add_row().cells
        for cell, value in zip(row, [index, REPORT_TYPE_LABELS.get(raw_type, raw_type or "-"), record.get("administrativeVillage") or "-", record.get("village") or "-", record.get("status"), f"{float(record.get('totalScore') or 0):.2f}"]):
            _set_cell_text(cell, value)

    deductions = []
    for record in records:
        for score in record.get("scores") or []:
            if float(score.get("deduction") or 0) > 0:
                deductions.append((record, score))
    document.add_heading("扣分明细", level=2)
    if not deductions:
        document.add_paragraph("本次已复核数据未记录扣分项。")
        return
    table = document.add_table(rows=1, cols=6)
    table.style = "Table Grid"
    for cell, value in zip(table.rows[0].cells, ["序号", "设施点", "评分条目", "满分", "扣分", "依据或说明"]):
        _set_cell_text(cell, value, bold=True)
    for index, (record, score) in enumerate(deductions, 1):
        row = table.add_row().cells
        for cell, value in zip(row, [index, record.get("village") or record.get("town"), score.get("indicatorName"), score.get("indicatorFullScore"), score.get("deduction"), score.get("reason") or score.get("deductionOptionName")]):
            _set_cell_text(cell, value)


def _generate_project_reports(task: ReportTask, snapshot: dict[str, Any]) -> Path:
    output_dir = _storage_root() / "generated_reports" / "working" / task.id
    output_dir.mkdir(parents=True, exist_ok=True)
    project_name = snapshot.get("projectName") or "项目"
    cycle_name = snapshot.get("cycleName") or task.payload.get("period") or "本期"
    for town_data in snapshot.get("towns") or []:
        town_name = town_data["town"]
        records = [item for item in snapshot.get("records") or [] if item.get("town") == town_name]
        profile = PROJECT_REPORT_PROFILES.get(project_name) or PROJECT_REPORT_PROFILES["郁南项目"]
        document = _generate_town_document(project_name, cycle_name, town_data, records)
        document.save(output_dir / f"{town_name}-{cycle_name}-{profile['shortName']}{profile['titleSuffix']}（正文）.docx")

    if "summary" in task.payload.get("outputs", []):
        profile = PROJECT_REPORT_PROFILES.get(project_name) or PROJECT_REPORT_PROFILES["郁南项目"]
        document = _generate_summary_document(project_name, cycle_name, snapshot)
        document.save(output_dir / f"{project_name}-{cycle_name}-{profile['shortName']}{profile['titleSuffix']}汇总报告.docx")
    return output_dir


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
    with SessionLocal() as session:
        task = session.get(ReportTask, task_id)
        if task is None:
            return
        task.status, task.progress, task.started_at, task.error = "running", 10, utcnow(), None
        session.commit()
        try:
            town_names = set(task.payload.get("townNames", []))
            outputs = set(task.payload.get("outputs", []))
            include_separate = "separate" in outputs
            include_summary = "summary" in outputs
            project_id = task.payload.get("projectId")
            cycle = session.get(AssessmentCycle, task.cycle_id) if task.cycle_id else None
            record_query = select(AssessmentRecord).where(AssessmentRecord.status.in_(["reviewed", "locked"]))
            if project_id:
                record_query = record_query.where(AssessmentRecord.city_id == project_id)
            if task.cycle_id:
                record_query = record_query.where(AssessmentRecord.cycle_id == task.cycle_id)
            records = list(session.scalars(record_query))
            if town_names and not include_summary:
                records = [record for record in records if record.town.name in town_names]
            dataset_town_names = None if include_summary else (town_names or None)
            snapshot = build_report_dataset(session, cycle=cycle, town_names=dataset_town_names, city_id=project_id)
            if task.payload.get("source") == "dashboard":
                validate_report_dataset(snapshot)
            task.data_snapshot = snapshot
            task.dataset_hash = snapshot.get("hash")
            session.commit()
            output_dir = _generate_project_reports(task, snapshot)
            task.progress = 80
            names = town_names
            output_paths = []
            for path in output_dir.glob("*.docx"):
                report_town = path.stem.split("-", 1)[0]
                is_summary = path.stem.endswith("汇总报告")
                if is_summary:
                    if not include_summary:
                        continue
                else:
                    if not include_separate:
                        continue
                    if names and report_town not in names:
                        continue
                if names and report_town not in names and not (include_summary and is_summary):
                    continue
                output_paths.append(path)
            if not output_paths:
                raise RuntimeError("Official report generator did not produce any matching DOCX files.")
            task.progress = 90
            for path in output_paths:
                report_town = path.stem.split("-", 1)[0]
                town_query = select(Town).where(Town.name == report_town)
                if project_id:
                    town_query = town_query.where(Town.city_id == project_id)
                town = session.scalar(town_query)
                town_id = town.id if town else None
                version = _next_report_version(session, name=path.name, cycle_id=task.cycle_id, town_id=town_id)
                final_path = _versioned_report_path(task.id, version, path)
                shutil.copy2(path, final_path)
                town_records = [item for item in snapshot.get("records", []) if item.get("town") == report_town]
                if path.stem.endswith("汇总报告"):
                    town_records = snapshot.get("records", [])
                report_snapshot = {
                    "hash": task.dataset_hash,
                    "cycleId": snapshot.get("cycleId"),
                    "cycleName": snapshot.get("cycleName"),
                    "projectId": snapshot.get("projectId"),
                    "projectName": snapshot.get("projectName"),
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
            try:
                from app.services.agent import create_report_task_agent_run

                create_report_task_agent_run(session, task)
            except Exception as agent_exc:
                task.payload = {**task.payload, "agentWarning": str(agent_exc)}
            task.status, task.progress, task.completed_at = "completed", 100, utcnow()
        except Exception as exc:
            task.status = "failed"
            task.error = f"{exc}\n{traceback.format_exc(limit=5)}"
        session.commit()
