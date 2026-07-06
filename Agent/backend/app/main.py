import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import agent, auth, dashboard, mobile, records, reports, standards, uploads
from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.core.schema import ensure_local_schema
from app.services.seed import seed_database


app = FastAPI(title="排水绩效考核后端", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(mobile.router)
app.include_router(agent.router)
app.include_router(auth.router)
app.include_router(standards.router)
app.include_router(dashboard.router)
app.include_router(records.router)
app.include_router(reports.router)
app.include_router(uploads.router)


@app.on_event("startup")
def startup() -> None:
    # Development fallback; production schema changes are managed by Alembic.
    Base.metadata.create_all(bind=engine)
    ensure_local_schema()
    with SessionLocal() as session:
        seed_database(session)


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "database": "connected",
        "buildId": os.environ.get("WATERSUPPLY_BUILD_ID", "development"),
    }
