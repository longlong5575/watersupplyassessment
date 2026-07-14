from pathlib import Path
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: Literal["local", "production"] = "local"
    database_url: str = "sqlite:///./storage/assessment.db"
    redis_url: str = "redis://127.0.0.1:6379/0"
    storage_dir: Path = Path("storage")
    celery_task_always_eager: bool = True
    secret_key: str = "local-development-secret-change-before-production"
    access_token_expire_minutes: int = 43200
    login_max_failures: int = 5
    login_lock_minutes: int = 15
    local_auto_login: bool = True
    max_upload_size_mb: int = 200
    admin_initial_password: str = "Admin@123456"
    inspector_initial_password: str = "Inspector@123456"
    cors_origins: str = "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5174,http://localhost:5174"
    cors_origin_regex: str = r"^https?://(127\.0\.0\.1|localhost)(:\d+)?$"

    @model_validator(mode="after")
    def validate_production_settings(self):
        if self.app_env != "production":
            return self
        errors: list[str] = []
        if self.local_auto_login:
            errors.append("生产环境必须关闭本地自动登录")
        if len(self.secret_key) < 32 or self.secret_key == "local-development-secret-change-before-production":
            errors.append("SECRET_KEY 必须设置为至少32位的随机值")
        if self.database_url.startswith("sqlite"):
            errors.append("生产环境必须使用 PostgreSQL 数据库")
        if "assessment-local-password" in self.database_url or "请替换数据库密码" in self.database_url:
            errors.append("生产环境必须设置正式数据库密码")
        if self.admin_initial_password == "Admin@123456" or len(self.admin_initial_password) < 12:
            errors.append("ADMIN_INITIAL_PASSWORD 必须设置为至少12位的非默认密码")
        if self.inspector_initial_password == "Inspector@123456" or len(self.inspector_initial_password) < 12:
            errors.append("INSPECTOR_INITIAL_PASSWORD 必须设置为至少12位的非默认密码")
        if "*" in self.cors_origin_list or "localhost" in self.cors_origins or "127.0.0.1" in self.cors_origins:
            errors.append("CORS_ORIGINS 必须设置为正式站点域名，不能使用通配符或本机地址")
        if self.cors_origin_regex:
            errors.append("生产环境必须将 CORS_ORIGIN_REGEX 留空")
        if errors:
            raise ValueError("；".join(errors))
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def backend_dir(self) -> Path:
        return Path(__file__).resolve().parents[2]

    @property
    def project_root(self) -> Path:
        if self.backend_dir.name.lower() in {"back", "backend"} and self.backend_dir.parent.name == "Agent":
            return self.backend_dir.parent.parent
        return self.backend_dir.parent


settings = Settings()
