-- ============================================================
-- Миграция 011: лакский алфавит и палочка (Ӏ) на уровне БД
--
-- Те же правила реализованы в TypeScript (src/lib/lak/alphabet.ts,
-- src/lib/import/junk.ts). Меняя здесь — меняйте и там.
--
-- Что делаем:
--   1. Функции: lak_canonical, lak_search_key, lak_letters,
--      lak_first_letter, lak_sort_key, lak_is_junk_entry
--   2. Триггер: любая запись в words (импорт, админка) приводит палочку к Ӏ
--   3. Вычисляемые колонки words.lemma_key / first_letter / sort_key + индексы
--   4. Нормализация уже загруженных слов и примеров
--   5. Отключение (is_active = FALSE) ошибочных записей парсера
--
-- Если функции изменятся — пересчитать вычисляемые колонки:
--   UPDATE words SET lemma = lemma;
-- ============================================================

-- ── 1. Функции ──────────────────────────────────────────────────────────────

-- Палочка: I, l, 1, |, І, і, ӏ, Ӏ сразу после кириллической буквы → Ӏ (U+04C0).
-- Отдельно стоящие числа («1000 ват») не меняются.
CREATE OR REPLACE FUNCTION lak_canonical(t text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$
  SELECT regexp_replace(normalize(t, NFC), '([А-Яа-яЁё])[Il1|ІіӏӀ]', '\1Ӏ', 'g')
$$;

-- Ключ поиска: канон, без ударений, нижний регистр (палочка → ӏ U+04CF),
-- пробелы схлопнуты. Кириллица опускается явно через translate, чтобы не
-- зависеть от локали сервера.
CREATE OR REPLACE FUNCTION lak_search_key(t text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$
  SELECT btrim(regexp_replace(
    lower(translate(
      normalize(regexp_replace(normalize(lak_canonical(t), NFD), '[\u0300\u0301\u0341]', '', 'g'), NFC),
      'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯӀ',
      'абвгдеёжзийклмнопрстуфхцчшщъыьэюяӏ'
    )),
    '\s+', ' ', 'g'
  ))
$$;

-- Алфавит в порядке словаря (как LAK_ALPHABET в alphabet.ts)
CREATE OR REPLACE FUNCTION lak_alphabet() RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT ARRAY[
    'а','аь','б','в','г','гъ','гь','д','е','ё','ж','з','и','й',
    'к','кк','къ','кь','кӏ','л','м','н','о','оь','п','пп','пӏ','р',
    'с','сс','т','тт','тӏ','у','ф','х','хх','хъ','хь','хьхь','хӏ',
    'ц','цц','цӏ','ч','чч','чӏ','ш','щ','ъ','ы','ь','э','ю','я'
  ]::text[]
$$;

-- Разбиение на буквы, самое длинное совпадение первым (хьхь → хь → х).
-- Буквы алфавита бывают длиной 1, 2 и 4 символа.
CREATE OR REPLACE FUNCTION lak_letters(t text) RETURNS text[]
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE STRICT AS $$
DECLARE
  k text := lak_search_key(t);
  n int := char_length(k);
  i int := 1;
  abc text[] := lak_alphabet();
  res text[] := '{}';
BEGIN
  WHILE i <= n LOOP
    IF substr(k, i, 4) = ANY (abc) AND char_length(substr(k, i, 4)) = 4 THEN
      res := res || substr(k, i, 4); i := i + 4;
    ELSIF substr(k, i, 2) = ANY (abc) AND char_length(substr(k, i, 2)) = 2 THEN
      res := res || substr(k, i, 2); i := i + 2;
    ELSE
      res := res || substr(k, i, 1); i := i + 1;
    END IF;
  END LOOP;
  RETURN res;
END
$$;

CREATE OR REPLACE FUNCTION lak_first_letter(t text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$
  SELECT CASE WHEN l = ANY (lak_alphabet()) THEN l END
  FROM (SELECT (lak_letters(t))[1] AS l) s
$$;

-- Ключ сортировки: пробел = 0, буквы = 1..N, прочее = 1000 + код символа
CREATE OR REPLACE FUNCTION lak_sort_key(t text) RETURNS int[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$
  SELECT COALESCE(array_agg(
    CASE
      WHEN p = ' ' THEN 0
      WHEN array_position(lak_alphabet(), p) IS NOT NULL THEN array_position(lak_alphabet(), p)
      ELSE 1000 + ascii(p)
    END ORDER BY ord
  ), '{}')
  FROM unnest(lak_letters(t)) WITH ORDINALITY AS u(p, ord)
$$;

-- Ошибочные записи парсера словаря 1958 (как isJunkEntry в junk.ts)
CREATE OR REPLACE FUNCTION lak_is_junk_entry(lemma text, translation text) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT
    btrim(COALESCE(lemma, '')) = ''
    OR btrim(COALESCE(translation, '')) = ''
    OR rtrim(lower(btrim(lemma)), '.') IN (
      'союз','частица','предлог','межд','междометие','нареч','прил',
      'сущ','глаг','мест','местоим','числ'
    )
    OR btrim(lemma) ~* '^[0-9]*\s*(несов|сов|мн|ед|разг|перен|м|ж|ср|прил|сущ|глаг|нареч|союз|местоим|мест|числ|частица|предлог|межд)\.?$'
    OR btrim(lemma) ~* '\s(несов|сов)\.?$'
    OR btrim(lemma) ~ '^[0-9]+\s*\)'
    OR (char_length(btrim(translation)) = 1
        AND lower(btrim(translation)) NOT IN ('а','б','в','ж','и','к','о','с','у','я'))
$$;

-- ── 2. Триггер: палочка нормализуется при любой записи ─────────────────────

CREATE OR REPLACE FUNCTION words_lak_canonical_trg() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.lemma := lak_canonical(NEW.lemma);
  NEW.notes := lak_canonical(NEW.notes);
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS words_lak_canonical ON words;
CREATE TRIGGER words_lak_canonical
  BEFORE INSERT OR UPDATE OF lemma, notes ON words
  FOR EACH ROW EXECUTE FUNCTION words_lak_canonical_trg();

CREATE OR REPLACE FUNCTION word_examples_lak_canonical_trg() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.sentence_src := lak_canonical(NEW.sentence_src);
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS word_examples_lak_canonical ON word_examples;
CREATE TRIGGER word_examples_lak_canonical
  BEFORE INSERT OR UPDATE OF sentence_src ON word_examples
  FOR EACH ROW EXECUTE FUNCTION word_examples_lak_canonical_trg();

-- ── 3. Нормализация существующих данных ────────────────────────────────────
-- До добавления вычисляемых колонок, чтобы не пересчитывать их дважды.
-- Если нормализованная пара (lemma, translation) уже есть — строку не трогаем
-- (иначе нарушится уникальный индекс) и сообщаем об этом.

DO $$
DECLARE
  collisions int;
BEGIN
  SELECT COUNT(*) INTO collisions
  FROM words w
  WHERE w.lemma IS DISTINCT FROM lak_canonical(w.lemma)
    AND EXISTS (
      SELECT 1 FROM words o
      WHERE o.id <> w.id AND o.lemma = lak_canonical(w.lemma) AND o.translation = w.translation
    );

  IF collisions > 0 THEN
    RAISE NOTICE 'lak: % слов не нормализованы — уже есть такая же пара с Ӏ', collisions;
  END IF;
END $$;

UPDATE words w
SET lemma = lemma, updated_at = NOW()       -- триггер подставит lak_canonical
WHERE (w.lemma IS DISTINCT FROM lak_canonical(w.lemma) OR w.notes IS DISTINCT FROM lak_canonical(w.notes))
  AND NOT EXISTS (
    SELECT 1 FROM words o
    WHERE o.id <> w.id AND o.lemma = lak_canonical(w.lemma) AND o.translation = w.translation
  );

UPDATE word_examples
SET sentence_src = sentence_src
WHERE sentence_src IS DISTINCT FROM lak_canonical(sentence_src);

-- ── 4. Вычисляемые колонки и индексы ───────────────────────────────────────

ALTER TABLE words
  ADD COLUMN IF NOT EXISTS lemma_key    text  GENERATED ALWAYS AS (lak_search_key(lemma)) STORED,
  ADD COLUMN IF NOT EXISTS first_letter text  GENERATED ALWAYS AS (lak_first_letter(lemma)) STORED,
  ADD COLUMN IF NOT EXISTS sort_key     int[] GENERATED ALWAYS AS (lak_sort_key(lemma)) STORED;

COMMENT ON COLUMN words.lemma_key    IS 'lak_search_key(lemma): поиск без учёта регистра и варианта палочки';
COMMENT ON COLUMN words.first_letter IS 'Первая буква по лакскому алфавиту (кк, кь, хьхь… — отдельные буквы)';
COMMENT ON COLUMN words.sort_key     IS 'Порядок по лакскому алфавиту: ORDER BY sort_key';

CREATE INDEX IF NOT EXISTS idx_words_lemma_key ON words (lemma_key text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_words_first_letter_sort ON words (first_letter, sort_key) WHERE is_active = TRUE;

-- ── 5. Ошибочные записи парсера ────────────────────────────────────────────
-- Не удаляем (на них могут ссылаться карточки), а скрываем.

UPDATE words
SET is_active = FALSE, updated_at = NOW()
WHERE is_active = TRUE
  AND lak_is_junk_entry(lemma, translation);
