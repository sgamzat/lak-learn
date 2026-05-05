from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, require_admin_or_bootstrap
from app.core.redis_client import redis_client
from app.db.session import get_db_session
from app.models.entities import ImportLog, User, Word, WordCategory
from app.schemas.content import (
    DryRunResponse,
    ExecuteResponse,
    JobStatusResponse,
)
from app.services.content import dry_run_import, execute_import, parse_import_file


router = APIRouter(prefix="/api/admin", tags=["content-admin"])


@router.post("/import/dry-run", response_model=DryRunResponse)
async def import_dry_run(
    file: UploadFile = File(...),
    _: User = Depends(require_admin_or_bootstrap),
    db: AsyncSession = Depends(get_db_session),
) -> DryRunResponse:
    payload = await parse_import_file(await file.read())
    return await dry_run_import(db, payload)


@router.post("/import/execute", response_model=ExecuteResponse)
async def import_execute(
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin_or_bootstrap),
    db: AsyncSession = Depends(get_db_session),
) -> ExecuteResponse:
    lock_key = f"import:{current_user.id}"
    if await redis_client.get(lock_key):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Import already running")

    await redis_client.setex(lock_key, 300, "1")
    try:
        payload = await parse_import_file(await file.read())
        log = await execute_import(db, user_id=current_user.id, filename=file.filename or "upload.json", payload=payload)
    finally:
        await redis_client.delete(lock_key)

    return ExecuteResponse(job_id=log.id, status="processing")


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    job_id: UUID,
    _: User = Depends(require_admin_or_bootstrap),
    db: AsyncSession = Depends(get_db_session),
) -> JobStatusResponse:
    result = await db.execute(select(ImportLog).where(ImportLog.id == job_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return JobStatusResponse(job_id=job.id, status=job.status, diff_summary=job.diff_summary)


@router.get("/export")
async def export_words(
    format: str = Query(default="json"),
    category_id: UUID | None = Query(default=None),
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if format != "json":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only json format supported")

    stmt = select(Word)
    if category_id:
        stmt = stmt.join(WordCategory, WordCategory.word_id == Word.id).where(WordCategory.category_id == category_id)

    words = (await db.execute(stmt)).scalars().all()
    return {
        "meta": {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "version": "1.0",
            "count": len(words),
        },
        "words": [
            {
                "source_key": word.source_key,
                "lemma": word.lemma,
                "translation": word.translation,
                "pos": word.pos,
                "difficulty_level": word.difficulty_level,
                "frequency": word.frequency,
                "example_sentence": word.example_sentence,
            }
            for word in words
        ],
    }
