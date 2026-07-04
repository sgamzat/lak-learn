-- ============================================================
-- Миграция 006: обогащение таблицы words
-- Запускать после 005_expand_word_text_columns.sql
--
-- Что делаем:
--   + gender       — грамматический род (м / ж / ср)
--   + verb_aspect  — вид глагола (сов. / несов. / однокр.)
--   + word_type    — тип записи (word / phrase)
--   + notes        — редакторская пометка (устар., разг., диалект и т.д.)
--   + image_url    — иллюстрация к слову (на будущее, пока null)
--   - level        — убираем (CEFR не применима к лакскому)
-- ============================================================

-- ── Новые поля ───────────────────────────────────────────────────────────────

ALTER TABLE words
  -- Грамматический род. Только для существительных.
  -- Допустимые значения: 'м', 'ж', 'ср', NULL
  ADD COLUMN IF NOT EXISTS gender VARCHAR(4),

  -- Вид глагола. Только для глаголов.
  -- Допустимые значения: 'сов.', 'несов.', 'однокр.', NULL
  ADD COLUMN IF NOT EXISTS verb_aspect VARCHAR(8),

  -- Тип записи: слово из словаря или фраза из разговорника.
  -- Допустимые значения: 'word', 'phrase'
  -- DEFAULT 'word' — все существующие записи считаются словами
  ADD COLUMN IF NOT EXISTS word_type VARCHAR(8) NOT NULL DEFAULT 'word',

  -- Редакторская пометка в свободной форме.
  -- Примеры: 'устар.', 'разг.', 'в горных диалектах также «баьс»',
  --          'заимствование из арабского'
  ADD COLUMN IF NOT EXISTS notes TEXT,

  -- Ссылка на иллюстрацию. CDN-путь или полный URL.
  -- Пока null для всех слов, заполняется вручную позднее.
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ── Удаляем level ────────────────────────────────────────────────────────────
-- CEFR-шкала (A1/A2/B1...) разработана для европейских языков.
-- Для лакского языка такой классификации не существует.

ALTER TABLE words
  DROP COLUMN IF EXISTS level;

-- ── Ограничения (CHECK) ───────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_gender' AND conrelid = 'words'::regclass
  ) THEN
    ALTER TABLE words ADD CONSTRAINT chk_gender
      CHECK (gender IN ('м', 'ж', 'ср') OR gender IS NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_verb_aspect' AND conrelid = 'words'::regclass
  ) THEN
    ALTER TABLE words ADD CONSTRAINT chk_verb_aspect
      CHECK (verb_aspect IN ('сов.', 'несов.', 'однокр.') OR verb_aspect IS NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_word_type' AND conrelid = 'words'::regclass
  ) THEN
    ALTER TABLE words ADD CONSTRAINT chk_word_type
      CHECK (word_type IN ('word', 'phrase'));
  END IF;
END $$;

-- ── Бизнес-правило: род только у существительных ─────────────────────────────
-- Мягкое ограничение через CHECK. Позволяет задать род только если
-- part_of_speech содержит 'Сущ.' или null (для гибкости при импорте).
-- Комментарий вместо жёсткого constraint — данные из словаря 1958 могут
-- иметь нестандартные значения part_of_speech при первичном импорте.

COMMENT ON COLUMN words.gender IS
  'Грамматический род: м / ж / ср. Заполняется только для существительных.';

COMMENT ON COLUMN words.verb_aspect IS
  'Вид глагола: сов. / несов. / однокр. Заполняется только для глаголов.';

COMMENT ON COLUMN words.word_type IS
  'Тип записи: word — слово из словаря, phrase — фраза из разговорника.';

COMMENT ON COLUMN words.notes IS
  'Редакторская пометка: устар., разг., диалект, этимология и т.д.';

COMMENT ON COLUMN words.image_url IS
  'CDN-путь или URL иллюстрации к слову. Пока не используется.';

-- ── Индексы ───────────────────────────────────────────────────────────────────

-- Фильтрация по типу записи (слово vs фраза) — частый запрос
CREATE INDEX IF NOT EXISTS idx_words_word_type
  ON words (word_type);

-- Фильтрация по роду — нужна для упражнений "все существительные ж.р."
CREATE INDEX IF NOT EXISTS idx_words_gender
  ON words (gender)
  WHERE gender IS NOT NULL;

-- Фильтрация по виду глагола
CREATE INDEX IF NOT EXISTS idx_words_verb_aspect
  ON words (verb_aspect)
  WHERE verb_aspect IS NOT NULL;

-- ── Проставляем word_type для уже существующих данных ────────────────────────
-- Все записи из разговорника имеют collectionType = 'phrasebook'
-- в таблице collections. Обновляем через JOIN.
UPDATE words w
SET word_type = 'phrase'
FROM collection_words cw
JOIN collections c ON c.id = cw.collection_id
WHERE cw.word_id = w.id
  AND c.is_active = TRUE
  AND (
    -- Тип коллекции phrasebook ИЛИ slug содержит разговорник
    LOWER(c.slug) LIKE '%razgovornik%'
    OR LOWER(c.slug) LIKE '%phrasebook%'
    OR LOWER(c.title) LIKE '%разговорник%'
  );

-- ── Итоговая статистика (для проверки после миграции) ────────────────────────
-- Запусти вручную после миграции чтобы убедиться что всё ок:
--
-- SELECT
--   word_type,
--   COUNT(*) AS total,
--   COUNT(gender)      FILTER (WHERE gender IS NOT NULL)      AS with_gender,
--   COUNT(verb_aspect) FILTER (WHERE verb_aspect IS NOT NULL) AS with_aspect,
--   COUNT(notes)       FILTER (WHERE notes IS NOT NULL)       AS with_notes
-- FROM words
-- WHERE is_active = TRUE
-- GROUP BY word_type
-- ORDER BY word_type;