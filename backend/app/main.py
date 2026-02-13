from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.core.config import settings
from app.db.session import init_db

app = FastAPI(title=settings.app_name, version="0.2.0")
app.include_router(router)

media_dir = Path(__file__).resolve().parent.parent / "uploaded_media"
media_dir.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=media_dir), name="media")


@app.on_event("startup")
def startup() -> None:
    init_db()
