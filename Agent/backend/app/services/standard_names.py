from __future__ import annotations

import re


_VERSION_PARENTHETICAL = re.compile(
    r"[（(][^（）()]*(?:批次|周期|报告版|资料版|第[^（）()]*(?:版|期))[^（）()]*[）)]"
)
_VERSION_SUFFIX = re.compile(
    r"第[一二三四五六七八九十百零〇、,，\d]+(?:批次|周期|期)(?:报告)?版?|资料报告版|周期报告版|报告版"
)


def clean_standard_name(name: str | None) -> str | None:
    if name is None:
        return None
    cleaned = _VERSION_PARENTHETICAL.sub("", name)
    cleaned = _VERSION_SUFFIX.sub("", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()
