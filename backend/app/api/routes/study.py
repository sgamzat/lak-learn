from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, asc, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.session import get_db_session
from app.models.entities import Category, User, UserWordProgress, Word, WordCategory
from app.schemas.study import QueueItem, ReviewRequest, ReviewResponse, ReviewStats
from app.services.srs import calculate_next_review


router = APIRouter(prefix="/api/study", tags=["study"])


async def _seed_user_progress_if_needed(db: AsyncSession, user_id: str, limit: int) -> None:
    count_result = await db.execute(select(func.count(UserWordProgress.id)).where(UserWordProgress.user_id == user_id))
    progress_count = count_result.scalar_one()
    if progress_count > 0:
        return

    words_result = await db.execute(select(Word).order_by(desc(Word.frequency)).limit(limit))
    words = words_result.scalars().all()
    now = datetime.now(timezone.utc)
    for word in words:
        db.add(
            UserWordProgress(
                user_id=user_id,
                word_id=word.id,
                status="new",
                next_review=now,
            )
        )
    await db.commit()


async def _get_queue(db: AsyncSession, user_id: str, limit: int, category_id: str | None) -> list[QueueItem]:
    now = datetime.now(timezone.utc)

    stmt = (
        select(UserWordProgress, Word)
        .join(Word, Word.id == UserWordProgress.word_id)
        .where(
            and_(
                UserWordProgress.user_id == user_id,
                or_(UserWordProgress.next_review.is_(None), UserWordProgress.next_review <= now),
            )
        )
        .order_by(asc(UserWordProgress.status), asc(UserWordProgress.next_review), desc(Word.frequency))
        .limit(limit)
    )

    if category_id:
        stmt = stmt.join(WordCategory, WordCategory.word_id == Word.id).join(
            Category, Category.id == WordCategory.category_id
        ).where(Category.id == category_id)

    rows = (await db.execute(stmt)).all()
    return [
        QueueItem(
            word_id=word.id,
            lemma=word.lemma,
            translation=word.translation,
            example_sentence=word.example_sentence,
            progress_id=progress.id,
        )
        for progress, word in rows
    ]


async def _build_stats(db: AsyncSession, user_id: str) -> ReviewStats:
    stats = {}
    for status_name in ["new", "learning", "review"]:
        count_result = await db.execute(
            select(func.count(UserWordProgress.id)).where(
                and_(UserWordProgress.user_id == user_id, UserWordProgress.status == status_name)
            )
        )
        stats[status_name] = count_result.scalar_one()
    return ReviewStats(**stats)


@router.get("/queue", response_model=list[QueueItem])
async def study_queue(
    limit: int = Query(default=20, ge=1, le=100),
    category_id: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[QueueItem]:
    await _seed_user_progress_if_needed(db, str(current_user.id), limit=50)
    return await _get_queue(db, str(current_user.id), limit, category_id)


@router.post("/review", response_model=ReviewResponse)
async def study_review(
    payload: ReviewRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> ReviewResponse:
    result = await db.execute(
        select(UserWordProgress).where(
            and_(UserWordProgress.id == payload.progress_id, UserWordProgress.user_id == current_user.id)
        )
    )
    progress = result.scalar_one_or_none()
    if progress is None:
        return ReviewResponse(next_word=None, remaining=0, stats=await _build_stats(db, str(current_user.id)))

    calculate_next_review(progress, payload.quality)
    await db.commit()

    queue = await _get_queue(db, str(current_user.id), limit=1, category_id=None)
    full_queue = await _get_queue(db, str(current_user.id), limit=100, category_id=None)
    stats = await _build_stats(db, str(current_user.id))

    return ReviewResponse(
        next_word=queue[0] if queue else None,
        remaining=len(full_queue),
        stats=stats,
    )

