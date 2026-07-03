from __future__ import annotations

import os
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path


AGENT_ROOT = Path(__file__).resolve().parent.parent


def default_runtime_root() -> Path:
    if os.environ.get("WATERSUPPLY_RUNTIME_DIR"):
        return Path(os.environ["WATERSUPPLY_RUNTIME_DIR"])
    base = AGENT_ROOT.parent.parent if AGENT_ROOT.parent.name.lower() == "watersupplyassessment" else AGENT_ROOT.parent
    return base / "运行脚本" / "watersupply-agent-runtime"


RUNTIME_ROOT = default_runtime_root()
LOG_DIR = RUNTIME_ROOT / "logs"
BACKEND_DIR = AGENT_ROOT / "backend"
BACKEND_STARTER = BACKEND_DIR / "start_backend_silent.py"
BACKEND_PACKAGES = RUNTIME_ROOT / "backend" / "python-packages"
BACKEND_VENV_PACKAGES = RUNTIME_ROOT / "backend" / ".venv" / "Lib" / "site-packages"
PNPM_CANDIDATES = [
    Path(os.environ.get("USERPROFILE", "")) / ".cache" / "codex-runtimes" / "codex-primary-runtime" / "dependencies" / "bin" / "pnpm.cmd",
]


def find_pnpm() -> str:
    for candidate in PNPM_CANDIDATES:
        if candidate.exists():
            return str(candidate)
    return "pnpm.cmd"


def find_python(windowed: bool = True) -> Path | None:
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
    return None


def backend_is_ready() -> bool:
    try:
        with urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=1.5) as response:
            return 200 <= response.status < 300
    except Exception:
        return False


def ensure_backend(creationflags: int) -> None:
    if backend_is_ready():
        return
    python = find_python(windowed=True)
    if python is None or not BACKEND_STARTER.exists():
        return
    LOG_DIR.mkdir(exist_ok=True)
    with (LOG_DIR / "backend-autostart.out.log").open("ab") as stdout, (LOG_DIR / "backend-autostart.err.log").open("ab") as stderr:
        storage_dir = RUNTIME_ROOT / "storage"
        env = os.environ.copy()
        env.update({
            "WATERSUPPLY_RUNTIME_DIR": str(RUNTIME_ROOT),
            "DATABASE_URL": f"sqlite:///{(storage_dir / 'assessment.db').as_posix()}",
            "STORAGE_DIR": str(storage_dir),
            "CELERY_TASK_ALWAYS_EAGER": "true",
        })
        package_paths = [str(BACKEND_PACKAGES), str(BACKEND_VENV_PACKAGES)]
        if env.get("PYTHONPATH"):
            package_paths.append(env["PYTHONPATH"])
        env["PYTHONPATH"] = os.pathsep.join(package_paths)
        subprocess.Popen(
            [str(python), str(BACKEND_STARTER)],
            cwd=str(BACKEND_DIR),
            stdin=subprocess.DEVNULL,
            stdout=stdout,
            stderr=stderr,
            creationflags=creationflags,
            env=env,
        )
    for _ in range(12):
        if backend_is_ready():
            return
        time.sleep(0.5)


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: start_frontend_silent.py <directory> <name>")

    directory = Path(sys.argv[1]).resolve()
    name = sys.argv[2]
    LOG_DIR.mkdir(exist_ok=True)

    env = os.environ.copy()
    env["BROWSER"] = "none"
    env["WATERSUPPLY_RUNTIME_DIR"] = str(RUNTIME_ROOT)
    creationflags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS | subprocess.CREATE_NO_WINDOW
    ensure_backend(creationflags)

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
