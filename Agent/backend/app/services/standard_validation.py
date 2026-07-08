from __future__ import annotations


def validate_standard_payload(items: list[dict]) -> list[str]:
    children: dict[str, list[dict]] = {}
    errors: list[str] = []
    for item in items:
        parent_id = item.get("parentId")
        if parent_id:
            children.setdefault(str(parent_id), []).append(item)

    def score_of(item: dict) -> float:
        try:
            return max(float(item.get("fullScore") or 0), 0.0)
        except (TypeError, ValueError):
            errors.append(f"{item.get('name') or '未命名指标'}的满分不是有效数字")
            return 0.0

    for item in items:
        name = str(item.get("name") or "").strip()
        label = name or "未命名指标"
        if not name:
            errors.append("存在未命名指标")
        level = int(item.get("level") or 0)
        score = score_of(item)
        if level == 3:
            options = item.get("options") or []
            if not options:
                errors.append(f"{label}缺少扣分选项")
            for option in options:
                option_name = str(option.get("name") or "").strip()
                if not option_name:
                    errors.append(f"{label}存在未命名扣分选项")
                try:
                    deduction = max(float(option.get("deductionValue") or 0), 0.0)
                except (TypeError, ValueError):
                    errors.append(f"{label}的扣分值不是有效数字")
                    continue
                if deduction > score + 1e-9:
                    errors.append(f"{label}的扣分值不能超过单项满分")

    for item in items:
        child_items = children.get(str(item.get("id"))) or []
        if not child_items:
            continue
        own_score = score_of(item)
        child_total = sum(score_of(child) for child in child_items)
        if abs(own_score - child_total) > 0.01:
            errors.append(f"{item.get('name') or '未命名指标'}满分应等于下级合计{child_total:.2f}")

    facility_totals: dict[str, float] = {}
    for item in items:
        if int(item.get("level") or 0) == 3:
            facility_type = str(item.get("facilityType") or "未分类")
            facility_totals[facility_type] = facility_totals.get(facility_type, 0.0) + score_of(item)
    for facility_type, total in facility_totals.items():
        if abs(total - 100.0) > 0.01:
            errors.append(f"{facility_type}评分项满分合计为{total:.2f}，应为100")

    return errors
