/**
 * SQL-сид словаря учебника «Лакку дуниял»: db/seeds/lakku_dunial.sql.
 * Применяется db/migrate.sh, когда файл изменился; идемпотентен.
 *
 *  1. Пары (слово, значение) из словаря: новые добавляются, у существующих
 *     дополняются пустые поля — класс, формы, мн. число, транскрипция.
 *  2. Источник «Лакку дуниял · словарь».
 *  3. Класс, формы и мн. число переносятся на другие значения-существительные
 *     того же слова из других словарей — если в книге у слова один класс (у омонимов
 *     «цӀу» — огонь, III и «цӀу» — соль, II — не переносится).
 *  4. Пары, которых больше нет в словаре, отвязываются от источника; если у
 *     слова не осталось ни источников, ни тем и его никто не учит — скрывается.
 */

import { isJunkEntry } from "./junk.ts";
import { displayLemma, type LakkuDunialEntry } from "./lakkuDunial.ts";

export type LakkuDunialRow = {
  lemma: string;
  translation: string;
  priority: number;
  wordType: "word" | "phrase";
  partOfSpeech: string | null;
  lakClass: number | null;
  forms: string | null;
  plural: string | null;
  transcription: string | null;
};

const POS: Record<string, string> = { noun: "Сущ.", verb: "Глаг." };

export function lakkuDunialRows(entries: LakkuDunialEntry[]): LakkuDunialRow[] {
  const seen = new Set<string>();
  const rows: LakkuDunialRow[] = [];
  for (const e of entries) {
    const lemma = e.wordType === "word" ? displayLemma(e.lemma) : e.lemma;
    e.senses.forEach((translation, i) => {
      const t = translation.replace(/\s+/g, " ").trim();
      if (!t || t.length > 255 || lemma.length > 255) return;
      if (isJunkEntry({ lemma, translation: t })) return;
      const key = `${lemma}\0${t}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({
        lemma,
        translation: t,
        priority: i + 1,
        wordType: e.wordType,
        partOfSpeech: e.partOfSpeech ? POS[e.partOfSpeech] : null,
        lakClass: e.lakClass,
        forms: e.forms,
        plural: e.plural,
        transcription: e.transcription
      });
    });
  }
  return rows;
}

function lit(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${value.replace(/'/g, "''")}'`;
}

export function buildLakkuDunialSeedSql(rows: LakkuDunialRow[]): string {
  const values = rows.map(
    (r) =>
      `(${lit(r.lemma)}, ${lit(r.translation)}, ${r.priority}, ${lit(r.wordType)}, ${lit(r.partOfSpeech)}, ` +
      `${r.lakClass ?? "NULL"}, ${lit(r.forms)}, ${lit(r.plural)}, ${lit(r.transcription)})`
  );
  const chunks: string[] = [];
  for (let i = 0; i < values.length; i += 1000) chunks.push(values.slice(i, i + 1000).join(",\n"));

  return `-- ============================================================
-- Сид: словарь учебника «Лакку дуниял» (С. Мусаев)
-- СГЕНЕРИРОВАНО: npm run parse:lakku-dunial -- --seed  (не редактировать вручную)
-- Записей: ${rows.length}, с классом: ${rows.filter((r) => r.lakClass).length}, с мн. числом: ${rows.filter((r) => r.plural).length}
-- ============================================================

BEGIN;

CREATE TEMP TABLE seed_ld (
  lemma text NOT NULL, translation text NOT NULL, priority smallint NOT NULL,
  word_type text NOT NULL, part_of_speech text, lak_class smallint,
  lak_forms text, lak_plural text, transcription text
) ON COMMIT DROP;

${chunks.map((c) => `INSERT INTO seed_ld VALUES\n${c};`).join("\n\n")}

UPDATE seed_ld SET lemma = lak_canonical(lemma),
                   lak_forms = lak_canonical(lak_forms),
                   lak_plural = lak_canonical(lak_plural);
CREATE INDEX ON seed_ld (lemma, translation);
ANALYZE seed_ld;

-- 1. Слова
INSERT INTO words (lemma, translation, translation_priority, word_type, part_of_speech,
                   lak_class, lak_forms, lak_plural, transcription)
SELECT DISTINCT ON (lemma, translation)
  lemma, translation, priority, word_type, part_of_speech, lak_class, lak_forms, lak_plural, transcription
FROM seed_ld
ORDER BY lemma, translation, priority
ON CONFLICT (lemma, translation) DO UPDATE SET
  lak_class      = COALESCE(words.lak_class, EXCLUDED.lak_class),
  lak_forms      = COALESCE(words.lak_forms, EXCLUDED.lak_forms),
  lak_plural     = COALESCE(words.lak_plural, EXCLUDED.lak_plural),
  transcription  = COALESCE(words.transcription, EXCLUDED.transcription),
  part_of_speech = COALESCE(words.part_of_speech, EXCLUDED.part_of_speech),
  updated_at     = NOW()
WHERE words.lak_class IS NULL OR words.lak_forms IS NULL OR words.lak_plural IS NULL
   OR words.transcription IS NULL OR words.part_of_speech IS NULL;

-- 2. Источник
INSERT INTO word_sources (word_id, source_id, locator)
SELECT DISTINCT w.id, src.id, 'словарь'
FROM seed_ld s
JOIN words w ON w.lemma = s.lemma AND w.translation = s.translation
CROSS JOIN (SELECT id FROM sources WHERE code = 'lakku_dunial') src
ON CONFLICT DO NOTHING;

-- 3. Грамматика — на другие значения того же слова, если в книге класс один
CREATE TEMP TABLE seed_ld_lexeme ON COMMIT DROP AS
SELECT lak_search_key(lemma) AS lemma_key,
       MIN(lak_class) AS lak_class, MIN(lak_forms) AS lak_forms, MIN(lak_plural) AS lak_plural
FROM seed_ld
WHERE word_type = 'word' AND lak_class IS NOT NULL
GROUP BY 1
HAVING COUNT(DISTINCT lak_class) = 1 AND COUNT(DISTINCT lak_forms) <= 1;

UPDATE words w
SET lak_class  = COALESCE(w.lak_class, g.lak_class),
    lak_forms  = COALESCE(w.lak_forms, g.lak_forms),
    lak_plural = COALESCE(w.lak_plural, g.lak_plural),
    updated_at = NOW()
FROM seed_ld_lexeme g
WHERE w.lemma_key = g.lemma_key
  AND w.word_type = 'word'
  -- Только существительные: «хьхьичӀалу» — и «впереди» (сущ.), и «преградить» (глаг.)
  AND COALESCE(w.part_of_speech, 'Сущ.') = 'Сущ.'
  -- «душ → душ» (заимствование) — не «душ → девушка»
  AND NOT w.is_loanword
  AND (w.lak_class IS NULL OR (w.lak_forms IS NULL AND g.lak_forms IS NOT NULL) OR (w.lak_plural IS NULL AND g.lak_plural IS NOT NULL));

-- 4. Пары, которых больше нет в словаре
CREATE TEMP TABLE seed_ld_stale ON COMMIT DROP AS
SELECT ws.word_id
FROM word_sources ws
JOIN sources src ON src.id = ws.source_id AND src.code = 'lakku_dunial'
JOIN words w ON w.id = ws.word_id
WHERE ws.locator = 'словарь'
  AND NOT EXISTS (SELECT 1 FROM seed_ld s WHERE s.lemma = w.lemma AND s.translation = w.translation);

DELETE FROM word_sources ws
USING seed_ld_stale st, sources src
WHERE ws.word_id = st.word_id AND ws.source_id = src.id AND src.code = 'lakku_dunial' AND ws.locator = 'словарь';

UPDATE words w
SET is_active = FALSE, updated_at = NOW()
WHERE w.is_active
  AND w.id IN (SELECT word_id FROM seed_ld_stale)
  AND NOT EXISTS (SELECT 1 FROM word_sources ws WHERE ws.word_id = w.id)
  AND NOT EXISTS (SELECT 1 FROM collection_words cw WHERE cw.word_id = w.id)
  AND NOT EXISTS (SELECT 1 FROM user_study_words usw WHERE usw.word_id = w.id);

INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, payload)
SELECT NULL, 'seed.lakku_dunial', 'source', 'lakku_dunial',
  jsonb_build_object('records', (SELECT COUNT(*) FROM seed_ld),
                     'stale', (SELECT COUNT(*) FROM seed_ld_stale));

COMMIT;
`;
}
