from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./storage/assessment.db"
    redis_url: str = "redis://127.0.0.1:6379/0"
    storage_dir: Path = Path("storage")
    celery_task_always_eager: bool = True
    cors_origins: str = "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5174,http://localhost:5174"

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def backend_dir(self) -> Path:
        return Path(__file__).resolve().parents[2]

    @property
    def project_root(self) -> Path:
        if self.backend_dir.name.lower() == "back" and self.backend_dir.parent.name == "Agent":
            return self.backend_dir.parent.parent
        return self.backend_dir.parent


settings = Settings()
