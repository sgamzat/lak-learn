from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.session import get_db_session
from app.models.entities import User, Word, WordCategory


router = APIRouter(prefix="/api", tags=["dictionary"])


@router.get("/dictionary")
async def dictionary(
    q: str | None = Query(default=None),
    pos: str | None = Query(default=None),
    category_id: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    stmt = select(Word)

    filters = []
    if q:
        filters.append(Word.lemma.ilike(f"%{q}%"))
    if pos:
        filters.append(Word.pos == pos)

    if category_id:
        stmt = stmt.join(WordCategory, WordCategory.word_id == Word.id)
        filters.append(WordCategory.category_id == category_id)

    if filters:
        stmt = stmt.where(and_(*filters))

    stmt = stmt.limit(limit)
    words = (await db.execute(stmt)).scalars().all()

    return [
        {
            "id": str(word.id),
            "source_key": word.source_key,
            "lemma": word.lemma,
            "translation": word.translation,
            "pos": word.pos,
            "difficulty_level": word.difficulty_level,
            "frequency": word.frequency,
            "example_sentence": word.example_sentence,
        }
        for word in words
    ]

