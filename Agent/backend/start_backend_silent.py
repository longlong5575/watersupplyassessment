from __future__ import annotations

import os
import subprocess
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent
PYTHON = BACKEND_DIR / ".venv" / "Scripts" / "python.exe"
PID_FILE = BACKEND_DIR / "server.pid"
OUT_LOG = BACKEND_DIR / "server.out.log"
ERR_LOG = BACKEND_DIR / "server.err.log"


def main() -> None:
    creationflags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS | subprocess.CREATE_NO_WINDOW
    with OUT_LOG.open("ab") as stdout, ERR_LOG.open("ab") as stderr:
        process = subprocess.Popen(
            [
                str(PYTHON),
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                "8000",
            ],
            cwd=str(BACKEND_DIR),
            stdin=subprocess.DEVNULL,
            stdout=stdout,
            stderr=stderr,
            creationflags=creationflags,
            env=os.environ.copy(),
        )
    PID_FILE.write_text(str(process.pid), encoding="utf-8")


if __name__ == "__main__":
    main()
