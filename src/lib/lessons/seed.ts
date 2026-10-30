/**
 * SQL-сид слов уроков: db/seeds/lessons.sql. Собирается из content/lessons/*.json
 * командой npm run lessons:seed и применяется db/migrate.sh, когда файл изменился.
 *
 *  1. Коллекции lesson-NN (kind = 'lesson').
 *  2. Слова уроков: новые пары добавляются, существующие становятся основным
 *     значением (translation_priority = 1) и активными — урок опирается на них.
 *     Пустые транскрипция и примечание дополняются, класс берётся из урока.
 *  3. Источник «Лакку дуниял» с указанием урока.
 *  4. Примеры из диалогов и текстов урока (is_auto = FALSE — показываются первыми).
 *  5. Слова, которые убрали из урока, отвязываются от его коллекции.
 */

import type { Lesson, LakClass } from "./types.ts";
import { lessonSlug } from "./index.ts";
import { examplesFor } from "./exercises.ts";

const CLASS_NUM: Record<LakClass, number> = { I: 1, II: 2, III: 3 };

function lit(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${value.replace(/'/g, "''")}'`;
}

export function buildLessonsSeedSql(lessons: Lesson[]): string {
  const collections = lessons.map(
    (l) => `(${lit(lessonSlug(l.number))}, ${lit(`Урок ${l.number}. ${l.title}`)}, ${lit(l.goal)}, ${l.number})`
  );

  const words: string[] = [];
  const examples: string[] = [];
  for (const lesson of lessons) {
    const slug = lessonSlug(lesson.number);
    lesson.words.forEach((w, i) => {
      words.push(
        `(${lit(slug)}, ${i + 1}, ${lit(w.lak)}, ${lit(w.ru)}, ${lit(w.kind === "phrase" ? "phrase" : "word")}, ` +
          `${lit(w.tr)}, ${lit(w.note)}, ${w.cls ? CLASS_NUM[w.cls] : "NULL"})`
      );
      for (const ex of examplesFor(lesson, w)) {
        examples.push(`(${lit(w.lak)}, ${lit(w.ru)}, ${lit(ex.lak)}, ${lit(ex.ru)})`);
      }
    });
  }

  return `-- ============================================================
-- Сид: слова уроков (учебник «Лакку дуниял», С. Мусаев)
-- СГЕНЕРИРОВАНО: npm run lessons:seed  (не редактировать вручную —
-- правьте content/lessons/*.json)
-- Уроков: ${lessons.length}, слов: ${words.length}, примеров: ${examples.length}
-- ============================================================

BEGIN;

CREATE TEMP TABLE seed_lesson_collections (
  slug text PRIMARY KEY, title text NOT NULL, description text, sort_order int NOT NULL
) ON COMMIT DROP;

INSERT INTO seed_lesson_collections VALUES
${collections.join(",\n")};

CREATE TEMP TABLE seed_lesson_words (
  slug text NOT NULL, position int NOT NULL, lemma text NOT NULL, translation text NOT NULL,
  word_type text NOT NULL, transcription text, notes text, lak_class smallint
) ON COMMIT DROP;

INSERT INTO seed_lesson_words VALUES
${words.join(",\n")};

CREATE TEMP TABLE seed_lesson_examples (
  lemma text NOT NULL, translation text NOT NULL, sentence text NOT NULL, sentence_translation text
) ON COMMIT DROP;

${examples.length ? `INSERT INTO seed_lesson_examples VALUES\n${examples.join(",\n")};` : ""}

-- Лемма в БД канонизирована триггером — приводим и сид
UPDATE seed_lesson_words SET lemma = lak_canonical(lemma) WHERE lemma IS DISTINCT FROM lak_canonical(lemma);
UPDATE seed_lesson_examples SET lemma = lak_canonical(lemma), sentence = lak_canonical(sentence);

-- 1. Коллекции уроков
INSERT INTO collections (slug, title, description, level, is_public, sort_order, kind, is_active)
SELECT slug, title, description, NULL, TRUE, sort_order, 'lesson', TRUE
FROM seed_lesson_collections
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  kind = 'lesson',
  is_public = TRUE,
  is_active = TRUE,
  updated_at = NOW();

-- 2. Слова
INSERT INTO words (lemma, translation, word_type, transcription, notes, lak_class, translation_priority)
SELECT DISTINCT ON (lemma, translation) lemma, translation, word_type, transcription, notes, lak_class, 1
FROM seed_lesson_words
ORDER BY lemma, translation, slug
ON CONFLICT (lemma, translation) DO UPDATE SET
  translation_priority = 1,
  is_active = TRUE,
  word_type = EXCLUDED.word_type,
  transcription = COALESCE(words.transcription, EXCLUDED.transcription),
  notes = COALESCE(words.notes, EXCLUDED.notes),
  lak_class = COALESCE(EXCLUDED.lak_class, words.lak_class),
  updated_at = NOW();

-- 3. Источник
INSERT INTO word_sources (word_id, source_id, locator)
SELECT DISTINCT w.id, src.id, 'урок ' || c.sort_order
FROM seed_lesson_words s
JOIN seed_lesson_collections c ON c.slug = s.slug
JOIN words w ON w.lemma = s.lemma AND w.translation = s.translation
CROSS JOIN (SELECT id FROM sources WHERE code = 'lakku_dunial') src
ON CONFLICT DO NOTHING;

-- 4. Связи с коллекциями уроков
INSERT INTO collection_words (collection_id, word_id, is_manual, is_excluded)
SELECT DISTINCT c.id, w.id, TRUE, FALSE
FROM seed_lesson_words s
JOIN collections c ON c.slug = s.slug
JOIN words w ON w.lemma = s.lemma AND w.translation = s.translation
ON CONFLICT (collection_id, word_id) DO UPDATE SET is_excluded = FALSE;

DELETE FROM collection_words cw
USING collections c, words w
WHERE c.id = cw.collection_id AND w.id = cw.word_id
  AND c.slug LIKE 'lesson-%'
  AND NOT EXISTS (
    SELECT 1 FROM seed_lesson_words s
    WHERE s.slug = c.slug AND s.lemma = w.lemma AND s.translation = w.translation
  );

-- 5. Примеры из уроков (пересобираются целиком)
DELETE FROM word_examples
WHERE source_id = (SELECT id FROM sources WHERE code = 'lakku_dunial');

INSERT INTO word_examples (word_id, sentence_src, sentence_translation, source_id, is_auto)
SELECT DISTINCT ON (w.id, e.sentence) w.id, e.sentence, e.sentence_translation,
  (SELECT id FROM sources WHERE code = 'lakku_dunial'), FALSE
FROM seed_lesson_examples e
JOIN words w ON w.lemma = e.lemma AND w.translation = e.translation
ON CONFLICT (word_id, sentence_src) DO NOTHING;

INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, payload)
SELECT NULL, 'seed.lessons', 'collection', 'lessons',
  jsonb_build_object('lessons', (SELECT COUNT(*) FROM seed_lesson_collections),
                     'words', (SELECT COUNT(*) FROM seed_lesson_words));

COMMIT;
`;
}
