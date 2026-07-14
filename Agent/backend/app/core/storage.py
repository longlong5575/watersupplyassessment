from pathlib import Path
from uuid import uuid4
import base64
import binascii

from fastapi import HTTPException, UploadFile

from .config import settings


def _safe_filename(filename: str | None, fallback: str) -> str:
    normalized = (filename or fallback).replace("\\", "/")
    return Path(normalized).name or fallback


def _max_upload_bytes() -> int:
    return max(1, int(settings.max_upload_size_mb)) * 1024 * 1024


def save_upload(file: UploadFile, category: str = "uploads") -> tuple[str, int]:
    target_dir = settings.storage_dir / category / str(uuid4())
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / _safe_filename(file.filename, "upload.bin")
    size = 0
    try:
        with target.open("wb") as output:
            while chunk := file.file.read(1024 * 1024):
                size += len(chunk)
                if size > _max_upload_bytes():
                    raise HTTPException(status_code=413, detail=f"上传文件不能超过{settings.max_upload_size_mb}MB")
                output.write(chunk)
    except Exception:
        target.unlink(missing_ok=True)
        try:
            target_dir.rmdir()
        except OSError:
            pass
        raise
    return str(target), size


def save_data_url(data_url: str, filename: str = "photo.jpg", category: str = "attachments") -> tuple[str, int, str | None]:
    content_type = None
    payload = data_url
    if data_url.startswith("data:") and "," in data_url:
        header, payload = data_url.split(",", 1)
        content_type = header.removeprefix("data:").split(";")[0] or None
    try:
        raw = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=422, detail="图片数据格式无效，请重新选择文件") from exc
    if len(raw) > _max_upload_bytes():
        raise HTTPException(status_code=413, detail=f"上传文件不能超过{settings.max_upload_size_mb}MB")
    target_dir = settings.storage_dir / category / str(uuid4())
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / _safe_filename(filename, "photo.jpg")
    target.write_bytes(raw)
    return str(target), len(raw), content_type