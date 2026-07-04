-- ============================================================
-- Миграция 007: группировка синонимов и приоритет перевода
-- Запускать после 006_words_enrich.sql
--
-- Что делаем:
--   + translation_priority — порядок показа (1 = основное, 2+ = синоним)
--   + synonym_group_id     — связывает слова с одним русским переводом
--
-- Логика:
--   SRS берёт только translation_priority = 1
--   На карточке показываем остальные слова группы как справку
-- ============================================================

-- ── Новые поля ───────────────────────────────────────────────────────────────

ALTER TABLE words
  -- Приоритет перевода внутри группы синонимов.
  -- 1 = основное слово (попадает в SRS-очередь)
  -- 2, 3, ... = синонимы (видны на карточке, не изучаются отдельно)
  ADD COLUMN IF NOT EXISTS translation_priority SMALLINT NOT NULL DEFAULT 1,

  -- Идентификатор группы синонимов.
  -- Формат: нижний регистр русского слова, например 'грязь', 'дом'.
  -- NULL = слово без синонимов (большинство слов).
  ADD COLUMN IF NOT EXISTS synonym_group_id VARCHAR(255);

-- ── Ограничения ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_translation_priority' AND conrelid = 'words'::regclass
  ) THEN
    ALTER TABLE words ADD CONSTRAINT chk_translation_priority
      CHECK (translation_priority >= 1);
  END IF;
END $$;

COMMENT ON COLUMN words.translation_priority IS
  '1 = основное слово (в SRS), 2+ = синоним (только справочно на карточке)';

COMMENT ON COLUMN words.synonym_group_id IS
  'Группа синонимов. Равен русскому переводу в нижнем регистре если у слова есть синонимы.';

-- ── Индексы ───────────────────────────────────────────────────────────────────

-- Для SRS-запроса: WHERE translation_priority = 1
CREATE INDEX IF NOT EXISTS idx_words_translation_priority
  ON words (translation_priority)
  WHERE translation_priority = 1;

-- Для подтягивания синонимов на карточке: WHERE synonym_group_id = $1
CREATE INDEX IF NOT EXISTS idx_words_synonym_group_id
  ON words (synonym_group_id)
  WHERE synonym_group_id IS NOT NULL;

-- ── Заполняем synonym_group_id и translation_priority для уже залитых слов ──
-- Находим все русские слова у которых больше одного лакского перевода
-- и проставляем им группу + приоритет по порядку id (первый = основное)

WITH duplicates AS (
  -- Русские слова с несколькими лакскими переводами
  SELECT
    LOWER(translation) AS group_id,
    COUNT(*)           AS cnt
  FROM words
  WHERE is_active = TRUE
  GROUP BY LOWER(translation)
  HAVING COUNT(*) > 1
),
ranked AS (
  -- Ранжируем лакские слова внутри каждой группы по id (первый = основной)
  SELECT
    w.id,
    LOWER(w.translation)                                    AS group_id,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(w.translation)
      ORDER BY w.id ASC
    )                                                       AS rn
  FROM words w
  JOIN duplicates d ON LOWER(w.translation) = d.group_id
  WHERE w.is_active = TRUE
)
UPDATE words w
SET
  synonym_group_id     = r.group_id,
  translation_priority = r.rn
FROM ranked r
WHERE w.id = r.id;

-- ── Проверка после миграции ───────────────────────────────────────────────────
-- Запусти вручную чтобы убедиться:
--
-- SELECT
--   translation_priority,
--   COUNT(*) AS cnt
-- FROM words
-- WHERE is_active = TRUE
-- GROUP BY translation_priority
-- ORDER BY translation_priority;
--
-- Ожидаемо: priority=1 — большинство слов, priority=2,3... — синонимы
--
-- Топ групп с наибольшим числом синонимов:
-- SELECT synonym_group_id, COUNT(*) AS cnt
-- FROM words
-- WHERE synonym_group_id IS NOT NULL AND is_active = TRUE
-- GROUP BY synonym_group_id
-- ORDER BY cnt DESC
-- LIMIT 10;