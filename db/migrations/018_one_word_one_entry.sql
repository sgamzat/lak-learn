-- ============================================================
-- Миграция 018: одно лакское слово — одна запись
--
-- Раньше единицей была пара «слово — перевод»: «къатта» приходила из словаря
-- 1958 г. пятнадцатью записями (дом, очаг, чехол, сакля…), «кьини — день» —
-- тремя карточками из разных источников. Теперь:
--
--   • лексема (lexemes) — лакское слово; омонимы с разным классом — разные
--     лексемы: «цӀу» III — огонь, «цӀу» II — соль (lexemes.homonym);
--   • варианты написания одного слова (lexeme_variants): «цӀву» → «цӀу» (соль);
--   • у каждой лексемы одно главное значение (words.is_primary,
--     lexemes.primary_word_id). Оно выбирается по источнику:
--       урок → учебник «Лакку дуниял» → разговорник Дигиева → вручную → словарь 1958,
--     затем не заимствование, затем порядок значения в источнике, короче перевод;
--   • в повторение, в счётчики тем и в словарь идёт только главное значение;
--     остальные — «ещё значения». Слово входит в тему, если в неё входит любое
--     его значение (src/lib/server/membership.ts);
--   • карточки повторения и выбор «учить» переносятся на главное значение
--     (при слиянии сохраняется лучший прогресс).
--
-- Всё пересчитывает refresh_lexemes() — db/migrate.sh вызывает её после сидов,
-- перед refresh_lexicon().
-- ============================================================

-- ── Лексемы: омонимы и класс ────────────────────────────────────────────────

ALTER TABLE lexemes
  ADD COLUMN IF NOT EXISTS homonym SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lak_class SMALLINT,
  ADD COLUMN IF NOT EXISTS primary_word_id BIGINT REFERENCES words(id) ON DELETE SET NULL;

ALTER TABLE lexemes DROP CONSTRAINT IF EXISTS lexemes_lemma_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS lexemes_key_homonym ON lexemes (lemma_key, homonym);

COMMENT ON COLUMN lexemes.homonym IS '0 — основное слово с этим написанием; 1, 2… — омонимы с другим классом';
COMMENT ON COLUMN lexemes.primary_word_id IS 'Главное значение слова (пересчитывает refresh_lexemes)';

-- ── Варианты написания ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lexeme_variants (
  -- Ключ варианта (lak_search_key): «цӏву»
  variant_key TEXT PRIMARY KEY,
  -- Ключ основного написания: «цӏу»
  lemma_key   TEXT NOT NULL,
  -- Класс, если у основного написания есть омонимы: соль — II
  lak_class   SMALLINT,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO lexeme_variants (variant_key, lemma_key, lak_class, note) VALUES
  (lak_search_key('цӀву'), lak_search_key('цӀу'), 2, 'соль: «цӀву» у Дигиева, «цӀу» в учебнике и словаре 1958')
ON CONFLICT (variant_key) DO NOTHING;

-- ── Главное значение ────────────────────────────────────────────────────────

ALTER TABLE words ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_words_primary ON words (lexeme_id) WHERE is_primary;
COMMENT ON COLUMN words.is_primary IS 'Главное значение лакского слова — то, что учится и показывается в словаре';

-- Новая запись (админка, импорт) получает лексему по написанию и, если у
-- лексемы ещё нет главного значения, становится им. Точный выбор — refresh_lexemes().
CREATE OR REPLACE FUNCTION words_lexeme_trg() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  k text := lak_search_key(NEW.lemma);
  target_key text;
  target_class smallint;
BEGIN
  IF k IS NULL OR k = '' THEN
    NEW.lexeme_id := NULL;
    RETURN NEW;
  END IF;

  SELECT v.lemma_key, v.lak_class INTO target_key, target_class FROM lexeme_variants v WHERE v.variant_key = k;
  target_key := COALESCE(target_key, k);
  target_class := COALESCE(target_class, NEW.lak_class);

  SELECT id INTO NEW.lexeme_id FROM lexemes
  WHERE lemma_key = target_key
  ORDER BY (lak_class IS NOT DISTINCT FROM target_class) DESC, homonym
  LIMIT 1;

  IF NEW.lexeme_id IS NULL THEN
    INSERT INTO lexemes (lemma, lemma_key, homonym) VALUES (NEW.lemma, target_key, 0)
    ON CONFLICT (lemma_key, homonym) DO NOTHING;
    SELECT id INTO NEW.lexeme_id FROM lexemes WHERE lemma_key = target_key AND homonym = 0;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_primary := NOT EXISTS (SELECT 1 FROM words w WHERE w.lexeme_id = NEW.lexeme_id AND w.is_primary);
  END IF;
  RETURN NEW;
END
$$;

-- ── Пересчёт ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION refresh_lexemes()
RETURNS TABLE (n_lexemes int, n_homonyms int, n_primary int, n_merged_cards int)
LANGUAGE plpgsql AS $$
DECLARE
  src_ld smallint := (SELECT id FROM sources WHERE code = 'lakku_dunial');
  n_merged int := 0;
BEGIN
  -- 1. Ранг каждой записи: откуда она и насколько надёжна
  CREATE TEMP TABLE IF NOT EXISTS tmp_wr (
    word_id bigint PRIMARY KEY, eff_key text, eff_class smallint, word_type text, rank int
  ) ON COMMIT DROP;
  TRUNCATE tmp_wr;

  INSERT INTO tmp_wr (word_id, eff_key, eff_class, word_type, rank)
  SELECT
    w.id,
    COALESCE(v.lemma_key, w.lemma_key),
    COALESCE(v.lak_class, w.lak_class),
    w.word_type,
    CASE
      WHEN EXISTS (SELECT 1 FROM collection_words cw JOIN collections c ON c.id = cw.collection_id
                   WHERE cw.word_id = w.id AND NOT cw.is_excluded AND c.slug LIKE 'lesson-%') THEN 0
      WHEN EXISTS (SELECT 1 FROM word_sources ws WHERE ws.word_id = w.id AND ws.source_id = src_ld) THEN 1
      WHEN EXISTS (SELECT 1 FROM collection_words cw JOIN collections c ON c.id = cw.collection_id
                   WHERE cw.word_id = w.id AND NOT cw.is_excluded AND c.slug LIKE 'digiev-%') THEN 2
      WHEN EXISTS (SELECT 1 FROM collection_words cw JOIN collections c ON c.id = cw.collection_id
                   WHERE cw.word_id = w.id AND NOT cw.is_excluded AND c.slug LIKE 'slovar-1958-%') THEN 4
      ELSE 3
    END
  FROM words w
  LEFT JOIN lexeme_variants v ON v.variant_key = w.lemma_key
  WHERE w.lemma_key IS NOT NULL AND w.lemma_key <> '';

  -- 2. Омонимы: у одного написания несколько классов (по активным словам).
  --    Класс самого надёжного значения — основной (homonym 0), остальные — 1, 2…
  CREATE TEMP TABLE IF NOT EXISTS tmp_hom (eff_key text, lak_class smallint, homonym smallint) ON COMMIT DROP;
  TRUNCATE tmp_hom;

  INSERT INTO tmp_hom (eff_key, lak_class, homonym)
  SELECT eff_key, eff_class, (ROW_NUMBER() OVER (PARTITION BY eff_key ORDER BY best_rank, n DESC, eff_class) - 1)::smallint
  FROM (
    SELECT r.eff_key, r.eff_class, MIN(r.rank) AS best_rank, COUNT(*) AS n
    FROM tmp_wr r JOIN words w ON w.id = r.word_id
    WHERE w.is_active AND r.word_type = 'word' AND r.eff_class IS NOT NULL
    GROUP BY 1, 2
  ) c
  WHERE c.eff_key IN (
    SELECT r.eff_key FROM tmp_wr r JOIN words w ON w.id = r.word_id
    WHERE w.is_active AND r.word_type = 'word' AND r.eff_class IS NOT NULL
    GROUP BY 1 HAVING COUNT(DISTINCT r.eff_class) > 1
  );

  -- 3. Лексема каждой записи
  CREATE TEMP TABLE IF NOT EXISTS tmp_wl (word_id bigint PRIMARY KEY, eff_key text, homonym smallint) ON COMMIT DROP;
  TRUNCATE tmp_wl;

  INSERT INTO tmp_wl (word_id, eff_key, homonym)
  SELECT r.word_id, r.eff_key, COALESCE(h.homonym, 0)
  FROM tmp_wr r
  LEFT JOIN tmp_hom h ON h.eff_key = r.eff_key AND h.lak_class = r.eff_class AND r.word_type = 'word';

  INSERT INTO lexemes (lemma, lemma_key, homonym)
  SELECT DISTINCT ON (l.eff_key, l.homonym) w.lemma, l.eff_key, l.homonym
  FROM tmp_wl l JOIN words w ON w.id = l.word_id
  ORDER BY l.eff_key, l.homonym, w.is_active DESC, w.id
  ON CONFLICT (lemma_key, homonym) DO NOTHING;

  UPDATE words w
  SET lexeme_id = lx.id
  FROM tmp_wl l
  JOIN lexemes lx ON lx.lemma_key = l.eff_key AND lx.homonym = l.homonym
  WHERE w.id = l.word_id AND w.lexeme_id IS DISTINCT FROM lx.id;

  -- 4. Главное значение: активное, по рангу источника
  CREATE TEMP TABLE IF NOT EXISTS tmp_primary (lexeme_id bigint PRIMARY KEY, word_id bigint) ON COMMIT DROP;
  TRUNCATE tmp_primary;

  INSERT INTO tmp_primary (lexeme_id, word_id)
  SELECT DISTINCT ON (w.lexeme_id) w.lexeme_id, w.id
  FROM words w
  JOIN tmp_wr r ON r.word_id = w.id
  WHERE w.is_active AND w.lexeme_id IS NOT NULL
  ORDER BY w.lexeme_id, r.rank, w.is_loanword, w.translation_priority,
           (w.lemma_key = r.eff_key) DESC,       -- основное написание, не вариант
           char_length(w.translation), w.id;

  UPDATE words w SET is_primary = FALSE
  WHERE w.is_primary AND NOT EXISTS (SELECT 1 FROM tmp_primary p WHERE p.word_id = w.id);
  UPDATE words w SET is_primary = TRUE
  FROM tmp_primary p WHERE p.word_id = w.id AND NOT w.is_primary;

  UPDATE lexemes lx
  SET primary_word_id = p.word_id,
      lemma = w.lemma,
      lak_class = w.lak_class
  FROM tmp_primary p JOIN words w ON w.id = p.word_id
  WHERE lx.id = p.lexeme_id
    AND (lx.primary_word_id IS DISTINCT FROM p.word_id OR lx.lemma IS DISTINCT FROM w.lemma
         OR lx.lak_class IS DISTINCT FROM w.lak_class);

  UPDATE lexemes lx SET primary_word_id = NULL
  WHERE lx.primary_word_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tmp_primary p WHERE p.lexeme_id = lx.id);

  -- 5. Карточки повторения — на главное значение. Из нескольких карточек одного
  --    слова берётся самая продвинутая (интервал, повторы); ответы суммируются.
  CREATE TEMP TABLE IF NOT EXISTS tmp_cards ON COMMIT DROP AS
  SELECT c.*, lx.primary_word_id AS pid
  FROM user_srs_cards c
  JOIN words w ON w.id = c.word_id
  JOIN lexemes lx ON lx.id = w.lexeme_id
  WHERE false;
  TRUNCATE tmp_cards;

  INSERT INTO tmp_cards
  SELECT c.*, lx.primary_word_id
  FROM user_srs_cards c
  JOIN words w ON w.id = c.word_id
  JOIN lexemes lx ON lx.id = w.lexeme_id
  WHERE lx.primary_word_id IS NOT NULL
    AND (c.user_id, lx.primary_word_id) IN (
      SELECT c2.user_id, lx2.primary_word_id
      FROM user_srs_cards c2
      JOIN words w2 ON w2.id = c2.word_id
      JOIN lexemes lx2 ON lx2.id = w2.lexeme_id
      WHERE lx2.primary_word_id IS NOT NULL AND c2.word_id <> lx2.primary_word_id
    );

  INSERT INTO user_srs_cards (user_id, word_id, easiness_factor, repetition, interval_days, due_at,
                              last_reviewed_at, lapses, total_reviews, created_at, updated_at)
  SELECT b.user_id, b.pid, b.easiness_factor, b.repetition, b.interval_days, b.due_at,
         s.last_reviewed_at, s.lapses, s.total_reviews, s.created_at, NOW()
  FROM (
    SELECT DISTINCT ON (user_id, pid) *
    FROM tmp_cards
    ORDER BY user_id, pid, interval_days DESC, repetition DESC, last_reviewed_at DESC NULLS LAST
  ) b
  JOIN (
    SELECT user_id, pid, MAX(last_reviewed_at) AS last_reviewed_at,
           SUM(lapses)::int AS lapses, SUM(total_reviews)::int AS total_reviews, MIN(created_at) AS created_at
    FROM tmp_cards GROUP BY 1, 2
  ) s ON s.user_id = b.user_id AND s.pid = b.pid
  ON CONFLICT (user_id, word_id) DO UPDATE SET
    easiness_factor  = EXCLUDED.easiness_factor,
    repetition       = EXCLUDED.repetition,
    interval_days    = EXCLUDED.interval_days,
    due_at           = EXCLUDED.due_at,
    last_reviewed_at = EXCLUDED.last_reviewed_at,
    lapses           = EXCLUDED.lapses,
    total_reviews    = EXCLUDED.total_reviews,
    created_at       = EXCLUDED.created_at,
    updated_at       = NOW();

  DELETE FROM user_srs_cards c
  USING tmp_cards t
  WHERE c.user_id = t.user_id AND c.word_id = t.word_id AND t.word_id <> t.pid;
  GET DIAGNOSTICS n_merged = ROW_COUNT;

  -- 6. «Учить это слово» — тоже на главное значение
  INSERT INTO user_study_words (user_id, word_id, created_at)
  SELECT usw.user_id, lx.primary_word_id, MIN(usw.created_at)
  FROM user_study_words usw
  JOIN words w ON w.id = usw.word_id
  JOIN lexemes lx ON lx.id = w.lexeme_id
  WHERE lx.primary_word_id IS NOT NULL AND usw.word_id <> lx.primary_word_id
  GROUP BY 1, 2
  ON CONFLICT DO NOTHING;

  DELETE FROM user_study_words usw
  USING words w, lexemes lx
  WHERE w.id = usw.word_id AND lx.id = w.lexeme_id
    AND lx.primary_word_id IS NOT NULL AND usw.word_id <> lx.primary_word_id;

  -- 7. Лексемы без записей
  DELETE FROM lexemes lx WHERE NOT EXISTS (SELECT 1 FROM words w WHERE w.lexeme_id = lx.id);

  RETURN QUERY SELECT
    (SELECT COUNT(*)::int FROM lexemes),
    (SELECT COUNT(*)::int FROM lexemes WHERE homonym > 0),
    (SELECT COUNT(*)::int FROM words WHERE is_primary),
    n_merged;
END
$$;

SELECT * FROM refresh_lexemes();
