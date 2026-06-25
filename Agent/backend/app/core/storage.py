from pathlib import Path
from uuid import uuid4
import base64

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


def save_data_url(data_url: str, filename: str = "photo.jpg", category: str = "attachments") -> tuple[str, int, str | None]:
    content_type = None
    payload = data_url
    if data_url.startswith("data:") and "," in data_url:
        header, payload = data_url.split(",", 1)
        content_type = header.removeprefix("data:").split(";")[0] or None
    raw = base64.b64decode(payload)
    target_dir = settings.storage_dir / category / str(uuid4())
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / filename
    target.write_bytes(raw)
    return str(target), len(raw), content_type
