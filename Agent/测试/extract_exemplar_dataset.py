from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any
from zipfile import ZipFile
from xml.etree import ElementTree as ET


WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": WORD_NS}


def _text(node: ET.Element) -> str:
    value = "".join(item.text or "" for item in node.findall(".//w:t", NS))
    return re.sub(r"\s+", " ", value).strip()


def _cell_text(cell: ET.Element) -> str:
    paragraphs = [_text(item) for item in cell.findall(".//w:p", NS)]
    return "\n".join(item for item in paragraphs if item).strip()


def extract_docx(path: Path, media_output: Path | None = None) -> dict[str, Any]:
    with ZipFile(path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
        media = [name for name in archive.namelist() if name.startswith("word/media/")]
        if media_output is not None:
            media_output.mkdir(parents=True, exist_ok=True)
            for member in media:
                target = media_output / Path(member).name
                target.write_bytes(archive.read(member))
    body = root.find("w:body", NS)
    if body is None:
        raise RuntimeError(f"未找到 Word 正文：{path}")

    blocks: list[dict[str, Any]] = []
    tables: list[dict[str, Any]] = []
    paragraphs: list[dict[str, Any]] = []
    for child in body:
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "p":
            value = _text(child)
            if not value:
                continue
            style_node = child.find("./w:pPr/w:pStyle", NS)
            style = style_node.get(f"{{{WORD_NS}}}val") if style_node is not None else ""
            item = {"index": len(paragraphs) + 1, "style": style, "text": value}
            paragraphs.append(item)
            blocks.append({"type": "paragraph", **item})
            continue
        if tag != "tbl":
            continue
        rows: list[list[str]] = []
        for row in child.findall("./w:tr", NS):
            rows.append([_cell_text(cell) for cell in row.findall("./w:tc", NS)])
        recent_paragraphs = [
            item["text"]
            for item in blocks[-12:]
            if item.get("type") == "paragraph" and item.get("text")
        ]
        table = {
            "index": len(tables) + 1,
            "rowCount": len(rows),
            "columnCount": max((len(row) for row in rows), default=0),
            "header": rows[0] if rows else [],
            "rows": rows,
            "contextBefore": recent_paragraphs[-8:],
        }
        tables.append(table)
        blocks.append({
            "type": "table",
            "tableIndex": table["index"],
            "rowCount": table["rowCount"],
            "columnCount": table["columnCount"],
            "header": table["header"],
        })

    return {
        "source": str(path),
        "fileSize": path.stat().st_size,
        "paragraphCount": len(paragraphs),
        "tableCount": len(tables),
        "mediaCount": len(media),
        "media": [Path(item).name for item in media],
        "paragraphs": paragraphs,
        "tables": tables,
        "blocks": blocks,
    }


def classify_table(table: dict[str, Any]) -> list[str]:
    text = " ".join(" ".join(row) for row in table.get("rows", [])[:5])
    labels: list[str] = []
    rules = {
        "评分": ("分值", "扣分", "得分", "评价项目", "检查项目"),
        "水质": ("COD", "BOD", "氨氮", "总磷", "水质", "进水", "出水"),
        "金额": ("万元", "服务费", "可用性付费", "运营维护费", "单价"),
        "水量": ("处理水量", "处理量", "立方米", "吨/日", "m³"),
        "项目信息": ("项目名称", "考核对象", "镇街", "项目点", "设施名称"),
        "问题": ("主要问题", "整改", "扣分原因", "存在问题"),
        "附件": ("附件", "资料清单", "现场照片", "检测报告"),
    }
    for label, keywords in rules.items():
        if any(keyword in text for keyword in keywords):
            labels.append(label)
    return labels or ["其他"]


def _deduction_value(value: str) -> float:
    text = str(value or "").strip().replace("−", "-")
    match = re.fullmatch(r"-?\s*(\d+(?:\.\d+)?)", text)
    return float(match.group(1)) if match else 0.0


def table_profile(table: dict[str, Any]) -> dict[str, Any]:
    rows = table.get("rows") or []
    header = table.get("header") or []
    deduction_columns = [
        index
        for index, value in enumerate(header)
        if "扣分" in str(value)
    ]
    deductions: list[dict[str, Any]] = []
    for row_index, row in enumerate(rows[1:], 2):
        for column_index in deduction_columns:
            if column_index >= len(row):
                continue
            deduction = _deduction_value(row[column_index])
            if deduction <= 0:
                continue
            deductions.append({
                "row": row_index,
                "column": column_index + 1,
                "point": str(header[column_index]).replace("扣分情况", "").strip(),
                "category": row[1] if len(row) > 1 else "",
                "item": row[2] if len(row) > 2 else "",
                "deduction": deduction,
                "reason": row[-1] if len(row) > 5 and column_index <= 4 else "",
            })
    return {
        "deductionColumns": deduction_columns,
        "deductionCount": len(deductions),
        "deductionTotal": round(sum(item["deduction"] for item in deductions), 4),
        "deductions": deductions,
    }


def build_summary(data: dict[str, Any]) -> dict[str, Any]:
    categories: dict[str, list[int]] = {}
    for table in data["tables"]:
        for label in classify_table(table):
            categories.setdefault(label, []).append(table["index"])
    heading_candidates = [
        item for item in data["paragraphs"]
        if item["style"] or re.match(r"^(?:第[一二三四五六七八九十]+[章节]|d+(?:\.d+)+|附件|摘\s*要|目\s*录)", item["text"])
    ]
    return {
        "source": data["source"],
        "fileSize": data["fileSize"],
        "paragraphCount": data["paragraphCount"],
        "tableCount": data["tableCount"],
        "mediaCount": data["mediaCount"],
        "categories": categories,
        "headings": heading_candidates,
        "tableIndex": [
            {
                "index": table["index"],
                "rowCount": table["rowCount"],
                "columnCount": table["columnCount"],
                "header": table["header"],
                "categories": classify_table(table),
                "contextBefore": table.get("contextBefore") or [],
                "profile": table_profile(table),
            }
            for table in data["tables"]
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--yunan", type=Path, required=True)
    parser.add_argument("--maonan", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    overview: dict[str, Any] = {}
    for key, path in (("yunan", args.yunan), ("maonan", args.maonan)):
        data = extract_docx(path, args.output_dir / f"{key}-media")
        summary = build_summary(data)
        (args.output_dir / f"{key}-full.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        (args.output_dir / f"{key}-summary.json").write_text(
            json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        overview[key] = {
            "paragraphCount": data["paragraphCount"],
            "tableCount": data["tableCount"],
            "mediaCount": data["mediaCount"],
            "categories": {name: len(indices) for name, indices in summary["categories"].items()},
        }
    (args.output_dir / "overview.json").write_text(
        json.dumps(overview, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(overview, ensure_ascii=False))


if __name__ == "__main__":
    main()
