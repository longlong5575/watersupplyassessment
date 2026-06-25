from collections import Counter
from typing import Any


def summarize_assessment_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Deterministic fallback for the optional external Agent service."""
    entries = payload.get("entries", [])
    reasons = [item.get("reason", "未说明") for item in entries if item.get("deduction") or item.get("deduct")]
    return {
        "summary": f"共接收 {len(entries)} 条评分记录，其中 {len(reasons)} 条存在扣分。",
        "issueKeywords": [item for item, _ in Counter(reasons).most_common(5)],
        "source": "deterministic-fallback",
    }
