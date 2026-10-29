/**
 * SQL-сид «Русско-лакского школьного словаря» 1958 г.: db/seeds/slovar_1958.sql.
 * Устроен как сид Дигиева (digievSeed.ts): применяется db/migrate.sh, когда файл
 * изменился, и идемпотентен.
 *
 *  1. Коллекции slovar-1958-<буква> (указатель по русской букве).
 *  2. Новые пары (lemma, translation) — со всеми полями. Существующие строки
 *     не перезаписываются; пустые поля (часть речи, род, вид, примечание)
 *     дополняются из словаря.
 *  3. Тип записи из словаря — кроме пар, которые есть в разговорнике Дигиева
 *     и там считаются словом (не понижаем «слово» до «фразы»).
 *  4. Связи с коллекциями.
 *  5. Связи, которых больше нет в словаре (например, «дома → къатта» вместо
 *     «дом → къатта» — ошибка прежнего парсера), удаляются; слова без других
 *     коллекций скрываются. Слова из разговорника и тем не трогаются.
 */

import type { ImportWordRecord } from "./slovar1958.ts";

function lit(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${value.replace(/'/g, "''")}'`;
}

function chunks<T>(rows: T[], size = 1000): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

export function buildSlovar1958SeedSql(records: ImportWordRecord[]): string {
  const collections = new Map<string, ImportWordRecord>();
  for (const r of records) if (!collections.has(r.collectionSlug)) collections.set(r.collectionSlug, r);

  // Одна строка на пару (в словаре одна пара может встретиться в нескольких статьях):
  // предпочитаем «слово», основное значение и запись с примечанием
  const score = (r: ImportWordRecord) => (r.wordType === "word" ? 0 : 10) + r.translationPriority + (r.notes ? 0 : 0.1);
  const byPair = new Map<string, ImportWordRecord>();
  for (const r of records) {
    const key = `${r.lemma.trim()}\0${r.translation.trim()}`;
    const prev = byPair.get(key);
    if (!prev || score(r) < score(prev)) byPair.set(key, r);
  }
  const rows = [...byPair.values()].map(
    (r) =>
      `(${lit(r.collectionSlug)}, ${lit(r.lemma)}, ${lit(r.translation)}, ${lit(r.partOfSpeech)}, ${lit(r.gender)}, ` +
      `${lit(r.verbAspect)}, ${lit(r.wordType)}, ${lit(r.notes)}, ${r.translationPriority}, ${lit(r.synonymGroupId)})`
  );

  const collectionRows = [...collections.values()]
    .sort((a, b) => a.collectionSortOrder - b.collectionSortOrder)
    .map((r) => `(${lit(r.collectionSlug)}, ${lit(r.collectionTitle)}, ${lit(r.collectionDescription)}, ${r.collectionSortOrder})`);

  return `-- ============================================================
-- Сид: «Русско-лакский школьный словарь» (Г. М. Гаджиев, 1958)
-- СГЕНЕРИРОВАНО: npm run parse:1958 -- --seed  (не редактировать вручную)
-- Букв: ${collectionRows.length}, записей: ${rows.length}
-- Применяется db/migrate.sh, когда меняется содержимое файла.
-- ============================================================

BEGIN;

CREATE TEMP TABLE seed_1958_collections (
  slug text PRIMARY KEY, title text NOT NULL, description text, sort_order int NOT NULL
) ON COMMIT DROP;

INSERT INTO seed_1958_collections VALUES
${collectionRows.join(",\n")};

CREATE TEMP TABLE seed_1958_words (
  slug text NOT NULL, lemma text NOT NULL, translation text NOT NULL,
  part_of_speech text, gender text, verb_aspect text, word_type text NOT NULL,
  notes text, priority smallint NOT NULL, synonym_group text
) ON COMMIT DROP;

${chunks(rows).map((c) => `INSERT INTO seed_1958_words VALUES\n${c.join(",\n")};`).join("\n\n")}

-- Лемма в БД канонизирована триггером (палочка → Ӏ) — приводим и сид, чтобы пары совпадали
UPDATE seed_1958_words SET lemma = lak_canonical(lemma) WHERE lemma IS DISTINCT FROM lak_canonical(lemma);
CREATE INDEX ON seed_1958_words (lemma, translation);
ANALYZE seed_1958_words;

-- 1. Коллекции
INSERT INTO collections (slug, title, description, level, is_public, sort_order, kind, is_active)
SELECT slug, title, description, NULL, TRUE, sort_order, 'alphabet', TRUE
FROM seed_1958_collections
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  kind = 'alphabet',
  is_public = TRUE,
  is_active = TRUE,
  updated_at = NOW();

-- 2. Слова: новые пары целиком, у существующих — только пустые поля
INSERT INTO words (lemma, translation, part_of_speech, gender, verb_aspect, word_type, notes,
                   translation_priority, synonym_group_id)
SELECT DISTINCT ON (lemma, translation)
  lemma, translation, part_of_speech, gender, verb_aspect, word_type, notes, priority, synonym_group
FROM seed_1958_words
ORDER BY lemma, translation, priority
ON CONFLICT (lemma, translation) DO NOTHING;

UPDATE words w
SET part_of_speech = COALESCE(w.part_of_speech, s.part_of_speech),
    gender         = COALESCE(w.gender, s.gender),
    verb_aspect    = COALESCE(w.verb_aspect, s.verb_aspect),
    notes          = COALESCE(w.notes, s.notes),
    updated_at     = NOW()
FROM seed_1958_words s
WHERE w.lemma = s.lemma AND w.translation = s.translation
  AND (
    (w.part_of_speech IS NULL AND s.part_of_speech IS NOT NULL) OR
    (w.gender IS NULL AND s.gender IS NOT NULL) OR
    (w.verb_aspect IS NULL AND s.verb_aspect IS NOT NULL) OR
    (w.notes IS NULL AND s.notes IS NOT NULL)
  );

-- 3. Тип записи
UPDATE words w
SET word_type = s.word_type, updated_at = NOW()
FROM seed_1958_words s
WHERE w.lemma = s.lemma AND w.translation = s.translation
  AND w.word_type IS DISTINCT FROM s.word_type
  AND (
    s.word_type = 'word'
    OR NOT EXISTS (
      SELECT 1 FROM collection_words cw JOIN collections c ON c.id = cw.collection_id
      WHERE cw.word_id = w.id AND c.slug LIKE 'digiev-%'
    )
  );

-- 4. Связи с коллекциями
INSERT INTO collection_words (collection_id, word_id, is_manual, is_excluded)
SELECT DISTINCT c.id, w.id, FALSE, FALSE
FROM seed_1958_words s
JOIN collections c ON c.slug = s.slug
JOIN words w ON w.lemma = s.lemma AND w.translation = s.translation
ON CONFLICT (collection_id, word_id) DO NOTHING;

-- 5. Устаревшие связи и записи
CREATE TEMP TABLE seed_1958_stale ON COMMIT DROP AS
SELECT cw.collection_id, cw.word_id
FROM collection_words cw
JOIN collections c ON c.id = cw.collection_id
JOIN words w ON w.id = cw.word_id
WHERE c.slug LIKE 'slovar-1958-%'
  AND cw.is_excluded = FALSE
  AND NOT EXISTS (
    SELECT 1 FROM seed_1958_words s
    WHERE s.lemma = w.lemma AND s.translation = w.translation
  );

DELETE FROM collection_words cw
USING seed_1958_stale st
WHERE cw.collection_id = st.collection_id AND cw.word_id = st.word_id;

UPDATE words w
SET is_active = FALSE, updated_at = NOW()
WHERE w.is_active
  AND w.id IN (SELECT word_id FROM seed_1958_stale)
  AND NOT EXISTS (
    SELECT 1 FROM collection_words cw
    JOIN collections c ON c.id = cw.collection_id
    WHERE cw.word_id = w.id AND c.slug NOT LIKE 'course-%'
  )
  AND NOT EXISTS (SELECT 1 FROM user_study_words usw WHERE usw.word_id = w.id);

INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, payload)
SELECT NULL, 'seed.slovar_1958', 'collection', 'slovar-1958',
  jsonb_build_object(
    'records', (SELECT COUNT(*) FROM seed_1958_words),
    'stale_links_removed', (SELECT COUNT(*) FROM seed_1958_stale)
  );

COMMIT;
`;
}
