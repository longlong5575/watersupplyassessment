from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(alias="currentPassword", min_length=1)
    new_password: str = Field(alias="newPassword", min_length=1)


class UserCreateRequest(BaseModel):
    username: str = Field(min_length=2, max_length=80, pattern=r"^[A-Za-z0-9_.-]+$")
    display_name: str = Field(alias="displayName", min_length=1, max_length=120)
    role: Literal["admin", "inspector"] = "inspector"


class UserUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str | None = Field(default=None, alias="displayName", min_length=1, max_length=120)
    role: Literal["admin", "inspector"] | None = None
    is_active: bool | None = Field(default=None, alias="isActive")


class ResetPasswordRequest(BaseModel):
    pass
