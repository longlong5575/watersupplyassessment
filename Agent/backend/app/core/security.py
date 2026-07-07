from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.models import User


def current_user(authorization: str | None = Header(default=None), session: Session = Depends(get_session)) -> User:
    if not authorization or not authorization.startswith("Bearer dev-"):
        raise HTTPException(status_code=401, detail="Authentication required")
    user_id = authorization.removeprefix("Bearer dev-")
    user = session.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="账号无效")
    return user


def admin_user(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return user
