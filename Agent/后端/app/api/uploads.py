from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.storage import save_upload
from app.models import Attachment


router = APIRouter(tags=["uploads"])


@router.post("/api/uploads")
def upload(file: UploadFile = File(...), session: Session = Depends(get_session)):
    storage_key, size = save_upload(file)
    attachment = Attachment(filename=file.filename or "upload.bin", storage_key=storage_key, content_type=file.content_type, size=size)
    session.add(attachment)
    session.commit()
    return {"id": attachment.id, "filename": attachment.filename, "size": attachment.size}
