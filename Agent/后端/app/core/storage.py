from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from .config import settings


def save_upload(file: UploadFile, category: str = "uploads") -> tuple[str, int]:
    target_dir = settings.storage_dir / category / str(uuid4())
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / (file.filename or "upload.bin")
    size = 0
    with target.open("wb") as output:
        while chunk := file.file.read(1024 * 1024):
            output.write(chunk)
            size += len(chunk)
    return str(target), size
