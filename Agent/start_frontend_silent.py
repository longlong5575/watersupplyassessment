from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


AGENT_ROOT = Path(__file__).resolve().parent
LOG_DIR = AGENT_ROOT / "logs"
PNPM_CANDIDATES = [
    Path(os.environ.get("USERPROFILE", "")) / ".cache" / "codex-runtimes" / "codex-primary-runtime" / "dependencies" / "bin" / "pnpm.cmd",
]


def find_pnpm() -> str:
    for candidate in PNPM_CANDIDATES:
        if candidate.exists():
            return str(candidate)
    return "pnpm.cmd"


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: start_frontend_silent.py <directory> <name>")

    directory = Path(sys.argv[1]).resolve()
    name = sys.argv[2]
    LOG_DIR.mkdir(exist_ok=True)

    env = os.environ.copy()
    env["BROWSER"] = "none"
    creationflags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS | subprocess.CREATE_NO_WINDOW

    with (LOG_DIR / f"{name}.out.log").open("ab") as stdout, (LOG_DIR / f"{name}.err.log").open("ab") as stderr:
        process = subprocess.Popen(
            [find_pnpm(), "run", "dev:local"],
            cwd=str(directory),
            stdin=subprocess.DEVNULL,
            stdout=stdout,
            stderr=stderr,
            creationflags=creationflags,
            env=env,
        )

    (LOG_DIR / f"{name}.pid").write_text(str(process.pid), encoding="utf-8")


if __name__ == "__main__":
    main()
