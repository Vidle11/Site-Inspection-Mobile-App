from fastapi import FastAPI

from app.api.routes import router
from app.core.config import settings
from app.db.session import init_db

app = FastAPI(title=settings.app_name, version="0.2.0")
app.include_router(router)


@app.on_event("startup")
def startup() -> None:
    init_db()
