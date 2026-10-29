/**
 * Единственное место, где определяется, входит ли слово в коллекцию.
 *
 * Слово входит в коллекцию, если:
 *   1) у слова есть тег из collections.rule_tag_codes (автоматическое правило), ИЛИ
 *   2) есть связь в collection_words с is_excluded = FALSE —
 *      неважно, ручная (is_manual = TRUE, добавлена в админке)
 *      или автоматическая (is_manual = FALSE, импорт словаря 1958);
 *   И при этом нет связи-исключения (is_excluded = TRUE).
 *
 * Раньше этот SQL был скопирован в 6 файлов и разошёлся: часть копий требовала
 * is_manual = TRUE, из-за чего у наборов slovar-1958-* в списке коллекций и на
 * дашборде было 0 слов, хотя в словаре и SRS-очереди эти слова были.
 */

/** Слово считается «выученным» (stage = known), начиная с этого интервала SM-2. */
export const KNOWN_INTERVAL_DAYS = 6;

/**
 * SQL-условие «слово входит в коллекцию».
 *
 * @param collectionIdSql SQL-выражение с id коллекции: "c.id", "$1" и т.п.
 * @param wordAlias       алиас таблицы words во внешнем запросе (по умолчанию "w")
 *
 * Внутри используются собственные алиасы (m_c, m_t, m_wt, m_cw), чтобы не
 * пересекаться с алиасами внешнего запроса.
 */
export function wordInCollectionSql(collectionIdSql: string, wordAlias = "w"): string {
  return `(
    (
      EXISTS (
        SELECT 1
        FROM collections m_c
        JOIN tags m_t ON LOWER(m_t.code) = ANY (
          SELECT LOWER(value) FROM unnest(m_c.rule_tag_codes) AS value
        )
        JOIN word_tags m_wt ON m_wt.tag_id = m_t.id
        WHERE m_c.id = ${collectionIdSql}
          AND m_wt.word_id = ${wordAlias}.id
      )
      OR EXISTS (
        SELECT 1
        FROM collection_words m_cw
        WHERE m_cw.collection_id = ${collectionIdSql}
          AND m_cw.word_id = ${wordAlias}.id
          AND m_cw.is_excluded = FALSE
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM collection_words m_cw
      WHERE m_cw.collection_id = ${collectionIdSql}
        AND m_cw.word_id = ${wordAlias}.id
        AND m_cw.is_excluded = TRUE
    )
  )`;
}

/**
 * Только основное слово из группы синонимов. Синонимы (priority >= 2)
 * не попадают в SRS-очередь, поэтому не должны учитываться и в прогрессе.
 */
export function primaryTranslationSql(wordAlias = "w"): string {
  return `${wordAlias}.translation_priority = 1`;
}
