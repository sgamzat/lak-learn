from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router
from app.api.routes.content import router as content_router
from app.api.routes.dictionary import router as dictionary_router
from app.api.routes.health import router as health_router
from app.api.routes.stats import router as stats_router
from app.api.routes.study import router as study_router
from app.core.config import settings


app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.backend_cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(content_router)
app.include_router(dictionary_router)
app.include_router(study_router)
app.include_router(stats_router)
