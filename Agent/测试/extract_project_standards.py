from __future__ import annotations

import json
import re
from collections import OrderedDict
from pathlib import Path
from typing import Any

from docx import Document
from docx.oxml.ns import qn


ROOT = Path(__file__).resolve().parent / "标准提取"
OUT = Path(__file__).resolve().parents[1] / "backend" / "app" / "data" / "project_standards.json"

SPACE_RE = re.compile(r"\s+")
SCORE_CELL_RE = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*(?:分)?\s*$")
DEDUCT_RE = re.compile(r"扣\s*(\d+(?:\.\d+)?)\s*(?:至|-|~|～)?\s*(\d+(?:\.\d+)?)?\s*分")
CATEGORY_RE = re.compile(r"(.+?)[（(]\s*(\d+(?:\.\d+)?)\s*分\s*[)）]")
LEAD_PATTERNS = [
    re.compile(r"^\s*\(\d+\)\s*"),
    re.compile(r"^\s*（\d+）\s*"),
    re.compile(r"^\s*\d+[.、]\s*"),
    re.compile(r"^\s*[①②③④⑤⑥⑦⑧⑨]\s*"),
]


def clean(text: str) -> str:
    text = (text or "").replace("\u3000", " ").replace("\xa0", " ")
    lines = [SPACE_RE.sub(" ", line).strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line).strip()


def strip_lead(text: str) -> str:
    for pattern in LEAD_PATTERNS:
        text = pattern.sub("", text)
    return text.strip()


def tc_text(tc: Any) -> str:
    return clean("".join(node.text or "" for node in tc.iter(qn("w:t"))))


def vmerge(tc: Any) -> str:
    items = tc.xpath("./w:tcPr/w:vMerge")
    if not items:
        return ""
    return items[0].get(qn("w:val")) or "continue"


def grid_span(tc: Any) -> int:
    items = tc.xpath("./w:tcPr/w:gridSpan")
    return int(items[0].get(qn("w:val"))) if items else 1


def parse_score_cell(text: str) -> float:
    match = SCORE_CELL_RE.match(clean(text))
    return float(match.group(1)) if match else 0.0


def category_name(text: str) -> str:
    text = clean(text).split("\n")[0]
    match = CATEGORY_RE.search(text)
    return match.group(1).strip() if match else text


def category_score(text: str) -> float | None:
    match = CATEGORY_RE.search(clean(text).split("\n")[0])
    return float(match.group(2)) if match else None


def expand_table_rows(table: Any) -> list[list[dict[str, Any]]]:
    active: dict[int, str] = {}
    rows: list[list[dict[str, Any]]] = []
    for tr in table._tbl.tr_lst:
        row: list[dict[str, Any]] = []
        col = 0
        for tc in tr.tc_lst:
            span = grid_span(tc)
            merge = vmerge(tc)
            text = tc_text(tc)
            if merge == "continue":
                text = active.get(col, text)
            else:
                for offset in range(span):
                    active[col + offset] = text
            for _ in range(span):
                row.append({"text": text, "vmerge": merge, "continued": merge == "continue"})
                col += 1
        rows.append(row)
    return rows


def split_clauses(text: str) -> list[str]:
    text = clean(text)
    parts: list[str] = []
    for line in text.split("\n"):
        for piece in re.split(r"[；;。]", line):
            piece = strip_lead(piece).strip(" 、，,")
            if not piece or piece in parts:
                continue
            if "不扣分" in piece and "扣" not in piece.replace("不扣分", ""):
                continue
            comma = [strip_lead(item).strip(" 、，,") for item in re.split(r"[、，,]", piece)]
            comma_deduct = [item for item in comma if DEDUCT_RE.search(item) and "不扣分" not in item]
            if len(comma_deduct) > 1:
                for item in comma_deduct:
                    if item not in parts:
                        parts.append(item)
            else:
                parts.append(piece)
    return parts


def quantity_meta(clause: str, score: float, deduction: float) -> dict[str, Any]:
    patterns = [
        (r"每\s*增加\s*1\s*天|每\s*天", "天"),
        (r"每\s*缺少\s*(?:1|一)\s*项|每\s*缺\s*(?:1|一)\s*项|每\s*(?:1|一)\s*项|每\s*项", "项"),
        (r"每\s*个\s*问题|每\s*个", "个"),
        (r"每\s*发现\s*(?:1|一)\s*处|发现\s*(?:1|一)\s*处|每\s*处|一处", "处"),
        (r"每\s*有\s*(?:1|一)\s*座|每\s*座", "座"),
        (r"每\s*出现\s*(?:1|一)\s*次|每\s*一次|每\s*次", "次"),
        (r"每\s*笔", "笔"),
        (r"每\s*缺少\s*(?:1|一)\s*人|每\s*缺少\s*1\s*人|每\s*人", "人"),
    ]
    for pattern, unit in patterns:
        if re.search(pattern, clause):
            return {"unit": unit, "maxInstances": max(int(score // deduction), 1)}
    return {}


def option_from_clause(index: int, clause: str, score: float) -> dict[str, Any]:
    clause = strip_lead(clause).strip(" ；;。、，,")
    reason = f"{index}. {clause}"
    match = DEDUCT_RE.search(clause)
    if not match:
        if "得分=" in clause or "公式" in clause or "核算" in clause or "综合打分" in clause:
            return {"reason": reason, "type": "range", "min": 0, "max": score}
        return {"reason": reason, "type": "fixed", "value": min(score, 1.0)}
    low = float(match.group(1))
    high = float(match.group(2) or match.group(1))
    high = min(high, score)
    low = min(low, high)
    if match.group(2):
        return {"reason": reason, "type": "range", "min": low, "max": high}
    option: dict[str, Any] = {"reason": reason, "type": "fixed", "value": high}
    option.update(quantity_meta(clause, score, high))
    return option


def options_for(rules: list[str], score: float) -> list[dict[str, Any]]:
    clauses: list[str] = []
    for rule in rules:
        for clause in split_clauses(rule):
            if clause and clause not in clauses:
                clauses.append(clause)
    if not clauses:
        clauses = ["按评价标准据实扣分"]
    return [option_from_clause(index, clause, score) for index, clause in enumerate(clauses, 1)]


def short_requirement(text: str) -> str:
    text = clean(text).split("\n")[0]
    text = re.sub(r"[。；;，,].*$", "", text)
    return text[:24]


def extract_table(docx: str, table_index: int, prefix: str, *, has_method: bool = True) -> list[dict[str, Any]]:
    doc = Document(ROOT / docx)
    rows = expand_table_rows(doc.tables[table_index])
    groups: OrderedDict[str, dict[str, Any]] = OrderedDict()
    current_item: dict[str, Any] | None = None
    item_index = 0

    for row in rows[1:]:
        values = [cell["text"] for cell in row]
        if len(values) < 6:
            continue
        raw_category = values[0]
        category = category_name(raw_category)
        check = clean(values[1])
        if not category or not check:
            continue
        group = groups.setdefault(category, {"name": category, "target": category_score(raw_category), "items": []})
        if group["target"] is None:
            parsed_target = category_score(raw_category)
            if parsed_target is not None:
                group["target"] = parsed_target

        score_col = len(values) - 1
        score = parse_score_cell(values[score_col])
        score_continued = row[score_col]["continued"]
        if len(values) >= 7:
            method = values[2]
            requirement = values[3]
            rules = [values[4], values[5]]
        else:
            method = values[2] if has_method else ""
            requirement = values[3] if has_method else values[2]
            rules = [values[4] if has_method else values[3]]

        if score_continued and current_item is not None:
            for value, bucket in [(method, "methods"), (requirement, "requirements")]:
                if value and value not in current_item[bucket]:
                    current_item[bucket].append(value)
            for rule in rules:
                if rule and rule not in current_item["rules"]:
                    current_item["rules"].append(rule)
            continue
        if score <= 0:
            continue

        item_index += 1
        current_item = {
            "id": f"{prefix}_{item_index:03d}",
            "category": category,
            "check": check,
            "score": score,
            "methods": [method] if method else [],
            "requirements": [requirement] if requirement else [],
            "rules": [rule for rule in rules if rule],
        }
        group["items"].append(current_item)

    for group in groups.values():
        target = group.get("target")
        items = group["items"]
        if target and items:
            total = round(sum(float(item["score"]) for item in items), 6)
            diff = round(float(target) - total, 6)
            if abs(diff) > 0.000001:
                items[0]["score"] = max(float(items[0]["score"]) + diff, 0)

    result: list[dict[str, Any]] = []
    for group_index, group in enumerate(groups.values(), 1):
        seen_names: dict[str, int] = {}
        level3_items: list[dict[str, Any]] = []
        for item in group["items"]:
            base_name = item["check"]
            seen_names[base_name] = seen_names.get(base_name, 0) + 1
            name = base_name
            if seen_names[base_name] > 1:
                requirement = short_requirement("\n".join(item["requirements"]))
                name = f"{base_name}（{requirement}）" if requirement else f"{base_name}-{seen_names[base_name]}"
            rules = item["rules"] or item["requirements"]
            score = float(item["score"])
            level3_items.append(
                {
                    "id": item["id"],
                    "name": name,
                    "maxScore": score,
                    "evaluationStandard": "\n".join(rules),
                    "standardText": "\n".join(rules),
                    "scoringMethod": "\n".join(item["methods"]) or "按报告评分标准据实扣分",
                    "dataSource": "\n".join(item["requirements"]),
                    "options": options_for(rules, score),
                }
            )
        result.append(
            {
                "id": f"{prefix}_g{group_index:02d}",
                "name": group["name"],
                "children": [{"id": f"{prefix}_g{group_index:02d}_l2", "name": group["name"], "items": level3_items}],
            }
        )
    return result


def main() -> None:
    data = {
        "yunan": {
            "town_plant": extract_table("yunan_source.docx", 61, "yn_plant"),
            "town_network": extract_table("yunan_source.docx", 62, "yn_network"),
            "rural_treatment": extract_table("yunan_source.docx", 63, "yn_rural", has_method=False),
        },
        "maonan": {
            "town_plant": extract_table("maonan_source.docx", 46, "mn_plant"),
            "town_network": extract_table("maonan_source.docx", 47, "mn_network"),
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    for project, standards in data.items():
        print(project)
        for facility_type, groups in standards.items():
            items = [item for group in groups for child in group["children"] for item in child["items"]]
            total = sum(float(item["maxScore"]) for item in items)
            option_count = sum(len(item["options"]) for item in items)
            unit_count = sum(1 for item in items for option in item["options"] if option.get("unit"))
            print(f"  {facility_type}: score={total:g}, items={len(items)}, options={option_count}, unitOptions={unit_count}")


if __name__ == "__main__":
    main()
