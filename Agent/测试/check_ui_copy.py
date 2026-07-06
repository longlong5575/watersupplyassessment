from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

CHECKED_FILES = [
    ROOT / "frontend" / "front" / "src" / "app" / "App.tsx",
    ROOT / "frontend" / "front-mobile" / "src" / "app" / "App.tsx",
]

FORBIDDEN_SNIPPETS = [
    "全部城市",
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
]


def main() -> None:
    failures: list[str] = []
    for path in CHECKED_FILES:
        text = path.read_text(encoding="utf-8")
        for snippet in FORBIDDEN_SNIPPETS:
            if snippet in text:
                rel = path.relative_to(ROOT)
                failures.append(f"{rel}: contains forbidden UI text {snippet!r}")
    if failures:
        raise SystemExit("\n".join(failures))
    print("PASS: frontend UI copy guard")


if __name__ == "__main__":
    main()
