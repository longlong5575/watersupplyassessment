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


def _add_title_and_preface(document, *, title: str, project_name: str, cycle_name: str, town_name: str, profile: dict[str, Any]) -> None:
    _add_paragraph(document, f"项目名称：{project_name}", indent=False)
    _add_paragraph(document, f"考核周期：{cycle_name}", indent=False)
    _add_paragraph(document, f"考核镇街：{town_name}", indent=False)
    _add_paragraph(document, f"报告类型：{profile['titleSuffix']}", indent=False)
    document.add_paragraph("")
    document.add_heading("一、考核概况", level=1)
    _add_paragraph(document, profile["basis"])
    _add_paragraph(document, f"本次绩效考核以{town_name}纳入本期考核范围的污水处理设施及其配套设施为对象，通过现场检查、资料核查、水质检测和评分复核，对设施运行维护质量及管理成效进行综合评价。")
    document.add_heading("1.1 考核方法", level=2)
    _add_simple_table(document, ["序号", "工作内容"], [[index, item] for index, item in enumerate(profile["methods"], 1)])


def _add_implementation_overview(document, town_data: dict[str, Any], records: list[dict[str, Any]]) -> None:
    document.add_heading("二、考核实施情况", level=1)
    types = _facility_types(records)
    type_names = "、".join(REPORT_TYPE_LABELS.get(item, item) for item in types) or "相关污水处理设施"
    _add_paragraph(document, f"本期考核工作围绕{type_names}展开，共形成{len(records)}条经复核的考核记录。考核组依据对应项目评分标准，对各评分点的资料完整性、现场运行状况、水质检测结果及相关佐证材料逐项核查。")
    _add_paragraph(document, "评分过程坚持一项一据、据实评价原则；涉及按处、按项、按次扣分的内容，根据已确认数量计算扣分，并以该评分点满分为扣分上限。涉及水质不合格判定的内容，按对应标准及检测限值统一处理。")


def _add_project_assessment_object(document, town_data: dict[str, Any], records: list[dict[str, Any]], *, heading_prefix: str) -> None:
    section_code = (town_data.get("reportTemplate") or {}).get("assessmentObjectSection") or town_data.get("chapterCode") or heading_prefix
    document.add_heading(f"{section_code} 考核对象", level=1)
    objects = town_data.get("assessmentObject") or {}
    facility_rows = []
    targets = town_data.get("assessmentTargets") or _facility_types(records)
    for index, facility_type in enumerate(targets, 1):
        item = objects.get(facility_type) or {}
        facility_rows.append([
            index,
            REPORT_TYPE_LABELS.get(facility_type, facility_type),
            item.get("title") or REPORT_TYPE_LABELS.get(facility_type, facility_type),
            item.get("description") or "以系统项目目录及经复核的现场资料为准。",
        ])
    _add_simple_table(document, ["序号", "类别", "考核对象", "基本情况"], facility_rows)

    village_records = [record for record in records if record.get("villageId")]
    if village_records:
        rows = []
        for index, record in enumerate(sorted(village_records, key=lambda item: (item.get("villageChapterCode") or "", item.get("village") or "")), 1):
            obj = record.get("villageAssessmentObject") or {}
            rows.append([
                index,
                record.get("administrativeVillage") or "-",
                record.get("village") or "-",
                record.get("villageChapterCode") or "-",
                obj.get("title") or obj.get("description") or "-",
            ])
        document.add_heading("农村设施点清单", level=2)
        _add_simple_table(document, ["序号", "行政村", "自然村/设施点", "章节号", "考核对象"], rows)


def _add_project_results(document, records: list[dict[str, Any]], profile: dict[str, Any]) -> None:
    document.add_heading("三、考核结果", level=1)
    _add_simple_table(document, ["序号", "考核类型", "行政村", "设施点", "状态", "得分"], _record_score_rows(records))

    scores = [float(item.get("totalScore") or 0) for item in records]
    average = sum(scores) / len(scores) if scores else 0
    deductions = _deduction_rows(records)
    document.add_heading("3.1 综合评价", level=2)
    _add_paragraph(document, f"本次纳入评价的项目点共{len(records)}个，平均得分为{average:.2f}分。评分结果以后台复核确认后的记录为依据，共识别{len(deductions)}条扣分问题。")
    for record in records:
        point_name = _record_point_name(record)
        raw_type = record.get("facilityType") or record.get("rawFacilityType")
        record_deductions = [score for score in record.get("scores") or [] if float(score.get("deduction") or 0) > 0]
        _add_paragraph(document, f"{point_name}的考核对象为{REPORT_TYPE_LABELS.get(raw_type, raw_type or '相关设施')}，本期得分为{float(record.get('totalScore') or 0):.2f}分，共记录{len(record_deductions)}项扣分。评价结果反映了本期已提交并经复核资料所对应的运行维护和管理情况。")

    document.add_heading("3.2 评分明细", level=2)
    score_rows = _all_score_rows(records)
    if score_rows:
        _add_simple_table(document, ["序号", "项目点", "指标编号", "评分条目", "满分", "实得分", "扣分", "核查情况"], score_rows)
    else:
        _add_paragraph(document, "本次系统数据未记录完整评分明细。")

    document.add_heading("3.3 主要问题及扣分分析", level=2)
    if deductions:
        _add_paragraph(document, "经逐项核查，扣分问题主要分布在下列评分条目。各项扣分均对应已确认的评分记录，具体问题及扣分情况如下。")
        _add_simple_table(document, ["序号", "设施点", "评分条目", "满分", "扣分", "依据或说明"], deductions)
        grouped: dict[str, float] = {}
        for row in deductions:
            grouped[str(row[2])] = grouped.get(str(row[2]), 0) + float(row[4] or 0)
        leading = sorted(grouped.items(), key=lambda item: item[1], reverse=True)[:5]
        _add_paragraph(document, "从扣分分布看，主要问题集中在" + "、".join(f"{name}（累计扣{score:.2f}分）" for name, score in leading) + "。后续整改应结合评分依据、现场佐证和责任分工逐项闭环。")
    else:
        _add_paragraph(document, "本次已复核数据未记录扣分项。现有资料反映各评分点满足本期考核要求，后续仍应保持运行维护资料和现场管理记录完整。")

    if profile.get("hasSurvey"):
        document.add_heading("3.4 公众调查分析", level=2)
        rows = _survey_rows(records)
        if rows:
            survey_scores = [float(row[4]) for row in rows if isinstance(row[4], (int, float))]
            survey_average = sum(survey_scores) / len(survey_scores) if survey_scores else 0
            _add_paragraph(document, f"本期共纳入{len(rows)}份有效调查记录，平均得分为{survey_average:.2f}分。调查结果作为污水收集效果、整体效果及满意度相关评分的评价依据之一。")
            _add_simple_table(document, ["序号", "设施点", "调查类型", "对象", "得分"], rows)
        else:
            _add_paragraph(document, "本次系统数据未记录公众调查表；农村设施正式报告可在补充问卷后自动纳入。")

    water_heading = "3.5 水质抽检分析" if profile.get("hasSurvey") else "3.4 水质抽检分析"
    document.add_heading(water_heading, level=2)
    rows = _water_quality_rows(records)
    if rows:
        qualified = sum(1 for row in rows if row[-1] == "达标")
        _add_paragraph(document, f"本期共记录{len(rows)}组水质抽检数据，其中{qualified}组判定为达标、{len(rows) - qualified}组判定为不达标或待判定。各指标实测值与对应排放限值的比对结果如下。")
        _add_simple_table(document, ["序号", "项目点", "取样时间", "CODCr实测", "CODCr限值", "BOD5实测", "BOD5限值", "SS实测", "SS限值", "NH3-N实测", "NH3-N限值", "TP实测", "TP限值", "结论"], rows)
    else:
        _add_paragraph(document, "本次系统数据未记录水质抽检实测值；报告附录仍列示对应项目水质限值。")

    attachment_heading = "3.6 证据附件目录" if profile.get("hasSurvey") else "3.5 证据附件目录"
    document.add_heading(attachment_heading, level=2)
    attachment_rows = _attachment_rows(records)
    if attachment_rows:
        _add_simple_table(document, ["序号", "设施点", "文件名", "评分记录", "扣分项", "大小"], attachment_rows)
    else:
        _add_paragraph(document, "本次系统数据未记录现场照片或附件。")

def _add_project_conclusion_and_appendix(document, records: list[dict[str, Any]], profile: dict[str, Any]) -> None:
    scores = [float(item.get("totalScore") or 0) for item in records]
    average = sum(scores) / len(scores) if scores else 0
    document.add_heading("四、结论与建议", level=1)
    _add_paragraph(document, f"综合现场检查、资料核查、水质检测及评分复核结果，本次纳入报告的考核记录共{len(records)}条，平均得分为{average:.2f}分。最终考核结果以主管部门确认意见为准。")
    deductions = _deduction_rows(records)
    if deductions:
        _add_paragraph(document, f"本期共形成{len(deductions)}条扣分明细。建议项目实施单位对照评分标准建立整改台账，明确责任人、整改措施和完成时限；对运行记录、维护台账和现场管理类问题及时补正，对水质和设施运行类问题持续跟踪复核，形成问题发现、整改落实和复核销号的闭环管理。")
    else:
        _add_paragraph(document, "本期未形成扣分明细，建议继续保持运行维护资料、现场巡查和水质检测记录完整归档。")

    document.add_heading("附录A 水质评价限值", level=1)
    _add_paragraph(document, profile["waterStandard"])
    _add_simple_table(document, ["序号", "对象", "指标", "限值", "单位"], [[index, *row] for index, row in enumerate(profile["waterRows"], 1)])


def _generate_town_document(project_name: str, cycle_name: str, town_data: dict[str, Any], records: list[dict[str, Any]]):
    profile = PROJECT_REPORT_PROFILES.get(project_name) or PROJECT_REPORT_PROFILES["郁南项目"]
    town_name = town_data["town"]
    title = f"{project_name}{town_name}{cycle_name}{profile['titleSuffix']}"
    document = _prepare_document(title)
    _add_title_and_preface(document, title=title, project_name=project_name, cycle_name=cycle_name, town_name=town_name, profile=profile)
    _add_implementation_overview(document, town_data, records)
    _add_project_assessment_object(document, town_data, records, heading_prefix="二")
    _add_project_results(document, records, profile)
    _add_project_conclusion_and_appendix(document, records, profile)
    return document


def _generate_summary_document(project_name: str, cycle_name: str, snapshot: dict[str, Any]):
    profile = PROJECT_REPORT_PROFILES.get(project_name) or PROJECT_REPORT_PROFILES["郁南项目"]
    title = f"{project_name}{cycle_name}{profile['titleSuffix']}汇总报告"
    document = _prepare_document(title)
    _add_title_and_preface(
        document,
        title=title,
        project_name=project_name,
        cycle_name=cycle_name,
        town_name="全项目",
        profile=profile,
    )
    all_records = snapshot.get("records") or []
    towns = snapshot.get("towns") or []
    document.add_heading("二、考核实施情况", level=1)
    _add_paragraph(document, profile["basis"])
    _add_paragraph(
        document,
        f"本次汇总覆盖{len(towns)}个镇街、{len(all_records)}个已提交并经复核的考核对象。"
        f"考核采用{'、'.join(profile['methods'])}等方式，对各镇街和项目点的评分资料进行汇总分析。",
    )
    document.add_heading("2.1 考核对象与范围", level=2)
    rows = []
    for index, town in enumerate(towns, 1):
        records = [item for item in all_records if item.get("town") == town["town"]]
        scores = [float(item.get("totalScore") or 0) for item in records]
        types = "、".join(REPORT_TYPE_LABELS.get(item, item) for item in (town.get("assessmentTargets") or _facility_types(records)))
        rows.append([index, town["town"], town.get("chapterCode") or "-", types, len(records), f"{(sum(scores) / len(scores) if scores else 0):.2f}"])
    _add_simple_table(document, ["序号", "镇街", "章节号", "考核对象", "记录数", "平均得分"], rows)
    _add_project_results(document, all_records, profile)
    _add_project_conclusion_and_appendix(document, all_records, profile)
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
            project_id = task.payload.get("projectId")
            cycle = session.get(AssessmentCycle, task.cycle_id) if task.cycle_id else None
            record_query = select(AssessmentRecord).where(AssessmentRecord.status.in_(["reviewed", "locked"]))
            if project_id:
                record_query = record_query.where(AssessmentRecord.city_id == project_id)
            if task.cycle_id:
                record_query = record_query.where(AssessmentRecord.cycle_id == task.cycle_id)
            records = list(session.scalars(record_query))
            if town_names:
                records = [record for record in records if record.town.name in town_names]
            snapshot = build_report_dataset(session, cycle=cycle, town_names=town_names or None, city_id=project_id)
            if task.payload.get("source") == "dashboard":
                validate_report_dataset(snapshot)
            task.data_snapshot = snapshot
            task.dataset_hash = snapshot.get("hash")
            session.commit()
            include_summary = "summary" in task.payload.get("outputs", [])
            output_dir = _generate_project_reports(task, snapshot)
            task.progress = 80
            names = town_names
            output_paths = []
            for path in output_dir.glob("*.docx"):
                report_town = path.stem.split("-", 1)[0]
                is_summary = path.stem.endswith("汇总报告")
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
