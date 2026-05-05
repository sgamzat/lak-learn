from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict


router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    model_config = ConfigDict(strict=True)

    status: str
    service: str
    timestamp_utc: str


@router.get("/healthz", response_model=HealthResponse)
async def healthz() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="backend",
        timestamp_utc=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/readyz", response_model=HealthResponse)
async def readyz() -> HealthResponse:
    return HealthResponse(
        status="ready",
        service="backend",
        timestamp_utc=datetime.now(timezone.utc).isoformat(),
    )

