from __future__ import annotations

import os
import shutil
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
AGENT_ROOT = SCRIPT_DIR.parent
BACKEND = AGENT_ROOT / "backend"
FRONT = AGENT_ROOT / "frontend" / "front"
MOBILE = AGENT_ROOT / "frontend" / "front-mobile"
LOG_DIR = AGENT_ROOT / "logs"
STARTUP_LOG = LOG_DIR / "startup.log"


def log(message: str) -> None:
    LOG_DIR.mkdir(exist_ok=True)
    with STARTUP_LOG.open("a", encoding="utf-8") as handle:
        handle.write(message + "\n")


def run(args: list[str], cwd: Path) -> None:
    LOG_DIR.mkdir(exist_ok=True)
    with STARTUP_LOG.open("ab") as output:
        subprocess.check_call(
            args,
            cwd=str(cwd),
            stdout=output,
            stderr=output,
            stdin=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW,
            env=os.environ.copy(),
        )


def find_python() -> Path:
    current = Path(sys.executable)
    if current.name.lower() == "pythonw.exe":
        sibling = current.with_name("python.exe")
        if sibling.exists():
            return sibling
    if current.name.lower() == "python.exe":
        return current
    env_python = os.environ.get("PYTHON312_EXE")
    if env_python and Path(env_python).exists():
        return Path(env_python)
    local = Path(os.environ["LOCALAPPDATA"]) / "Programs" / "Python" / "Python312" / "python.exe"
    if local.exists():
        return local
    py_launcher = shutil.which("py")
    if py_launcher:
        completed = subprocess.check_output(
            [py_launcher, "-3.12", "-c", "import sys; print(sys.executable)"],
            text=True,
            creationflags=subprocess.CREATE_NO_WINDOW,
        ).strip()
        if completed:
            return Path(completed)
    raise RuntimeError("Python 3.12 was not found. Please install Python 3.12 first.")


def find_pythonw(python: Path) -> Path:
    candidate = python.with_name("pythonw.exe")
    return candidate if candidate.exists() else python


def find_pnpm() -> str:
    local = Path(os.environ.get("USERPROFILE", "")) / ".cache" / "codex-runtimes" / "codex-primary-runtime" / "dependencies" / "bin" / "pnpm.cmd"
    if local.exists():
        return str(local)
    found = shutil.which("pnpm.cmd") or shutil.which("pnpm")
    if found:
        return found
    npx = shutil.which("npx.cmd") or shutil.which("npx")
    if npx:
        return npx
    raise RuntimeError("pnpm or npx was not found. Please install Node.js first.")


def ensure_env_file(directory: Path) -> None:
    example = directory / ".env.example"
    local = directory / ".env.local"
    if example.exists() and not local.exists():
        local.write_text(example.read_text(encoding="utf-8"), encoding="utf-8")


def ensure_backend(python: Path) -> Path:
    venv_python = BACKEND / ".venv" / "Scripts" / "python.exe"
    if not venv_python.exists():
        run([str(python), "-m", "venv", ".venv"], BACKEND)
    run([str(venv_python), "-m", "pip", "install", "--disable-pip-version-check", "-r", "requirements.txt"], BACKEND)
    return venv_python


def ensure_frontend(directory: Path, pnpm: str) -> None:
    ensure_env_file(directory)
    if Path(pnpm).name.lower().startswith("npx"):
        run([pnpm, "--yes", "pnpm@10.12.1", "install", "--frozen-lockfile"], directory)
    else:
        run([pnpm, "install", "--frozen-lockfile"], directory)


def start_detached(args: list[str], cwd: Path, name: str) -> None:
    LOG_DIR.mkdir(exist_ok=True)
    flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS | subprocess.CREATE_NO_WINDOW
    with (LOG_DIR / f"{name}.out.log").open("ab") as stdout, (LOG_DIR / f"{name}.err.log").open("ab") as stderr:
        process = subprocess.Popen(
            args,
            cwd=str(cwd),
            stdin=subprocess.DEVNULL,
            stdout=stdout,
            stderr=stderr,
            creationflags=flags,
            env={**os.environ.copy(), "BROWSER": "none"},
        )
    (LOG_DIR / f"{name}.pid").write_text(str(process.pid), encoding="utf-8")


def wait_for(url: str, seconds: int = 35) -> None:
    deadline = time.time() + seconds
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2):
                return
        except Exception:
            time.sleep(1)
    log(f"Timeout waiting for {url}")


def is_available(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=2):
            return True
    except Exception:
        return False


def main() -> None:
    try:
        LOG_DIR.mkdir(exist_ok=True)
        log("=== Windows silent startup ===")
        python = find_python()
        pythonw = find_pythonw(python)
        pnpm = find_pnpm()

        backend_python = ensure_backend(python)
        ensure_frontend(FRONT, pnpm)
        ensure_frontend(MOBILE, pnpm)

        backend_running = is_available("http://127.0.0.1:8000/health")
        front_running = is_available("http://127.0.0.1:5173")
        mobile_running = is_available("http://127.0.0.1:5174")

        if not backend_running:
            start_detached(
                [str(find_pythonw(backend_python)), str(BACKEND / "start_backend_silent.py")],
                BACKEND,
                "backend-launcher",
            )
        if not front_running:
            start_detached([str(pythonw), str(SCRIPT_DIR / "start_frontend_silent.py"), str(FRONT), "front"], AGENT_ROOT, "front-launcher")
        if not mobile_running:
            start_detached([str(pythonw), str(SCRIPT_DIR / "start_frontend_silent.py"), str(MOBILE), "front-mobile"], AGENT_ROOT, "front-mobile-launcher")

        wait_for("http://127.0.0.1:8000/health")
        wait_for("http://127.0.0.1:5173")
        wait_for("http://127.0.0.1:5174")
        if not front_running:
            webbrowser.open("http://127.0.0.1:5173")
        if not mobile_running:
            webbrowser.open("http://127.0.0.1:5174")
        log("Startup completed")
    except Exception as exc:
        log(f"Startup failed: {exc}")


if __name__ == "__main__":
    main()
