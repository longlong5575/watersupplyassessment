from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import admin_user, current_user
from app.core.storage import save_upload
from app.models import AssessmentRecord, Attachment, User


router = APIRouter(tags=["uploads"])


@router.post("/api/uploads")
def upload(file: UploadFile = File(...), session: Session = Depends(get_session), user: User = Depends(admin_user)):
    storage_key, size = save_upload(file)
    attachment = Attachment(filename=file.filename or "upload.bin", storage_key=storage_key, content_type=file.content_type, size=size)
    session.add(attachment)
    session.commit()
    return {"id": attachment.id, "filename": attachment.filename, "size": attachment.size}


@router.get("/api/uploads/{attachment_id}/download")
def download_attachment(attachment_id: str, session: Session = Depends(get_session), user: User = Depends(current_user)):
    attachment = session.get(Attachment, attachment_id)
    if attachment is None:
        raise HTTPException(status_code=404, detail="未找到附件")
    if attachment.record_id:
        record = session.get(AssessmentRecord, attachment.record_id)
        if record is None or (user.role != "admin" and record.owner_user_id != user.id):
            raise HTTPException(status_code=404, detail="未找到附件")
    elif user.role != "admin":
        raise HTTPException(status_code=404, detail="未找到附件")
    path = Path(attachment.storage_key)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="附件文件不存在")
    return FileResponse(path, filename=attachment.filename, media_type=attachment.content_type)
