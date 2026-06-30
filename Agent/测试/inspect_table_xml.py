from __future__ import annotations

import re
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn


ROOT = Path(__file__).resolve().parent / "标准提取"


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def tc_text(tc) -> str:
    return clean("".join(node.text or "" for node in tc.iter(qn("w:t"))))


def vmerge(tc) -> str:
    items = tc.xpath("./w:tcPr/w:vMerge")
    if not items:
        return ""
    return items[0].get(qn("w:val")) or "continue"


def grid_span(tc) -> int:
    items = tc.xpath("./w:tcPr/w:gridSpan")
    return int(items[0].get(qn("w:val"))) if items else 1


def inspect(docx_name: str, table_index: int, limit: int = 24) -> None:
    doc = Document(ROOT / docx_name)
    table = doc.tables[table_index]
    print(f"\n## {docx_name} table={table_index}")
    for row_index, tr in enumerate(table._tbl.tr_lst[1:limit], 2):
        cells = []
        for tc in tr.tc_lst:
            cells.append(f"{tc_text(tc)[:18]}[vm={vmerge(tc)},gs={grid_span(tc)}]")
        print(row_index, " || ".join(cells))


def main() -> None:
    for docx_name, table_index in [
        ("yunan_source.docx", 61),
        ("yunan_source.docx", 62),
        ("yunan_source.docx", 63),
        ("maonan_source.docx", 46),
        ("maonan_source.docx", 47),
    ]:
        inspect(docx_name, table_index)


if __name__ == "__main__":
    main()
