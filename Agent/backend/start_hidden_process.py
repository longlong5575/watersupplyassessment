from __future__ import annotations

import argparse
import os
import subprocess
from pathlib import Path


def clean_environment() -> dict[str, str]:
    cleaned: dict[str, str] = {}
    seen: set[str] = set()
    for key, value in os.environ.items():
        normalized = key.upper()
        if normalized in seen:
            continue
        seen.add(normalized)
        cleaned["Path" if normalized == "PATH" else key] = value
    return cleaned


def main() -> None:
    parser = argparse.ArgumentParser(description="静默启动子进程并返回进程号")
    parser.add_argument("--working-directory", required=True)
    parser.add_argument("--stdout", required=True)
    parser.add_argument("--stderr", required=True)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = list(args.command)
    if command and command[0] == "--":
        command = command[1:]
    if not command:
        raise SystemExit("缺少要启动的程序。")
    stdout_path = Path(args.stdout)
    stderr_path = Path(args.stderr)
    stdout_path.parent.mkdir(parents=True, exist_ok=True)
    stderr_path.parent.mkdir(parents=True, exist_ok=True)
    flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS | subprocess.CREATE_NO_WINDOW
    with stdout_path.open("ab") as stdout, stderr_path.open("ab") as stderr:
        process = subprocess.Popen(
            command,
            cwd=args.working_directory,
            stdin=subprocess.DEVNULL,
            stdout=stdout,
            stderr=stderr,
            creationflags=flags,
            env=clean_environment(),
        )
    print(process.pid)


if __name__ == "__main__":
    main()