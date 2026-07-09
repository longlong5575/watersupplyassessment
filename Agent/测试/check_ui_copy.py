from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

CHECKED_FILES = [
    ROOT / "frontend" / "front" / "index.html",
    ROOT / "frontend" / "front" / "src" / "app" / "App.tsx",
    ROOT / "frontend" / "front" / "src" / "app" / "assessmentStandards.ts",
    ROOT / "frontend" / "front-mobile" / "index.html",
    ROOT / "frontend" / "front-mobile" / "src" / "app" / "App.tsx",
    ROOT / "frontend" / "front-mobile" / "src" / "app" / "assessmentStandards.ts",
]

FORBIDDEN_SNIPPETS = [
    "全部城市",
    "城市：",
    "江门市",
    "系统设置",
    "交付前检查",
    "清理运行数据",
    "后台批次",
    "固定批次",
    "正在同步后台批次",
    "批次：",
    "选择考核村点",
    "继续录入下一村点",
    "考核村点",
    "各村点得分",
    "record_review_assist",
    "知识库入口已预留",
    "????",
    "Automates generation",
    "Enables field assessors",
    '<html lang="en"',
    "Web后台原型设计",
    "admin / inspector",
    "inspector / admin",
    "账号不存在，请使用",
    "Agent 辅助",
    "尚未生成 Agent",
    "默认金额计算方法",
    "使用默认金额计算方法",
    "合同单价 × 核定处理水量",
    "季度奖励金",
    "奖励金额",
]

FORBIDDEN_PATTERNS = [
    re.compile(r'placeholder="[^"]*[A-Za-z]{3,}[^"]*"'),
    re.compile(r'setError\("[^"]*[A-Za-z]{3,}'),
]


def main() -> None:
    failures: list[str] = []
    for path in CHECKED_FILES:
        text = path.read_text(encoding="utf-8")
        for snippet in FORBIDDEN_SNIPPETS:
            if snippet in text:
                rel = path.relative_to(ROOT)
                failures.append(f"{rel}: contains forbidden UI text {snippet!r}")
        for pattern in FORBIDDEN_PATTERNS:
            if pattern.search(text):
                rel = path.relative_to(ROOT)
                failures.append(f"{rel}: contains forbidden visible English pattern {pattern.pattern!r}")
    if failures:
        raise SystemExit("\n".join(failures))
    print("PASS: frontend UI copy guard")


if __name__ == "__main__":
    main()
