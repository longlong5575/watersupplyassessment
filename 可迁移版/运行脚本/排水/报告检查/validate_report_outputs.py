import argparse
import os
import re
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn


TOWNS = [
    "北陡镇", "汶村镇", "白沙镇", "三合镇", "深井镇", "四九镇", "大江镇", "都斛镇",
    "赤溪镇", "冲蒌镇", "端芬镇", "川岛镇", "广海镇", "海宴镇", "台城街道", "水步镇", "斗山镇",
]
FORBIDDEN_LABELS = ["套话", "框架", "合并版", "技能", "高仿", "专项", "保留版", "生成版"]
PLACEHOLDER_TEXTS = [
    "本段根据后续提供", "不保留既有镇街数据", "目标镇街材料填写",
    "约73%（159个）", "本次考核的220个农村污水处理设施中",
]


def clean(text):
    return "".join(str(text or "").split())


def element_text(element):
    return "".join(t.text or "" for t in element.iter() if t.tag.endswith("}t"))


def doc_text(doc):
    return "\n".join(element_text(element) for element in doc._body._element)


def row_values(row):
    return [clean(element_text(tc)) for tc in row._tr.tc_lst]


def font_issues(doc):
    issues = []
    for run in doc._element.iter():
        if not run.tag.endswith("}r"):
            continue
        text = element_text(run).strip()
        if not text:
            continue
        rpr = run.find(qn("w:rPr"))
        rfonts = None if rpr is None else rpr.find(qn("w:rFonts"))
        east = None if rfonts is None else rfonts.get(qn("w:eastAsia"))
        if east not in (None, "宋体"):
            issues.append(f"非宋体文字：{text[:20]}")
            if len(issues) >= 10:
                break
    return issues


def sequence_issues(doc):
    issues = []
    for table_index, table in enumerate(doc.tables):
        header_index = None
        for i, row in enumerate(table.rows[:3]):
            vals = row_values(row)
            if vals and vals[0] == "序号":
                header_index = i
                break
        if header_index is None:
            continue
        expected = 1
        for row_index, row in enumerate(table.rows[header_index + 1 :], start=header_index + 1):
            vals = row_values(row)
            if not vals:
                continue
            first = vals[0]
            if first in {"", "合计", "共计", "总计"} or not re.fullmatch(r"\d+", first):
                continue
            if int(first) != expected:
                issues.append(f"表{table_index + 1}第{row_index + 1}行序号为{first}，应为{expected}")
                break
            expected += 1
    return issues


def validate_file(path):
    result = []
    name = path.name
    if any(label in name for label in FORBIDDEN_LABELS):
        result.append("文件名含制作痕迹")
    if not re.match(r"^(台山市|.+镇|台城街道)2023年下半年度村级设施考核报告（正文）\.docx$", name):
        result.append("文件名不符合标准格式")

    doc = Document(str(path))
    text = doc_text(doc)
    target = name.split("2023年")[0]
    if target in TOWNS:
        others = [town for town in TOWNS if town != target and town in text]
        if others:
            result.append("单镇报告含其他镇名：" + "、".join(others))
        if f"{target}农村污水处理设施考核情况" not in text:
            result.append("缺少本镇考核章节")
    elif target == "台山市":
        missing_towns = [town for town in TOWNS if f"{town}农村污水处理设施考核情况" not in text]
        if missing_towns:
            result.append("总报告缺少镇街章节：" + "、".join(missing_towns))

    body_labels = [label for label in FORBIDDEN_LABELS if label in text]
    if body_labels:
        result.append("正文含制作痕迹：" + "、".join(body_labels))
    placeholders = [label for label in PLACEHOLDER_TEXTS if label in text]
    if placeholders:
        result.append("正文含底稿占位文字：" + "、".join(placeholders))

    sample_tables = []
    summary_tables = []
    payment_tables = []
    for table in doc.tables:
        if not table.rows:
            continue
        header = "|".join(row_values(table.rows[0]))
        if "考核评分" in header and "运维服务费系数Ec1" in header:
            sample_tables.append(table)
        if "一级指标" in header and "评价方法" in header and len(table.columns) > 4:
            summary_tables.append(table)
        if "每月合计扣减费用" in header:
            payment_tables.append(table)
    if not sample_tables or len(sample_tables[0].rows) <= 1:
        result.append("考核评分汇总表未填充")
    if not summary_tables:
        result.append("缺少设施绩效评价汇总表")
    if not payment_tables or len(payment_tables[0].rows) <= 1:
        result.append("绩效付费扣减表未填充")

    result.extend(sequence_issues(doc))
    result.extend(font_issues(doc))
    return result


def main():
    parser = argparse.ArgumentParser()
    package_root = Path(__file__).resolve().parents[3]
    project_root = package_root.parent if (package_root.parent / "资料收集").is_dir() else package_root
    parser.add_argument("path", nargs="?", default=str(project_root / "生成"))
    args = parser.parse_args()

    root = Path(args.path)
    files = [root] if root.is_file() else sorted(root.glob("*.docx"))
    bad = []
    if root.is_dir():
        expected = {f"{town}2023年下半年度村级设施考核报告（正文）.docx" for town in TOWNS}
        expected.add("台山市2023年下半年度村级设施考核报告（正文）.docx")
        actual = {file.name for file in files}
        missing = sorted(expected - actual)
        extra = sorted(actual - expected)
        if missing:
            bad.append(("输出目录", ["缺少报告：" + "、".join(missing)]))
        if extra:
            bad.append(("输出目录", ["存在非标准报告：" + "、".join(extra)]))
    for file in files:
        issues = validate_file(file)
        if issues:
            bad.append((file.name, issues))

    print(f"checked={len(files)}")
    print(f"bad={len(bad)}")
    for name, issues in bad:
        print(name)
        for issue in issues:
            print(f"  - {issue}")
    if bad:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
