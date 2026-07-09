from __future__ import annotations

import os
import shutil
import sys
import subprocess
import time
import urllib.request
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent


def default_runtime_root() -> Path:
    if os.environ.get("WATERSUPPLY_RUNTIME_DIR"):
        return Path(os.environ["WATERSUPPLY_RUNTIME_DIR"])
    agent_root = BACKEND_DIR.parent
    base = agent_root.parent.parent if agent_root.parent.name.lower() == "watersupplyassessment" else agent_root.parent
    return base / "运行脚本" / "watersupply-agent-runtime"


RUNTIME_ROOT = default_runtime_root()
PYTHON_PACKAGES = RUNTIME_ROOT / "backend" / "python-packages"
LOG_DIR = RUNTIME_ROOT / "logs"
STORAGE_DIR = RUNTIME_ROOT / "storage"
PID_FILE = LOG_DIR / "backend-server.pid"
OUT_LOG = LOG_DIR / "backend-server.out.log"
ERR_LOG = LOG_DIR / "backend-server.err.log"
BACKEND_PORT = os.environ.get("BACKEND_PORT", "8000")


def _system_python(windowed: bool = True) -> Path:
    candidates: list[Path] = []
    env_python = os.environ.get("PYTHON312_EXE")
    if env_python:
        candidates.append(Path(env_python))
    local_app = os.environ.get("LOCALAPPDATA")
    if local_app:
        candidates.append(Path(local_app) / "Programs" / "Python" / "Python312" / "python.exe")
    if sys.executable:
        candidates.append(Path(sys.executable))
    for name in ("py", "python"):
        found = shutil.which(name)
        if found:
            candidates.append(Path(found))
    for candidate in candidates:
        if candidate.exists():
            if windowed and candidate.name.lower() == "python.exe":
                pythonw = candidate.with_name("pythonw.exe")
                if pythonw.exists():
                    return pythonw
            return candidate
    raise RuntimeError("未找到 Python 3.12，请先安装 Python 3.12。")


def _clean_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for key, value in os.environ.items():
        normalized = key.upper()
        if normalized == "PATH":
            env["Path"] = value
        elif normalized not in env:
            env[key] = value
    env["WATERSUPPLY_RUNTIME_DIR"] = str(RUNTIME_ROOT)
    env["DATABASE_URL"] = f"sqlite:///{(STORAGE_DIR / 'assessment.db').as_posix()}"
    env["STORAGE_DIR"] = str(STORAGE_DIR)
    env["CELERY_TASK_ALWAYS_EAGER"] = "true"
    package_paths = [str(PYTHON_PACKAGES)]
    existing = env.get("PYTHONPATH")
    env["PYTHONPATH"] = os.pathsep.join([*package_paths, existing] if existing else package_paths)
    return env


def _wait_until_ready(timeout: float = 45.0) -> None:
    deadline = time.time() + timeout
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{BACKEND_PORT}/health", timeout=1) as response:
                if response.status == 200:
                    return
        except Exception as exc:
            last_error = exc
            time.sleep(0.5)
    raise RuntimeError(f"后端服务未能正常启动：{last_error}")


def main() -> None:
    creationflags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS | subprocess.CREATE_NO_WINDOW
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    python_exe = _system_python(windowed=True)
    with OUT_LOG.open("ab") as stdout, ERR_LOG.open("ab") as stderr:
        process = subprocess.Popen(
            [
                str(python_exe),
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                BACKEND_PORT,
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
