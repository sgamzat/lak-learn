import json
import unicodedata
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import Category, ImportLog, Tag, Word, WordCategory, WordTag
from app.schemas.content import DryRunResponse, ImportErrorItem, ImportPayload


def normalize_text(value: str) -> str:
    return unicodedata.normalize("NFC", value.strip())


async def parse_import_file(raw: bytes) -> ImportPayload:
    payload = json.loads(raw.decode("utf-8"))
    return ImportPayload.model_validate(payload)


async def ensure_category(db: AsyncSession, name_ru: str) -> Category:
    normalized = normalize_text(name_ru)
    result = await db.execute(select(Category).where(Category.name_ru == normalized))
    category = result.scalar_one_or_none()
    if category:
        return category
    category = Category(name_ru=normalized)
    db.add(category)
    await db.flush()
    return category


async def ensure_tag(db: AsyncSession, tag_name: str) -> Tag:
    normalized = normalize_text(tag_name)
    result = await db.execute(select(Tag).where(Tag.name == normalized))
    tag = result.scalar_one_or_none()
    if tag:
        return tag
    tag = Tag(name=normalized)
    db.add(tag)
    await db.flush()
    return tag


async def find_existing_word(db: AsyncSession, source_key: str | None, lemma: str, pos: str | None) -> Word | None:
    if source_key:
        by_source = await db.execute(select(Word).where(Word.source_key == source_key))
        word = by_source.scalar_one_or_none()
        if word is not None:
            return word

    by_lemma_pos = await db.execute(
        select(Word).where(and_(Word.lemma == lemma, Word.pos == pos))
    )
    return by_lemma_pos.scalar_one_or_none()


async def dry_run_import(db: AsyncSession, payload: ImportPayload) -> DryRunResponse:
    added = 0
    updated = 0
    skipped = 0
    errors: list[ImportErrorItem] = []

    for item in payload.words:
        try:
            lemma = normalize_text(item.lemma)
            pos = normalize_text(item.pos) if item.pos else None
            source_key = normalize_text(item.source_key) if item.source_key else None
            existing = await find_existing_word(db, source_key=source_key, lemma=lemma, pos=pos)
            if existing is None:
                added += 1
            else:
                updated += 1
        except Exception as exc:
            skipped += 1
            errors.append(ImportErrorItem(word=item.lemma, reason=str(exc)))

    return DryRunResponse(added=added, updated=updated, skipped=skipped, errors=errors)


async def execute_import(db: AsyncSession, user_id: UUID, filename: str, payload: ImportPayload) -> ImportLog:
    diff = await dry_run_import(db, payload)

    for item in payload.words:
        lemma = normalize_text(item.lemma)
        translation = normalize_text(item.translation)
        pos = normalize_text(item.pos) if item.pos else None
        source_key = normalize_text(item.source_key) if item.source_key else None

        now = datetime.now(timezone.utc)

        if source_key:
            stmt = insert(Word).values(
                source_key=source_key,
                lemma=lemma,
                translation=translation,
                pos=pos,
                difficulty_level=item.difficulty_level,
                frequency=item.frequency,
                example_sentence=item.example_sentence,
                last_imported_at=now,
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=[Word.source_key],
                set_={
                    "lemma": lemma,
                    "translation": translation,
                    "pos": pos,
                    "difficulty_level": item.difficulty_level,
                    "frequency": item.frequency,
                    "example_sentence": item.example_sentence,
                    "last_imported_at": now,
                    "version": Word.version + 1,
                },
            ).returning(Word.id)
            result = await db.execute(stmt)
            word_id = result.scalar_one()
        else:
            existing = await find_existing_word(db, source_key=None, lemma=lemma, pos=pos)
            if existing is None:
                word = Word(
                    source_key=None,
                    lemma=lemma,
                    translation=translation,
                    pos=pos,
                    difficulty_level=item.difficulty_level,
                    frequency=item.frequency,
                    example_sentence=item.example_sentence,
                    last_imported_at=now,
                )
                db.add(word)
                await db.flush()
                word_id = word.id
            else:
                existing.translation = translation
                existing.difficulty_level = item.difficulty_level
                existing.frequency = item.frequency
                existing.example_sentence = item.example_sentence
                existing.last_imported_at = now
                existing.version += 1
                word_id = existing.id

        await db.execute(WordCategory.__table__.delete().where(WordCategory.word_id == word_id))
        await db.execute(WordTag.__table__.delete().where(WordTag.word_id == word_id))

        for idx, category_name in enumerate(item.categories):
            category = await ensure_category(db, category_name)
            db.add(WordCategory(word_id=word_id, category_id=category.id, is_primary=(idx == 0)))

        for tag_name in item.tags:
            tag = await ensure_tag(db, tag_name)
            db.add(WordTag(word_id=word_id, tag_id=tag.id))

    log = ImportLog(
        user_id=user_id,
        filename=filename,
        status="completed",
        diff_summary=diff.model_dump(mode="json"),
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log

