from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

SKIP_DIRS = {
    ".git",
    ".vite",
    "__pycache__",
    "dist",
    "node_modules",
    "storage",
}

FORBIDDEN = [
    "\u53f0\u5c71",
    "\u53f0\u5c71\u5e02",
    "\u5317\u9661\u9547",
    "\u767d\u6c99\u9547",
    "\u5927\u6c5f\u9547",
    "\u8d64\u6eaa\u9547",
    "\u5e7f\u6d77\u9547",
    "\u6c99\u5806\u9547",
    "\u53e4\u4e95\u9547",
    "\u6f6e\u8fde\u9547",
    "\u65b0\u4f1a\u533a",
    "\u53cc\u6c34\u9547",
    "\u5d16\u95e8\u9547",
    "\u53f8\u524d\u9547",
    "\u5927\u6cfd\u9547",
    "\u4e09\u6c5f\u9547",
    "\u7f57\u5751\u9547",
    "\u7530\u5934\u9547",
    "\u7766\u6d32\u9547",
    "common_" "amount_" "basis",
    "httpx2",
    "Node.js is required",
    "Python 3.12 was not found",
    "Backend did not become ready",
    "Service startup timed out",
    "Missing required command",
    "Failed to prepare frontend runtime copy",
]


def iter_text_files(root: Path):
    for path in root.rglob("*"):
        if path.name == Path(__file__).name:
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if not path.is_file():
            continue
        if path.suffix.lower() in {".pyc", ".png", ".jpg", ".jpeg", ".webp", ".ico", ".doc", ".docx", ".docm", ".xlsx", ".zip"}:
            continue
        yield path


def main() -> None:
    failures: list[str] = []
    for path in iter_text_files(ROOT):
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for token in FORBIDDEN:
            if token in text:
                failures.append(f"{path.relative_to(ROOT)}: 发现旧项目或旧金额口径残留：{token}")
    if failures:
        raise SystemExit("\n".join(failures))
    print("PASS: 未发现已废弃旧项目或旧金额口径残留")


if __name__ == "__main__":
    main()
