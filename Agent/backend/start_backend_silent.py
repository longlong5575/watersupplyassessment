from __future__ import annotations

import os
import subprocess
import time
import urllib.request
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent
PYTHON = BACKEND_DIR / ".venv" / "Scripts" / "python.exe"
PYTHONW = BACKEND_DIR / ".venv" / "Scripts" / "pythonw.exe"
PID_FILE = BACKEND_DIR / "server.pid"
OUT_LOG = BACKEND_DIR / "server.out.log"
ERR_LOG = BACKEND_DIR / "server.err.log"


def _clean_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for key, value in os.environ.items():
        normalized = key.upper()
        if normalized == "PATH":
            env["Path"] = value
        elif normalized not in env:
            env[key] = value
    return env


def _wait_until_ready(timeout: float = 12.0) -> None:
    deadline = time.time() + timeout
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            with urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=1) as response:
                if response.status == 200:
                    return
        except Exception as exc:
            last_error = exc
            time.sleep(0.5)
    raise RuntimeError(f"Backend did not become ready: {last_error}")


def main() -> None:
    creationflags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS | subprocess.CREATE_NO_WINDOW
    with OUT_LOG.open("ab") as stdout, ERR_LOG.open("ab") as stderr:
        process = subprocess.Popen(
            [
                str(PYTHONW if PYTHONW.exists() else PYTHON),
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
            env=_clean_env(),
        )
    PID_FILE.write_text(str(process.pid), encoding="utf-8")
    _wait_until_ready()


if __name__ == "__main__":
    main()
