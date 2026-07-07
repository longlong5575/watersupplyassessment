from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import current_user
from app.models import User


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(payload: dict, session: Session = Depends(get_session)):
    username = payload.get("username", "")
    user = session.scalar(select(User).where(User.username == username, User.is_active.is_(True)))
    if user is None:
        raise HTTPException(status_code=401, detail="账号无效")
    return {"token": f"dev-{user.id}", "user": {"id": user.id, "name": user.display_name, "role": user.role}}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return {"user": {"id": user.id, "name": user.display_name, "role": user.role}}
