-- ============================================================
-- Миграция 014: примеры употребления из разговорника
--
-- word_examples получает источник и признак «добавлен автоматически».
-- refresh_lexicon() (миграция 013) дополняется шагом 4: к каждому слову
-- привязываются до трёх самых коротких фраз Дигиева, в которых оно встречается
-- как отдельное слово («ттул» → «Ттул ххирама», «Ттул цӀа ХӀасанни»…).
-- Автоматические примеры пересчитываются при каждом запуске; добавленные
-- вручную (is_auto = FALSE) не трогаются и показываются первыми.
-- ============================================================

ALTER TABLE word_examples
  ADD COLUMN IF NOT EXISTS source_id SMALLINT REFERENCES sources(id),
  ADD COLUMN IF NOT EXISTS is_auto BOOLEAN NOT NULL DEFAULT FALSE;

-- Один и тот же пример у слова — один раз (палочка уже канонизирована триггером 011)
DELETE FROM word_examples a
USING word_examples b
WHERE a.word_id = b.word_id AND a.sentence_src = b.sentence_src AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS word_examples_word_sentence_unique ON word_examples (word_id, sentence_src);

-- Сигнатура меняется (добавлен столбец examples) — пересоздаём
DROP FUNCTION IF EXISTS refresh_lexicon();

CREATE OR REPLACE FUNCTION refresh_lexicon() RETURNS TABLE (ranked int, course_words int, examples int)
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

  -- 4. Примеры: фразы разговорника, в которых встречается слово
  --    (основной вариант «лечлан» из «лечлан, лечин»; до 3 самых коротких фраз)
  DELETE FROM word_examples WHERE is_auto;

  -- Промежуточные результаты — во временных таблицах с индексами: в одном
  -- запросе с CTE планировщик перебирал все пары «фраза × слово» (минуты).
  CREATE TEMP TABLE IF NOT EXISTS tmp_ex_phrases (id bigint PRIMARY KEY, src text, tr text, padded text, len int) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS tmp_ex_tokens (phrase_id bigint, tok text) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS tmp_ex_targets (word_id bigint, base text, first_tok text) ON COMMIT DROP;
  TRUNCATE tmp_ex_phrases, tmp_ex_tokens, tmp_ex_targets;

  INSERT INTO tmp_ex_phrases (id, src, tr, padded, len)
  SELECT DISTINCT ON (p.id)
    p.id, p.lemma, p.translation,
    ' ' || btrim(regexp_replace(p.lemma_key, '[^а-яёӏ]+', ' ', 'g')) || ' ',
    char_length(p.lemma)
  FROM words p
  JOIN collection_words pcw ON pcw.word_id = p.id
  JOIN collections pc ON pc.id = pcw.collection_id AND pc.slug LIKE 'digiev-%' AND pc.is_active
  WHERE p.is_active AND p.word_type = 'phrase';

  INSERT INTO tmp_ex_tokens (phrase_id, tok)
  SELECT DISTINCT ph.id, tok
  FROM tmp_ex_phrases ph
  CROSS JOIN LATERAL regexp_split_to_table(btrim(ph.padded), ' ') AS tok
  WHERE tok <> '';

  INSERT INTO tmp_ex_targets (word_id, base, first_tok)
  SELECT id, base, split_part(base, ' ', 1)
  FROM (
    SELECT w.id,
      btrim(regexp_replace(regexp_replace(w.lemma_key, '\s*[(,;].*$', ''), '[^а-яёӏ]+', ' ', 'g')) AS base
    FROM words w
    WHERE w.is_active AND w.word_type = 'word' AND NOT w.is_loanword
  ) t
  WHERE char_length(base) >= 2;

  CREATE INDEX IF NOT EXISTS tmp_ex_tokens_tok ON tmp_ex_tokens (tok);
  CREATE INDEX IF NOT EXISTS tmp_ex_targets_tok ON tmp_ex_targets (first_tok);
  ANALYZE tmp_ex_phrases;
  ANALYZE tmp_ex_tokens;
  ANALYZE tmp_ex_targets;

  INSERT INTO word_examples (word_id, sentence_src, sentence_translation, source_id, is_auto)
  SELECT word_id, src, tr, src_digiev, TRUE
  FROM (
    SELECT m.*, ROW_NUMBER() OVER (PARTITION BY m.word_id ORDER BY m.len, m.src) AS rn
    FROM (
      SELECT DISTINCT ON (t.word_id, ph.src) t.word_id, ph.src, ph.tr, ph.len
      FROM tmp_ex_targets t
      JOIN tmp_ex_tokens tk ON tk.tok = t.first_tok
      JOIN tmp_ex_phrases ph ON ph.id = tk.phrase_id
      WHERE ph.padded LIKE '% ' || t.base || ' %'
        AND btrim(ph.padded) <> t.base
    ) m
  ) ranked
  WHERE rn <= 3
  ON CONFLICT (word_id, sentence_src) DO NOTHING;

  RETURN QUERY SELECT
    (SELECT COUNT(*)::int FROM tmp_rank),
    (SELECT COUNT(*)::int FROM collection_words WHERE collection_id = course_id AND NOT is_excluded),
    (SELECT COUNT(*)::int FROM word_examples WHERE is_auto);
END
$$;


SELECT * FROM refresh_lexicon();
