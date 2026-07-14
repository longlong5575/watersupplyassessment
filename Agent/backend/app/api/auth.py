from __future__ import annotations

import secrets
import string
from datetime import datetime, timedelta, timezone
from math import ceil

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_session
from app.core.security import admin_user, create_access_token, current_user, hash_password, verify_password
from app.models import User
from app.schemas import ChangePasswordRequest, LoginRequest, ResetPasswordRequest, UserCreateRequest, UserUpdateRequest


router = APIRouter(prefix="/api/auth", tags=["auth"])


def _aware(value: datetime | None) -> datetime | None:
    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=timezone.utc)


def _user_payload(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "name": user.display_name,
        "role": user.role,
        "isActive": user.is_active,
        "lastLoginAt": user.last_login_at.isoformat() if user.last_login_at else None,
        "passwordChangedAt": user.password_changed_at.isoformat() if user.password_changed_at else None,
    }


def _active_admin_count(session: Session) -> int:
    return int(session.scalar(select(func.count(User.id)).where(User.role == "admin", User.is_active.is_(True))) or 0)


def _temporary_password() -> str:
    alphabet = string.ascii_letters + string.digits
    while True:
        value = "".join(secrets.choice(alphabet) for _ in range(8))
        if any(character.isalpha() for character in value) and any(character.isdigit() for character in value):
            return value


@router.post("/login")
def login(payload: LoginRequest, session: Session = Depends(get_session)):
    username = payload.username.strip()
    user = session.scalar(select(User).where(func.lower(User.username) == username.lower(), User.is_active.is_(True)))
    now = datetime.now(timezone.utc)
    if user is not None:
        locked_until = _aware(user.locked_until)
        if locked_until and locked_until > now:
            remaining = max(1, ceil((locked_until - now).total_seconds() / 60))
            raise HTTPException(status_code=423, detail=f"账号已暂时锁定，请在{remaining}分钟后重试")
    if user is None or not verify_password(payload.password, user.password_hash):
        if user is not None:
            user.failed_login_attempts = int(user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= settings.login_max_failures:
                user.locked_until = now + timedelta(minutes=settings.login_lock_minutes)
                user.failed_login_attempts = 0
            session.commit()
        raise HTTPException(status_code=401, detail="账号或密码错误")
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = now
    token, expires_at = create_access_token(user)
    session.commit()
    return {"token": token, "expiresAt": expires_at.isoformat(), "user": _user_payload(user)}


@router.post("/local-session")
def local_session(session: Session = Depends(get_session)):
    if settings.app_env != "local" or not settings.local_auto_login:
        raise HTTPException(status_code=404, detail="自动登录未启用")
    user = session.scalar(select(User).where(User.username == "inspector", User.is_active.is_(True)))
    if user is None:
        raise HTTPException(status_code=503, detail="现场采集账号尚未初始化")
    now = datetime.now(timezone.utc)
    user.last_login_at = now
    token, expires_at = create_access_token(user)
    session.commit()
    return {"token": token, "expiresAt": expires_at.isoformat(), "user": _user_payload(user)}


@router.post("/local-admin-session")
def local_admin_session(session: Session = Depends(get_session)):
    if settings.app_env != "local" or not settings.local_auto_login:
        raise HTTPException(status_code=404, detail="自动登录未启用")
    user = session.scalar(select(User).where(User.username == "admin", User.is_active.is_(True)))
    if user is None:
        raise HTTPException(status_code=503, detail="系统管理员账号尚未初始化")
    now = datetime.now(timezone.utc)
    user.last_login_at = now
    token, expires_at = create_access_token(user)
    session.commit()
    return {"token": token, "expiresAt": expires_at.isoformat(), "user": _user_payload(user)}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return {"user": _user_payload(user)}


@router.post("/change-password")
def change_password(payload: ChangePasswordRequest, user: User = Depends(current_user), session: Session = Depends(get_session)):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="当前密码不正确")
    if verify_password(payload.new_password, user.password_hash):
        raise HTTPException(status_code=400, detail="新密码不能与当前密码相同")
    user.password_hash = hash_password(payload.new_password)
    user.password_changed_at = datetime.now(timezone.utc)
    user.token_version = int(user.token_version or 0) + 1
    session.commit()
    return {"message": "密码已修改，请重新登录"}


@router.get("/users")
def list_users(_: User = Depends(admin_user), session: Session = Depends(get_session)):
    users = session.scalars(select(User).order_by(User.created_at, User.username)).all()
    return {"items": [_user_payload(user) for user in users]}


@router.post("/users", status_code=201)
def create_user(payload: UserCreateRequest, _: User = Depends(admin_user), session: Session = Depends(get_session)):
    username = payload.username.strip()
    existing = session.scalar(select(User).where(func.lower(User.username) == username.lower()))
    if existing is not None:
        raise HTTPException(status_code=409, detail="该账号已经存在")
    temporary_password = _temporary_password()
    now = datetime.now(timezone.utc)
    user = User(
        username=username,
        display_name=payload.display_name.strip(),
        role=payload.role,
        password_hash=hash_password(temporary_password),
        password_changed_at=now,
        is_active=True,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return {"user": _user_payload(user), "temporaryPassword": temporary_password}


@router.put("/users/{user_id}")
def update_user(user_id: str, payload: UserUpdateRequest, operator: User = Depends(admin_user), session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="账号不存在")
    target_role = payload.role if payload.role is not None else user.role
    target_active = payload.is_active if payload.is_active is not None else user.is_active
    removing_active_admin = user.role == "admin" and user.is_active and (target_role != "admin" or not target_active)
    if removing_active_admin and _active_admin_count(session) <= 1:
        raise HTTPException(status_code=400, detail="系统必须至少保留一个启用的管理员账号")
    if user.id == operator.id and not target_active:
        raise HTTPException(status_code=400, detail="不能停用当前登录账号")
    if payload.display_name is not None:
        user.display_name = payload.display_name.strip()
    user.role = target_role
    if user.is_active != target_active:
        user.is_active = target_active
        user.token_version = int(user.token_version or 0) + 1
    session.commit()
    return {"user": _user_payload(user)}


@router.post("/users/{user_id}/reset-password")
def reset_password(user_id: str, _: ResetPasswordRequest, operator: User = Depends(admin_user), session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="账号不存在")
    temporary_password = _temporary_password()
    user.password_hash = hash_password(temporary_password)
    user.password_changed_at = datetime.now(timezone.utc)
    user.failed_login_attempts = 0
    user.locked_until = None
    user.token_version = int(user.token_version or 0) + 1
    session.commit()
    return {"message": "密码已重置，该账号需要重新登录", "temporaryPassword": temporary_password}
