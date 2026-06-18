import os
import re
import shutil
from decimal import Decimal, ROUND_HALF_UP

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt


BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SOURCE = os.path.join(BASE, "skills", "report", "assets", "正文底稿.docx")
OUTPUTS = os.path.join(BASE, "outputs")
FINAL_DIR = os.path.join(BASE, "生成")
DATA_DIR = os.path.join(BASE, "资料收集")

TOWNS = [
    "北陡镇",
    "汶村镇",
    "白沙镇",
    "三合镇",
    "深井镇",
    "四九镇",
    "大江镇",
    "都斛镇",
    "赤溪镇",
    "冲蒌镇",
    "端芬镇",
    "川岛镇",
    "广海镇",
    "海宴镇",
    "台城街道",
    "水步镇",
    "斗山镇",
]

REGENERATE = set(TOWNS)


def clean_text(text):
    return "".join(str(text or "").split())


def row_texts_xml(row):
    cells = []
    for tc in row._tr.tc_lst:
        cells.append(clean_text("".join(t.text or "" for t in tc.iter() if t.tag.endswith("}t"))))
    return cells


def set_tc_text(tc, text):
    ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    paragraphs = tc.findall(f".//{ns}p")
    if not paragraphs:
        p = OxmlElement("w:p")
        tc.append(p)
        paragraphs = [p]
    first_p = paragraphs[0]
    for child in list(first_p):
        first_p.remove(child)
    r = OxmlElement("w:r")
    t = OxmlElement("w:t")
    t.text = text
    r.append(t)
    first_p.append(r)


def para_text(el):
    ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    return "".join(t.text or "" for t in el.findall(f".//{ns}t")).strip()


def para_style(el):
    ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    pstyle = el.find(f".//{ns}pStyle")
    return pstyle.get(qn("w:val")) if pstyle is not None else ""


def is_town_heading(text):
    return text.endswith("农村污水处理设施考核情况") and text != "农村污水处理设施考核情况"


def set_para_text(paragraph, text):
    for run in paragraph.runs:
        run.text = ""
    if paragraph.runs:
        paragraph.runs[0].text = text
    else:
        paragraph.add_run(text)


def is_title_paragraph(paragraph):
    text = paragraph.text.strip()
    if not text:
        return False
    style = paragraph.style.name if paragraph.style is not None else ""
    if style.startswith("Heading") or "标题" in style:
        return True
    if re.match(r"^第[一二三四五六七八九十]+章", text):
        return True
    if re.match(r"^\d+(\.\d+)*\s+", text):
        return True
    if text.endswith("考核情况") or text.endswith("评分情况") or text.endswith("汇总表") or text.endswith("评价表"):
        return True
    if "绩效考核服务项目" in text and ("报告" in text or "正文" in text):
        return True
    return False


def apply_font_rules(doc):
    for paragraph in doc.paragraphs:
        title = is_title_paragraph(paragraph)
        for run in paragraph.runs:
            run.font.name = "宋体"
            run._element.rPr.rFonts.set(qn("w:eastAsia"), "宋体")
            run._element.rPr.rFonts.set(qn("w:ascii"), "宋体")
            run._element.rPr.rFonts.set(qn("w:hAnsi"), "宋体")
            run.bold = True if title else False
    for table in doc.tables:
        for row in table._tbl.tr_lst:
            for tc in row.tc_lst:
                for r in tc.iter():
                    if not r.tag.endswith("}r"):
                        continue
                    rpr = r.find(qn("w:rPr"))
                    if rpr is None:
                        rpr = OxmlElement("w:rPr")
                        r.insert(0, rpr)
                    rfonts = rpr.find(qn("w:rFonts"))
                    if rfonts is None:
                        rfonts = OxmlElement("w:rFonts")
                        rpr.append(rfonts)
                    rfonts.set(qn("w:eastAsia"), "宋体")
                    rfonts.set(qn("w:ascii"), "宋体")
                    rfonts.set(qn("w:hAnsi"), "宋体")
                    for b in rpr.findall(qn("w:b")) + rpr.findall(qn("w:bCs")):
                        rpr.remove(b)
    for section in doc.sections:
        for part in (section.header, section.footer):
            for paragraph in part.paragraphs:
                for run in paragraph.runs:
                    run.font.name = "宋体"
                    run._element.rPr.rFonts.set(qn("w:eastAsia"), "宋体")
                    run._element.rPr.rFonts.set(qn("w:ascii"), "宋体")
                    run._element.rPr.rFonts.set(qn("w:hAnsi"), "宋体")
                    run.bold = False


def decimal2(value):
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def table_rows(doc, town_col_name="镇街"):
    for table in doc.tables:
        town_col = None
        header_rows = 0
        for ri, row in enumerate(table.rows[:3]):
            vals = [clean_text(cell.text) for cell in row.cells]
            if town_col_name in vals:
                town_col = vals.index(town_col_name)
                header_rows = ri + 1
                break
        if town_col is None:
            continue
        yield table, town_col, header_rows


def collect_metrics():
    metrics = {town: {"sample": [], "pay": {}} for town in TOWNS}

    for town, data in metrics.items():
        path = os.path.join(DATA_DIR, town, f"{town}附件资料.docx")
        if not os.path.exists(path):
            raise FileNotFoundError(f"缺少资料收集文件：{path}")
        doc = Document(path)
        titles = [p.text.strip() for p in doc.paragraphs if p.text.strip().endswith("污水处理设施绩效评价表")]
        score_tables = []
        for table in doc.tables:
            if len(table.rows) < 3 or len(table.columns) < 7:
                continue
            last = [clean_text(c.text) for c in table.rows[-1].cells]
            if "评分" in last[:5]:
                try:
                    score = Decimal(last[6])
                except Exception:
                    continue
                score_tables.append((table, score))
        for idx, (_, score) in enumerate(score_tables):
            if score >= 90:
                ec1, ec2 = Decimal("1"), Decimal("1")
            elif score >= 80:
                ec1, ec2 = (Decimal("100") - (Decimal("90") - score) * Decimal("0.5")) / Decimal("100"), Decimal("1")
            elif score >= 70:
                ec1 = (Decimal("95") - (Decimal("80") - score) * Decimal("1")) / Decimal("100")
                ec2 = (Decimal("100") - (Decimal("80") - score) * Decimal("0.5")) / Decimal("100")
            else:
                ec1 = (Decimal("85") - (Decimal("70") - score) * Decimal("1.5")) / Decimal("100")
                ec2 = (Decimal("95") - (Decimal("70") - score) * Decimal("1")) / Decimal("100")
            name = titles[idx + 1] if idx + 1 < len(titles) else f"第{idx + 1}个设施"
            data["sample"].append({"name": name, "score": float(score), "ec1": str(ec1), "ec2": str(ec2)})

        for table in doc.tables:
            header = "|".join(clean_text(c.text) for r in table.rows[:2] for c in r.cells)
            if "进水" in header and "出水是否达标" in header and "COD" in header:
                water = {"count": 0, "out_ok": 0, "cod_low": 0, "cod_high": 0, "nh3_high": 0}
                for row in table.rows[2:]:
                    vals = [clean_text(c.text) for c in row.cells]
                    if len(vals) < 13 or vals[1] != town:
                        continue
                    water["count"] += 1
                    water["out_ok"] += 1 if vals[12] == "是" else 0
                    try:
                        cod = Decimal(vals[8].replace("L", ""))
                        nh3 = Decimal(vals[9].replace("L", ""))
                    except Exception:
                        continue
                    water["cod_low"] += 1 if cod < 100 else 0
                    water["cod_high"] += 1 if cod > 170 else 0
                    water["nh3_high"] += 1 if nh3 > 28 else 0
                data["water"] = water
            if "村民满意度得分" in header and "实施机构满意度评分" in header:
                last = [clean_text(c.text) for c in table.rows[-1].cells]
                if len(last) >= 9:
                    data["satisfaction"] = {"public": last[-3], "town": last[-2], "agency": last[-1]}

        scores = [item["score"] for item in data["sample"]]
        if scores:
            data["sample_count"] = len(scores)
            data["score_ge90"] = sum(1 for s in scores if s >= 90)
            data["score_80_90"] = sum(1 for s in scores if 80 <= s < 90)
            data["score_lt80"] = sum(1 for s in scores if s < 80)
            ec1_values = [Decimal(item["ec1"]) for item in data["sample"] if item["ec1"]]
            ec2_values = [Decimal(item["ec2"]) for item in data["sample"] if item["ec2"]]
            data["ec1"] = (sum(ec1_values) / Decimal(len(ec1_values))).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
            data["ec2"] = (sum(ec2_values) / Decimal(len(ec2_values))).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    return metrics


def update_toc(doc, target):
    body = doc._body._element
    anchor = None
    for p in list(doc.paragraphs):
        if p.text.strip() == "目录":
            anchor = p
        if p.style.name.lower().startswith("toc"):
            body.remove(p._element)
    if anchor is None:
        return
    lines = [
        "第一章  考核工作概述",
        "1.1  考核目的",
        "1.2  考核要求",
        "1.3  考核依据",
        "1.4  考核成员及分工责任",
        "1.5  考核频次",
        "1.6  考核方法",
        "1.7  考核安排",
        "第二章  农村污水处理设施考核结果",
        "2.1  农村污水处理设施考核情况",
        f"2.2  {target}农村污水处理设施考核情况",
        "第三章  绩效付费计算",
        "3.1  付费范围",
        "3.2  付费依据",
        "3.3  农村污水处理服务费支付计算方法",
        "3.4  农村污水处理设施项目服务费",
        "3.5  计费系数",
        "3.6  农村污水处理设施服务费计算",
        "3.7  付费建议",
        "3.8  考核付费结果分析",
        "第四章  主要问题及整改工作建议",
        "4.1  主要问题",
        "4.2  项目公司整改建议",
    ]
    after = anchor._element
    for line in lines:
        p = OxmlElement("w:p")
        r = OxmlElement("w:r")
        t = OxmlElement("w:t")
        t.text = line
        r.append(t)
        p.append(r)
        after.addnext(p)
        after = p


def remove_unrelated_town_sections(doc, target):
    h1_id = doc.styles["Heading 1"].style_id
    h2_id = doc.styles["Heading 2"].style_id
    body = doc._body._element
    elems = list(body)
    remove = set()
    i = 0
    while i < len(elems):
        el = elems[i]
        if el.tag.endswith("}p"):
            text = para_text(el).replace(" ", "")
            style = para_style(el)
            if style == h2_id and is_town_heading(text) and target not in text:
                j = i + 1
                while j < len(elems):
                    t2 = para_text(elems[j]).replace(" ", "")
                    s2 = para_style(elems[j])
                    if elems[j].tag.endswith("}p") and (
                        (s2 == h2_id and is_town_heading(t2))
                        or (s2 == h1_id and ("绩效付费计算" in t2 or "主要问题" in t2))
                    ):
                        break
                    j += 1
                remove.update(range(i, j))
                i = j
                continue
        i += 1
    for idx in sorted(remove, reverse=True):
        body.remove(elems[idx])


def extract_schedule_part(text, target):
    compact = re.sub(r"\s+", "", text)
    marker = f"{target}（"
    pos = compact.find(marker)
    if pos < 0:
        return text if target in text else ""
    next_pos = len(compact)
    for town in TOWNS:
        if town == target:
            continue
        p = compact.find(f"{town}（", pos + 1)
        if p != -1:
            next_pos = min(next_pos, p)
    return compact[pos:next_pos].rstrip("、，；;")


def filter_tables(doc, target):
    for table in doc.tables:
        if not table.rows:
            continue
        town_col = None
        header_rows = 0
        for ri, row in enumerate(table.rows[:3]):
            vals = [clean_text(c.text) for c in row.cells]
            if "镇街" in vals:
                town_col = vals.index("镇街")
                header_rows = ri + 1
                break
        if town_col is not None:
            for idx in range(len(table.rows) - 1, header_rows - 1, -1):
                vals = [clean_text(c.text) for c in table.rows[idx].cells]
                town = vals[town_col] if town_col < len(vals) else ""
                if town and town != target:
                    table._tbl.remove(table.rows[idx]._tr)
            renumber_sequence_column(table, header_rows)
            continue

        all_text = "\n".join(" ".join(c.text for c in row.cells) for row in table.rows)
        if target in all_text and any(t in all_text for t in TOWNS if t != target):
            for idx in range(len(table.rows) - 1, 0, -1):
                row = table.rows[idx]
                row_text = " ".join(c.text for c in row.cells)
                if target not in row_text:
                    table._tbl.remove(row._tr)
                    continue
                for cell in row.cells:
                    if target in cell.text:
                        cell.text = extract_schedule_part(cell.text, target)
                    elif any(t in cell.text for t in TOWNS if t != target):
                        cell.text = ""
            renumber_sequence_column(table, 1)


def renumber_sequence_column(table, header_rows):
    if not table.rows:
        return
    seq_header = False
    for row in table.rows[: max(header_rows, 1)]:
        vals = row_texts_xml(row)
        if vals and vals[0] == "序号":
            seq_header = True
            break
    if not seq_header:
        return
    number = 1
    for row in table.rows[header_rows:]:
        vals = row_texts_xml(row)
        if not vals:
            continue
        first = vals[0]
        if not first or first in {"合计", "共计", "总计"}:
            continue
        if not re.fullmatch(r"\d+", first):
            continue
        first_tc = row._tr.tc_lst[0] if row._tr.tc_lst else None
        if first_tc is not None:
            set_tc_text(first_tc, str(number))
        number += 1


def replace_overview_paragraphs(doc, target, metrics):
    data = metrics.get(target, {})
    count = data.get("sample_count", 0)
    ge90 = data.get("score_ge90", 0)
    mid = data.get("score_80_90", 0)
    low = data.get("score_lt80", 0)
    ec1 = data.get("ec1", "")
    ec2 = data.get("ec2", "")
    pay = data.get("pay", {})
    availability = pay.get("availability", "")
    om = pay.get("om", "")
    availability_deduct = pay.get("availability_deduct", "0")
    om_deduct = pay.get("om_deduct", "0")
    batch8_deduct = pay.get("batch8_deduct", "0")
    total_deduct = pay.get("total_deduct", "0")

    for p in doc.paragraphs:
        text = p.text.strip()
        if text.startswith("各镇村级污水处理设施陆续于2021") and "共抽检220个农村污水处理设施" in text:
            set_para_text(
                p,
                f"各镇村级污水处理设施陆续于2021 ~2023 年正式投入商业运营，并满足考核条件。"
                f"2022年10~12 月，我司按照《PPP项目合同》及相关绩效考核要求开展了本项目第一次村级污水处理设施绩效考核工作。"
                f"2023年11月20日，台山市水利局与江门路航环保科技有限公司签订《PPP项目合同补充协议》。"
                f"我司根据《PPP项目合同补充协议》要求开展绩效考核工作，并给出绩效考核结果与服务费挂钩结论。"
                f"本次为2023年下半年度考核，是本项目村级设施的第三次考核，本报告涉及{target}共抽检{count}个农村污水处理设施，"
                f"考核结果作为该镇已转运营农村污水处理设施下一周期的付费依据。",
            )
        elif text.startswith("根据台山市水利局工作安排及合同相关约定，2023年12月~2024年1月") and "17个镇街220个农村污水处理设施" in text:
            set_para_text(
                p,
                f"根据台山市水利局工作安排及合同相关约定，2023年12月~2024年1月，由台山市水利局、"
                f"广东省建筑设计研究院集团股份有限公司、镇级行政主管单位等各派代表组成考核小组，"
                f"对{target}{count}个农村污水处理设施进行了2023年下半年度现场考核，同步开展问卷调查，"
                f"并让各考核组成员及被考核单位现场签字确认。结合水质检测结果，查阅项目公司和实施机构提供的考核资料，"
                f"对农村污水处理设施运维情况进行考核评分。",
            )
        elif text.startswith("各镇农村污水处理设施绩效考核中，220个农村污水处理设施中"):
            low_part = f"，{low}个设施评分低于80分" if low else ""
            set_para_text(
                p,
                f"{target}农村污水处理设施绩效考核中，{count}个农村污水处理设施中有{ge90}个设施考核评分在90分及以上，"
                f"{mid}个设施评分在80~90分之间{low_part}。全镇运维期绩效考核运维服务付费系数Ec1为{ec1}，"
                f"运维期绩效考核可用性服务付费系数Ec2为{ec2}。",
            )
        elif text.startswith("根据台山市水利局工作安排及合同相关约定，本次集中对台山市第二轮农村生活污水处理设施建设PPP项目") and "17个镇街220个农村污水处理设施" in text:
            set_para_text(
                p,
                f"根据台山市水利局工作安排及合同相关约定，本次集中对台山市第二轮农村生活污水处理设施建设PPP项目中"
                f"{target}农村生活污水处理设施开展2023年下半年度绩效考核，考核对象包括{target}{count}个抽检农村污水处理设施。",
            )
        elif text.startswith("2023年12月~2024年1月，考核小组对台山市17个镇共220个农村污水处理设施进行了考核"):
            low_part = f"，{low}个设施评分低于80分" if low else ""
            set_para_text(
                p,
                f"2023年12月~2024年1月，考核小组对{target}{count}个农村污水处理设施进行了考核，"
                f"其中有{ge90}个设施的现场运维绩效考核评分在90分及以上，{mid}个设施评分在80~90分之间{low_part}。",
            )
        elif text.startswith("根据《PPP项目合同》、《PPP项目合同补充协议》和项目完工转运营情况") and "共1256个" in text:
            set_para_text(
                p,
                f"根据《PPP项目合同》、《PPP项目合同补充协议》和项目完工转运营情况，2023年下半年度付费范围包括"
                f"第二轮农村生活污水处理设施建设PPP项目中{target}已转入运营的农村污水处理设施，"
                f"详细情况见《PPP项目合同补充协议》附件二表3。",
            )
        elif availability and text.startswith("根据台山市第二轮农村污水处理设施建设PPP项目农村污水处理设施2023年下半年度绩效考核结果") and "可用性付费每月付费建议" in text:
            set_para_text(
                p,
                f"根据台山市第二轮农村污水处理设施建设PPP项目农村污水处理设施2023年下半年度绩效考核结果，"
                f"2024年1~6月{target}转运营农村污水处理设施可用性付费每月付费建议为{availability}元（详见表3-4）。",
            )
        elif om and text.startswith("1.转运营的第一~七批子项目运营2024年1月~6月每月的农村污水处理设施运维服务费每月付费建议为"):
            set_para_text(
                p,
                f"1.转运营的第一~七批子项目运营2024年1月~6月每月的农村污水处理设施运维服务费每月付费建议为{om}元（详见表3-5）。",
            )
        elif text.startswith("2.第八批子项目转运营未满6个月"):
            set_para_text(p, f"2.{target}第八批子项目运维服务费按表3-6列示情况计算。")
        elif text.startswith("3.第九批子项目转运营未满6个月"):
            set_para_text(p, f"3.{target}第九批子项目运维服务费按表3-6列示情况计算。")
        elif total_deduct and text.startswith("根据第3.6、3.7章节的付费情况，相比于合同约定的可用性付费") and "合计扣减费用" in text:
            set_para_text(
                p,
                f"根据第3.6、3.7章节的付费情况，相比于合同约定的可用性付费和第一~七批农村运维服务费基数，"
                f"{target}农村污水处理设施每月扣减可用性付费为{availability_deduct}元，"
                f"第一~七批农村运维服务费每月扣减费用为{om_deduct}元，第八批农村运维服务费每月扣减费用为{batch8_deduct}元，"
                f"合计扣减费用为{total_deduct}元/月，详细见下表。",
            )


def scrub_cross_town_examples(doc, target):
    other_towns = [town for town in TOWNS if town != target]
    replacements = [
        ("六是社会服务评价方面有待提升", f"六是社会服务评价方面有待提升。{target}农村污水设施点中，镇级主管部门及公众评价存在少量扣分，后续仍需结合村民反馈意见持续提升服务质量。"),
        ("注：因在计算过程中小数点四舍五入影响", "注：因在计算过程中小数点四舍五入影响，各镇农村污水处理服务费中可用性付费之和与总可用性付费存在差异，总可用性付费保持不变。"),
        ("n1—某镇第n批一体化设施总数", "n1—某镇第n批一体化设施总数，单位为个。"),
        ("村内仅采取末端截污方式收集污水", f"1.村内污水收集效果仍需提升。{target}部分设施服务范围内仍存在末端截污、明渠收集、局部污水未完全收集等情况，影响村内水体环境和污水处理设施运行效能。"),
        ("截污口设置不合理", f"2.截污口及检查井设置维护仍需加强。{target}部分设施存在截污口设置、管网衔接或检查井维护不到位等问题，需结合现场情况持续整改。"),
        ("检查井或集水井存在溢流直排", f"3.检查井或集水井运行维护仍需加强。{target}部分设施需进一步排查高水位、溢流及排水不畅等情况，保障污水有效收集处理。"),
        ("部分设施进水CODCr或NH3-N浓度较高", f"2.部分设施进水水质指标波动较大。{target}抽检设施中存在进水CODCr或NH3-N浓度偏高情形，需持续排查进水来源并强化运行调控。"),
        ("管网运维有待进一步提升", f"1.管网运维有待进一步提升。{target}部分管网存在水位偏高、排水不畅、井内杂物清理不及时等问题，需进一步加强巡查维护。"),
        ("检查井或管网建设不规范", f"2.检查井或管网建设维护需进一步规范。{target}部分设施需结合现场排水路径、井体设置和管网运行情况开展针对性整改。"),
        ("设施运维有待进一步提升", f"1.设施运维有待进一步提升。{target}部分预处理设施、提升泵、曝气设备及控制系统需加强巡查维护，确保设施稳定运行。"),
        ("采用VFS简易设施运行不稳定", f"2.采用VFS等简易设施的站点需加强运行维护。{target}相关设施应结合供电、曝气、抽水及周边遮挡等情况及时维护，提升运行稳定性。"),
        ("部分设施点存在安全隐患", f"部分设施点安全管理仍需持续加强。{target}应继续排查防护栏、警示标识、信息公示牌及周边环境等安全管理事项，及时消除隐患。"),
        ("台城街道的农村设施村民满意度有待进一步提升", f"{target}农村设施村民满意度仍有提升空间。下半年度无政府部门处罚、社会有效投诉或公众媒体有效负面报道，但仍需结合镇级主管部门及村民反馈意见，持续提升污水收集效果、运行维护质量和群众满意度。"),
    ]
    for p in doc.paragraphs:
        text = p.text.strip()
        if not any(town in text for town in other_towns):
            continue
        for prefix, new_text in replacements:
            if text.startswith(prefix) or prefix in text:
                set_para_text(p, new_text)
                break


def generate_town_report(target, metrics):
    out = os.path.join(FINAL_DIR, f"{target}2023年下半年度村级设施考核报告（正文）.docx")
    doc = Document(SOURCE)
    update_toc(doc, target)
    replace_overview_paragraphs(doc, target, metrics)
    scrub_cross_town_examples(doc, target)
    filter_tables(doc, target)
    remove_unrelated_town_sections(doc, target)
    apply_font_rules(doc)
    doc.save(out)
    return out


def delete_old_baisha_chixi_outputs():
    for name in [
        "白沙镇第二章高仿原文正式版.docx",
        "赤溪镇第二章高仿原文正式版.docx",
    ]:
        path = os.path.join(OUTPUTS, name)
        if os.path.exists(path):
            os.remove(path)


def copy_existing_or_generate(town, metrics):
    return generate_town_report(town, metrics)


def structural_check(paths):
    rows = []
    for path in paths:
        doc = Document(path)
        text = "\n".join(p.text for p in doc.paragraphs)
        town = os.path.basename(path).split("2023年")[0]
        if town == "台山市":
            ok = all(t in text for t in TOWNS)
        else:
            unrelated = [t for t in TOWNS if t != town and f"{t}农村污水处理设施考核情况" in text]
            ok = (f"{town}农村污水处理设施考核情况" in text) and not unrelated
        rows.append((os.path.basename(path), ok, len(doc.tables)))
    return rows


def main():
    os.makedirs(FINAL_DIR, exist_ok=True)
    delete_old_baisha_chixi_outputs()
    metrics = collect_metrics()

    generated = []
    for town in TOWNS:
        generated.append(copy_existing_or_generate(town, metrics))

    total = os.path.join(FINAL_DIR, "台山市2023年下半年度村级设施考核报告（正文）.docx")
    shutil.copy2(SOURCE, total)
    total_doc = Document(total)
    apply_font_rules(total_doc)
    total_doc.save(total)
    generated.append(total)

    checks = structural_check(generated)
    print(f"final_dir={FINAL_DIR}")
    print(f"generated_count={len(generated)}")
    for name, ok, table_count in checks:
        print(f"{name}\tOK={ok}\ttables={table_count}")


if __name__ == "__main__":
    main()
