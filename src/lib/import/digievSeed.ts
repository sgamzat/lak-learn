/**
 * SQL-сид разговорника Дигиева: db/seeds/digiev_phrasebook.sql.
 *
 * Сид применяется скриптом db/migrate.sh после миграций — только когда файл
 * изменился (по контрольной сумме). Ручной запуск импорта не нужен:
 * достаточно `docker compose up -d --build`.
 *
 * Что делает сид (идемпотентно):
 *  1. Создаёт/обновляет коллекции digiev-NN-*, отключает устаревшие
 *     (например, «Без названия» → теперь «Антонимы», списки имён).
 *  2. Добавляет новые пары (lemma, translation). Существующие строки
 *     (в т.ч. из словаря 1958) НЕ перезаписываются.
 *  3. Пары, которые по Дигиеву — слова, получают word_type = 'word'
 *     (старый импорт делал «фразой» всё подряд, и слова пропадали из словаря).
 *  4. Связывает слова с коллекциями.
 *  5. Удаляет связи, которых больше нет в источнике (обрывки старого парсера),
 *     и скрывает слова, оставшиеся без коллекций. Слова, которые есть в других
 *     (не digiev) коллекциях, не трогаются.
 */

import type { DigievChapter, DigievRecord } from "./digievPhrasebook.ts";

function lit(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${value.replace(/'/g, "''")}'`;
}

function valuesChunks(rows: string[], size = 500): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size).join(",\n"));
  return chunks;
}

export function buildDigievSeedSql(chapters: DigievChapter[], records: DigievRecord[]): string {
  const collections = chapters.map((ch) => {
    const description = ch.titleLak ? `${ch.titleLak} · Дигиев, гл. ${ch.chapter}` : `Дигиев, гл. ${ch.chapter}`;
    return `(${lit(ch.slug)}, ${lit(ch.titleRu)}, ${lit(description)}, ${ch.chapter})`;
  });

  // Одна пара — одна строка на коллекцию (дубли внутри главы уже убраны парсером)
  const seen = new Set<string>();
  const words: string[] = [];
  for (const r of records) {
    const key = `${r.collectionSlug}\0${r.lemma}\0${r.translation}`;
    if (seen.has(key)) continue;
    seen.add(key);
    words.push(
      `(${lit(r.collectionSlug)}, ${lit(r.lemma)}, ${lit(r.translation)}, ${lit(r.wordType)}, ${r.translationPriority}, ${lit(r.synonymGroupId)}, ${r.chapter})`
    );
  }

  const insertWords = valuesChunks(words)
    .map((chunk) => `INSERT INTO seed_digiev_words VALUES\n${chunk};`)
    .join("\n\n");

  return `-- ============================================================
-- Сид: «Русско-лакский разговорник» Л. А. Дигиева
-- СГЕНЕРИРОВАНО: npm run parse:digiev -- --seed  (не редактировать вручную)
-- Глав: ${chapters.length}, записей: ${words.length}
-- Применяется db/migrate.sh, когда меняется содержимое файла.
-- ============================================================

BEGIN;

CREATE TEMP TABLE seed_digiev_collections (
  slug text PRIMARY KEY, title text NOT NULL, description text, sort_order int NOT NULL
) ON COMMIT DROP;

INSERT INTO seed_digiev_collections VALUES
${collections.join(",\n")};

CREATE TEMP TABLE seed_digiev_words (
  slug text NOT NULL, lemma text NOT NULL, translation text NOT NULL,
  word_type text NOT NULL, priority smallint NOT NULL, synonym_group text, chapter int NOT NULL
) ON COMMIT DROP;

${insertWords}

-- 1. Коллекции
INSERT INTO collections (slug, title, description, level, is_public, sort_order, kind, is_active)
SELECT slug, title, description, NULL, TRUE, sort_order, 'topic', TRUE
FROM seed_digiev_collections
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  kind = 'topic',
  is_public = TRUE,
  is_active = TRUE,
  updated_at = NOW();

UPDATE collections
SET is_active = FALSE, updated_at = NOW()
WHERE slug LIKE 'digiev-%'
  AND is_active
  AND slug NOT IN (SELECT slug FROM seed_digiev_collections);

-- 2. Слова: только новые пары, существующие строки не перезаписываются
INSERT INTO words (lemma, translation, word_type, translation_priority, synonym_group_id)
SELECT DISTINCT ON (lemma, translation) lemma, translation, word_type, priority, synonym_group
FROM seed_digiev_words
ORDER BY lemma, translation, chapter
ON CONFLICT (lemma, translation) DO NOTHING;

-- 3. Слово по Дигиеву — слово (раньше импорт делал «фразой» всё подряд)
UPDATE words w
SET word_type = 'word', updated_at = NOW()
FROM (SELECT DISTINCT lemma, translation FROM seed_digiev_words WHERE word_type = 'word') s
WHERE w.lemma = s.lemma
  AND w.translation = s.translation
  AND w.word_type IS DISTINCT FROM 'word';

-- 4. Связи с коллекциями
INSERT INTO collection_words (collection_id, word_id, is_manual, is_excluded)
SELECT DISTINCT c.id, w.id, TRUE, FALSE
FROM seed_digiev_words s
JOIN collections c ON c.slug = s.slug
JOIN words w ON w.lemma = s.lemma AND w.translation = s.translation
ON CONFLICT (collection_id, word_id) DO NOTHING;

-- 5. Связи, которых нет в источнике (обрывки старого парсера, пары из списков имён).
--    Слова из других (не digiev) коллекций не трогаем — их могли добавить в тему вручную.
CREATE TEMP TABLE seed_digiev_stale ON COMMIT DROP AS
SELECT cw.collection_id, cw.word_id
FROM collection_words cw
JOIN collections c ON c.id = cw.collection_id
JOIN words w ON w.id = cw.word_id
WHERE c.slug LIKE 'digiev-%'
  AND cw.is_excluded = FALSE
  AND NOT EXISTS (
    SELECT 1 FROM seed_digiev_words s
    WHERE s.slug = c.slug AND s.lemma = w.lemma AND s.translation = w.translation
  )
  AND NOT EXISTS (
    SELECT 1 FROM collection_words o
    JOIN collections oc ON oc.id = o.collection_id
    WHERE o.word_id = cw.word_id AND oc.slug NOT LIKE 'digiev-%'
  );

DELETE FROM collection_words cw
USING seed_digiev_stale st
WHERE cw.collection_id = st.collection_id AND cw.word_id = st.word_id;

UPDATE words w
SET is_active = FALSE, updated_at = NOW()
WHERE w.is_active
  AND w.id IN (SELECT word_id FROM seed_digiev_stale)
  AND NOT EXISTS (SELECT 1 FROM collection_words cw WHERE cw.word_id = w.id);

INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, payload)
SELECT NULL, 'seed.digiev_phrasebook', 'collection', 'digiev',
  jsonb_build_object(
    'collections', (SELECT COUNT(*) FROM seed_digiev_collections),
    'records', (SELECT COUNT(*) FROM seed_digiev_words),
    'stale_links_removed', (SELECT COUNT(*) FROM seed_digiev_stale)
  );

COMMIT;
`;
}
