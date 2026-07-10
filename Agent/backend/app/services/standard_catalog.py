from __future__ import annotations

import json
import math
import re
from copy import deepcopy
from pathlib import Path
from typing import Any


def _standards_json_path() -> Path:
    return Path(__file__).resolve().parents[1] / "data" / "project_standards.json"


def _is_knowledge_only_option(option: dict[str, Any]) -> bool:
    reason = str(option.get("reason") or "")
    return any(
        marker in reason
        for marker in (
            "检查单元",
            "抽查5个井段",
            "最多扣",
            "合并入管道检查评分项目",
        )
    )


def _infer_count_unit(reason: str) -> str | None:
    patterns = (
        (r"每(?:增加)?\s*1?\s*天", "天"),
        (r"每(?:一|发现1|发现一)?\s*处", "处"),
        (r"每(?:缺少)?\s*1?\s*项/次", "项/次"),
        (r"每(?:缺少|发现|出现|有)?\s*(?:1|一)?\s*项", "项"),
        (r"每(?:缺少)?\s*(?:1|一)?\s*类", "类"),
        (r"每(?:出现)?\s*(?:1|一)?\s*次", "次"),
        (r"每(?:缺少)?\s*1?\s*人", "人"),
        (r"每(?:一个|一)?\s*岗位", "岗位"),
        (r"每(?:有)?\s*(?:一|1)?\s*座", "座"),
        (r"每(?:发现)?\s*(?:一|1)?\s*个", "个"),
        (r"每个问题", "个"),
    )
    return next((unit for pattern, unit in patterns if re.search(pattern, reason)), None)


def _clean_option(item: dict[str, Any], option: dict[str, Any]) -> dict[str, Any]:
    cleaned = deepcopy(option)
    cleaned["reason"] = re.sub(r"^\s*\d+\.\s*", "", str(cleaned.get("reason") or ""))
    unit = cleaned.get("unit") or _infer_count_unit(cleaned["reason"])
    value = float(cleaned.get("value") or 0)
    if unit and cleaned.get("type", "fixed") == "fixed" and value > 0:
        cleaned["unit"] = unit
        cleaned["maxInstances"] = max(1, math.ceil(float(item.get("maxScore") or value) / value))
    return cleaned


def _normalize_repeated_text(value: str | None) -> tuple[str, int]:
    lines: list[str] = []
    for raw_line in str(value or "").splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip()
        if not line:
            continue
        ending = "。" if line.endswith("。") else ""
        parts = [part.strip(" 。") for part in re.split(r"[；;]", line) if part.strip(" 。")]
        line = "；".join(dict.fromkeys(parts)) + ending
        lines.append(line)
    if not lines:
        return "", 1
    for block_size in range(1, len(lines) // 2 + 1):
        if len(lines) % block_size:
            continue
        block = lines[:block_size]
        repeat_factor = len(lines) // block_size
        if repeat_factor > 1 and lines == block * repeat_factor:
            return "\n".join(block), repeat_factor
    unique_lines = list(dict.fromkeys(lines))
    return "\n".join(unique_lines), 1


def _option_signature(option: dict[str, Any]) -> tuple[Any, ...]:
    reason = re.sub(r"^\s*\d+\.\s*", "", str(option.get("reason") or "")).strip()
    return (
        re.sub(r"\s+", "", reason),
        option.get("type") or "fixed",
        float(option.get("value") or 0),
        float(option.get("min") or 0),
        float(option.get("max") or 0),
        option.get("unit"),
    )


def _remove_repeated_option_block(options: list[dict[str, Any]], repeat_factor: int) -> list[dict[str, Any]]:
    if repeat_factor <= 1 or len(options) % repeat_factor:
        return options
    block_size = len(options) // repeat_factor
    block = options[:block_size]
    signatures = [_option_signature(option) for option in options]
    if signatures == [_option_signature(option) for option in block] * repeat_factor:
        return block
    return options


_DEDUCTION_RE = re.compile(r"扣\s*(\d+(?:\.\d+)?)\s*分")


def _deduction_clauses(text: str) -> list[tuple[str, float]]:
    clauses: list[tuple[str, float]] = []
    previous_end = 0
    for match in _DEDUCTION_RE.finditer(text):
        raw_clause = text[previous_end:match.end()]
        previous_end = match.end()
        if "\n" in raw_clause:
            raw_clause = next((line for line in reversed(raw_clause.splitlines()) if line.strip()), raw_clause)
        clause = raw_clause.lstrip("；;。,.，\n\r \t")
        clause = re.sub(r"^(?:（\d+）|\(\d+\)|\d+[.、])\s*", "", clause)
        clause = re.sub(r"\s+", "", clause).strip("；;。,.，")
        if not clause or re.match(r"^(?:最多|最高)扣", clause):
            continue
        clauses.append((clause, float(match.group(1))))
    return clauses


def _apply_clause_reasons(item: dict[str, Any], options: list[dict[str, Any]]) -> list[dict[str, Any]]:
    clauses = _deduction_clauses(str(item.get("evaluationStandard") or item.get("standardText") or ""))
    if not clauses:
        return options
    enhanced = [deepcopy(option) for option in options]
    if len(clauses) == len(enhanced):
        for option, (clause, _value) in zip(enhanced, clauses):
            if (option.get("type") or "fixed") == "fixed":
                option["reason"] = clause
        return enhanced

    used: set[int] = set()
    matched_options: list[dict[str, Any]] = []
    for option in enhanced:
        if (option.get("type") or "fixed") != "fixed":
            matched_options.append(option)
            continue
        value = float(option.get("value") or 0)
        match_index = next(
            (index for index, (_clause, clause_value) in enumerate(clauses) if index not in used and abs(clause_value - value) < 1e-9),
            None,
        )
        if match_index is None:
            if any(abs(clause_value - value) < 1e-9 for _clause, clause_value in clauses):
                continue
            matched_options.append(option)
            continue
        used.add(match_index)
        option["reason"] = clauses[match_index][0]
        matched_options.append(option)
    return matched_options


def _deduplicate_options(options: list[dict[str, Any]]) -> list[dict[str, Any]]:
    unique: list[dict[str, Any]] = []
    seen: set[tuple[Any, ...]] = set()
    for option in options:
        signature = _option_signature(option)
        if signature in seen:
            continue
        seen.add(signature)
        unique.append(option)
    return unique


def load_standard_groups(project_key: str = "yunan") -> dict[str, list[dict[str, Any]]]:
    standards = json.loads(_standards_json_path().read_text(encoding="utf-8"))
    groups = deepcopy(standards.get(project_key) or standards["yunan"])
    for facility_groups in groups.values():
        for level1 in facility_groups:
            for level2 in level1.get("children", []):
                for item in level2.get("items", []):
                    evaluation_standard, evaluation_repeat = _normalize_repeated_text(item.get("evaluationStandard"))
                    standard_text, standard_repeat = _normalize_repeated_text(item.get("standardText"))
                    if standard_text and (
                        (_DEDUCTION_RE.search(standard_text) and not _DEDUCTION_RE.search(evaluation_standard))
                        or ("得分=" in standard_text and "得分=" not in evaluation_standard)
                    ):
                        evaluation_standard = standard_text
                    item["evaluationStandard"] = evaluation_standard
                    item["standardText"] = standard_text or evaluation_standard
                    options = [option for option in item.get("options", []) if not _is_knowledge_only_option(option)]
                    options = _remove_repeated_option_block(options, max(evaluation_repeat, standard_repeat))
                    options = _apply_clause_reasons(item, options)
                    item["options"] = _deduplicate_options([_clean_option(item, option) for option in options])
    return groups


def item_score_total(groups: list[dict[str, Any]]) -> float:
    return sum(
        float(item.get("maxScore") or 0)
        for level1 in groups
        for level2 in level1.get("children", [])
        for item in level2.get("items", [])
    )
