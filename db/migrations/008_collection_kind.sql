-- ============================================================
-- Миграция 008: тип набора (kind) для коллекций
-- Запускать после 007_word_synonyms.sql
--
-- Зачем: виджет «Прогресс по темам» на дашборде должен показывать
-- только тематические разговорники, а не алфавит (у него отдельная
-- страница /letters и своя механика прохождения).
-- ============================================================

ALTER TABLE collections
  -- 'topic'    — тематический набор/разговорник, попадает в дашборд
  -- 'alphabet' — набор про алфавит, не показывается в «Прогресс по темам»
  ADD COLUMN IF NOT EXISTS kind VARCHAR(16) NOT NULL DEFAULT 'topic';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_collection_kind' AND conrelid = 'collections'::regclass
  ) THEN
    ALTER TABLE collections ADD CONSTRAINT chk_collection_kind
      CHECK (kind IN ('topic', 'alphabet'));
  END IF;
END $$;

COMMENT ON COLUMN collections.kind IS
  'Тип набора: topic — тематический разговорник (виден в «Прогресс по темам»), alphabet — набор про алфавит.';

CREATE INDEX IF NOT EXISTS idx_collections_kind
  ON collections (kind);

-- ── Best-effort проставление kind='alphabet' для уже существующих наборов ────
-- Ищем по slug/title характерные признаки алфавита. Список неполный —
-- после миграции стоит проверить руками через админку и поправить kind
-- у наборов, которые не попали под шаблон (или наоборот, попали зря).

UPDATE collections
SET kind = 'alphabet'
WHERE kind = 'topic'
  AND (
    LOWER(slug) LIKE '%alfavit%'
    OR LOWER(slug) LIKE '%alphabet%'
    OR LOWER(slug) LIKE '%letter%'
    OR LOWER(slug) LIKE '%bukv%'
    OR LOWER(title) LIKE '%алфавит%'
    OR LOWER(title) LIKE '%букв%'
  );

-- ── Проверка после миграции ───────────────────────────────────────────────────
-- SELECT id, slug, title, kind FROM collections ORDER BY kind, id;
