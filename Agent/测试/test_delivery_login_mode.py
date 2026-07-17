from __future__ import annotations

import importlib.util
import os
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.config import Settings


def load_startup_module():
    path = ROOT / "内部脚本" / "start_windows_silent.py"
    spec = importlib.util.spec_from_file_location("watersupply_startup", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("无法读取静默启动脚本")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> None:
    for key in ("APP_ENV", "LOCAL_AUTO_LOGIN"):
        os.environ.pop(key, None)

    delivery = Settings(_env_file=None)
    assert delivery.app_env == "delivery"
    assert delivery.local_auto_login is False

    local = Settings(_env_file=None, app_env="local", local_auto_login=True)
    assert local.app_env == "local"
    assert local.local_auto_login is True

    startup = load_startup_module()
    with tempfile.TemporaryDirectory() as temp_dir:
        private_file = Path(temp_dir) / ".env.local"
        startup.LOCAL_MODE_FILE = private_file
        assert startup.local_mode_overrides() == {"APP_ENV": "delivery", "LOCAL_AUTO_LOGIN": "false"}
        private_file.write_text("APP_ENV=local\nLOCAL_AUTO_LOGIN=true\n", encoding="utf-8")
        assert startup.local_mode_overrides() == {"APP_ENV": "local", "LOCAL_AUTO_LOGIN": "true"}

    powershell_startup = (ROOT / "内部脚本" / "start.ps1").read_text(encoding="utf-8-sig")
    assert '$env:APP_ENV = "delivery"' in powershell_startup
    assert '$env:LOCAL_AUTO_LOGIN = "false"' in powershell_startup
    assert 'Join-Path $agentRoot ".env.local"' in powershell_startup

    print("PASS: 本机免登录与交付登录模式隔离")


if __name__ == "__main__":
    main()
