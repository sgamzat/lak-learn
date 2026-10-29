-- ============================================================
-- Миграция 013: лексемы, источники и учебный план
--
-- Модель:
--   lexemes        — лакское слово (одна строка на lemma_key)
--   words          — значение: лакское слово + перевод (как и раньше);
--                    words.lexeme_id связывает значения одного слова
--   sources        — источники (разговорник Дигиева, словарь 1958, вручную)
--   word_sources   — откуда взята запись и где именно (глава, буква)
--   words.study_rank — место в учебном плане (NULL = только справочник)
--
-- Учебный план пересчитывает refresh_lexicon(): в конце этой миграции
-- и после сидов (db/migrate.sh). Правила — в комментарии к функции.
-- ============================================================

-- ── Источники ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sources (
  id         SMALLSERIAL PRIMARY KEY,
  code       VARCHAR(32) UNIQUE NOT NULL,
  title      TEXT NOT NULL,
  author     TEXT,
  year       SMALLINT,
  url        TEXT,
  kind       VARCHAR(16) NOT NULL CHECK (kind IN ('phrasebook', 'dictionary', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO sources (code, title, author, year, url, kind) VALUES
  ('digiev', 'Русско-лакский разговорник', 'Л. А. Дигиев', 2004,
   'https://lakkumaz.narod.ru/russko-lakskiy_razgovornik_digiev.html', 'phrasebook'),
  ('slovar_1958', 'Русско-лакский школьный словарь', 'Г. М. Гаджиев', 1958,
   'https://lakkumaz.narod.ru/orus_mazral_va_lakku_mazral_shkolalul_slovar.html', 'dictionary'),
  ('manual', 'Добавлено вручную', NULL, NULL, NULL, 'manual')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS word_sources (
  word_id   BIGINT   NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  source_id SMALLINT NOT NULL REFERENCES sources(id),
  -- Где в источнике: «гл. 92 · Глаголы», «буква А»
  locator   TEXT     NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (word_id, source_id, locator)
);

CREATE INDEX IF NOT EXISTS idx_word_sources_source ON word_sources (source_id);

-- ── Лексемы ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lexemes (
  id         BIGSERIAL PRIMARY KEY,
  lemma      TEXT NOT NULL,          -- как показывать (каноническая запись, Ӏ)
  lemma_key  TEXT NOT NULL UNIQUE,   -- lak_search_key(lemma)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE words
  ADD COLUMN IF NOT EXISTS lexeme_id   BIGINT REFERENCES lexemes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS study_rank  INTEGER,
  -- «абажур → абажур»: заимствование, совпадающее с русским — в план не входит
  ADD COLUMN IF NOT EXISTS is_loanword BOOLEAN GENERATED ALWAYS AS (lak_search_key(lemma) = lak_search_key(translation)) STORED;

COMMENT ON COLUMN words.lexeme_id   IS 'Лакское слово, к которому относится это значение';
COMMENT ON COLUMN words.study_rank  IS 'Место в учебном плане (1 — первым). NULL — только в справочнике. Пересчитывает refresh_lexicon()';
COMMENT ON COLUMN words.is_loanword IS 'Лакское слово совпадает с русским переводом (заимствование)';

CREATE INDEX IF NOT EXISTS idx_words_lexeme ON words (lexeme_id);
CREATE INDEX IF NOT EXISTS idx_words_study_rank ON words (study_rank) WHERE study_rank IS NOT NULL;

-- Любая запись в words (импорт, админка) получает лексему.
-- Имя триггера после words_lak_canonical (BEFORE-триггеры идут по алфавиту):
-- лемма к этому моменту уже канонизирована.
CREATE OR REPLACE FUNCTION words_lexeme_trg() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  k text := lak_search_key(NEW.lemma);
BEGIN
  IF k IS NULL OR k = '' THEN
    NEW.lexeme_id := NULL;
    RETURN NEW;
  END IF;
  INSERT INTO lexemes (lemma, lemma_key) VALUES (NEW.lemma, k)
  ON CONFLICT (lemma_key) DO NOTHING;
  SELECT id INTO NEW.lexeme_id FROM lexemes WHERE lemma_key = k;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS words_lexeme ON words;
CREATE TRIGGER words_lexeme
  BEFORE INSERT OR UPDATE OF lemma ON words
  FOR EACH ROW EXECUTE FUNCTION words_lexeme_trg();

-- Заполнение для уже загруженных слов (без триггера — одним запросом)
INSERT INTO lexemes (lemma, lemma_key)
SELECT DISTINCT ON (lemma_key) lemma, lemma_key
FROM words
WHERE lemma_key IS NOT NULL AND lemma_key <> ''
ORDER BY lemma_key, is_active DESC, id
ON CONFLICT (lemma_key) DO NOTHING;

UPDATE words w
SET lexeme_id = l.id
FROM lexemes l
WHERE l.lemma_key = w.lemma_key
  AND w.lexeme_id IS DISTINCT FROM l.id;

-- ── Учебный план ────────────────────────────────────────────────────────────

/*
 * refresh_lexicon() — пересчёт источников и учебного плана. Идемпотентна.
 *
 * 1. Источники записей выводятся из коллекций: digiev-NN-* → Дигиев, «гл. NN · Тема»;
 *    slovar-1958-* → словарь 1958, «буква X». Записи без источника — «вручную».
 *
 * 2. В учебный план (study_rank) попадают слова Дигиева: активные, тип «слово»,
 *    основное значение (translation_priority = 1), не заимствование.
 *    Одно значение на лексему — чтобы не учить одно слово несколько раз.
 *    Порядок:
 *      ступень 1 — тематические главы разговорника (1–90), местоимения (97),
 *                  числительные (98): слова для повседневного общения;
 *      ступень 2 — остальной «Краткий словарь» (91–96);
 *      внутри ступени — чаще встречающиеся во фразах разговорника раньше
 *      (замена частотному словарю: настоящего корпуса лакских текстов у нас нет),
 *      затем по номеру главы.
 *    Словарь 1958 — справочник: в план не входит (кроме слов, совпавших с Дигиевым).
 *
 * 3. Коллекция «Базовый курс» (course-basic) = слова учебного плана.
 */
CREATE OR REPLACE FUNCTION refresh_lexicon() RETURNS TABLE (ranked int, course_words int)
LANGUAGE plpgsql AS $$
DECLARE
  src_digiev   smallint := (SELECT id FROM sources WHERE code = 'digiev');
  src_1958     smallint := (SELECT id FROM sources WHERE code = 'slovar_1958');
  src_manual   smallint := (SELECT id FROM sources WHERE code = 'manual');
  course_id    bigint;
BEGIN
  -- 1. Источники
  INSERT INTO word_sources (word_id, source_id, locator)
  SELECT DISTINCT cw.word_id, src_digiev, 'гл. ' || c.sort_order || ' · ' || c.title
  FROM collection_words cw
  JOIN collections c ON c.id = cw.collection_id
  WHERE c.slug LIKE 'digiev-%' AND c.is_active AND NOT cw.is_excluded
  ON CONFLICT DO NOTHING;

  INSERT INTO word_sources (word_id, source_id, locator)
  SELECT DISTINCT cw.word_id, src_1958, 'буква ' || c.title
  FROM collection_words cw
  JOIN collections c ON c.id = cw.collection_id
  WHERE c.slug LIKE 'slovar-1958-%' AND NOT cw.is_excluded
  ON CONFLICT DO NOTHING;

  INSERT INTO word_sources (word_id, source_id, locator)
  SELECT w.id, src_manual, ''
  FROM words w
  WHERE NOT EXISTS (SELECT 1 FROM word_sources ws WHERE ws.word_id = w.id)
  ON CONFLICT DO NOTHING;

  -- 2. Учебный план
  CREATE TEMP TABLE IF NOT EXISTS tmp_rank (word_id bigint PRIMARY KEY, rank int) ON COMMIT DROP;
  TRUNCATE tmp_rank;

  INSERT INTO tmp_rank (word_id, rank)
  WITH phrase_tokens AS (
    -- Слова во фразах разговорника: «Ттун шаппай ачин чӏунни» → ттун, шаппай, ачин, чӏунни
    SELECT tok, COUNT(*)::int AS freq
    FROM words p
    JOIN collection_words pcw ON pcw.word_id = p.id
    JOIN collections pc ON pc.id = pcw.collection_id AND pc.slug LIKE 'digiev-%' AND pc.is_active
    CROSS JOIN LATERAL regexp_split_to_table(p.lemma_key, '[^а-яёӏ]+') AS tok
    WHERE p.is_active AND p.word_type = 'phrase' AND tok <> ''
    GROUP BY tok
  ),
  candidates AS (
    SELECT DISTINCT ON (w.lexeme_id)
      w.id,
      MIN(c.sort_order) OVER (PARTITION BY w.id) AS chapter
    FROM words w
    JOIN collection_words cw ON cw.word_id = w.id AND NOT cw.is_excluded
    JOIN collections c ON c.id = cw.collection_id AND c.slug LIKE 'digiev-%' AND c.is_active
    WHERE w.is_active
      AND w.word_type = 'word'
      AND w.translation_priority = 1
      AND NOT w.is_loanword
      AND w.lexeme_id IS NOT NULL
    ORDER BY w.lexeme_id, c.sort_order, w.id
  ),
  scored AS (
    SELECT
      cand.id,
      cand.chapter,
      CASE WHEN cand.chapter <= 90 OR cand.chapter IN (97, 98) THEN 1 ELSE 2 END AS tier,
      COALESCE(pt.freq, 0) AS freq
    FROM candidates cand
    JOIN words w ON w.id = cand.id
    LEFT JOIN phrase_tokens pt ON pt.tok = w.lemma_key
  )
  SELECT id, ROW_NUMBER() OVER (ORDER BY tier, freq DESC, chapter, id)::int
  FROM scored;

  UPDATE words w SET study_rank = NULL
  WHERE w.study_rank IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tmp_rank r WHERE r.word_id = w.id);

  UPDATE words w SET study_rank = r.rank
  FROM tmp_rank r
  WHERE w.id = r.word_id AND w.study_rank IS DISTINCT FROM r.rank;

  -- 3. «Базовый курс»
  INSERT INTO collections (slug, title, description, is_public, sort_order, kind, is_active)
  VALUES (
    'course-basic',
    'Базовый курс',
    'Слова для начала: из разговорника Дигиева, по порядку изучения — частые раньше',
    TRUE, -1, 'topic', TRUE
  )
  ON CONFLICT (slug) DO UPDATE SET is_active = TRUE, is_public = TRUE
  RETURNING id INTO course_id;

  DELETE FROM collection_words cw
  WHERE cw.collection_id = course_id
    AND NOT cw.is_excluded
    AND NOT EXISTS (SELECT 1 FROM tmp_rank r WHERE r.word_id = cw.word_id);

  INSERT INTO collection_words (collection_id, word_id, is_manual, is_excluded)
  SELECT course_id, r.word_id, TRUE, FALSE FROM tmp_rank r
  ON CONFLICT (collection_id, word_id) DO NOTHING;

  RETURN QUERY SELECT
    (SELECT COUNT(*)::int FROM tmp_rank),
    (SELECT COUNT(*)::int FROM collection_words WHERE collection_id = course_id AND NOT is_excluded);
END
$$;

SELECT * FROM refresh_lexicon();
