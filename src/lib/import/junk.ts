/**
 * Записи, которые парсер словаря 1958 г. извлёк ошибочно: вместо лакского
 * слова — грамматическая помета («несов», «Союз»), вместо перевода — обрезок
 * заголовка («п»). Такие записи не импортируются и не показываются.
 *
 * Те же правила — в SQL (db/migrations/011_lak_alphabet.sql, lak_is_junk_entry):
 * меняя здесь, меняйте и там.
 */

/** Грамматические пометы, попавшие в поле лакского слова */
const GRAMMAR_LABELS = new Set([
  "союз", "частица", "предлог", "межд", "междометие", "нареч", "прил",
  "сущ", "глаг", "мест", "местоим", "числ"
]);

/** Однобуквенные русские слова — настоящие переводы, а не обрезки */
const ONE_LETTER_RU_WORDS = new Set(["а", "б", "в", "ж", "и", "к", "о", "с", "у", "я"]);

// «несов», «2 несов», «1 мн», «2 союз», «ср.» — только помета, без слова
const ONLY_MARKER_RE = /^\d*\s*(несов|сов|мн|ед|разг|перен|м|ж|ср|прил|сущ|глаг|нареч|союз|местоим|мест|числ|частица|предлог|межд)\.?$/i;
// «разряжать несов» — русский глагол с пометой вида вместо лакского слова
const TRAILING_ASPECT_RE = /\s(несов|сов)\.?$/i;
// «1 )щун бан» — обрывок нумерованного значения
const NUMBERED_FRAGMENT_RE = /^\d+\s*\)/;

export function isJunkEntry(entry: { lemma: string; translation: string }): boolean {
  const lemma = entry.lemma.trim();
  const translation = entry.translation.trim();

  if (!lemma || !translation) return true;
  if (GRAMMAR_LABELS.has(lemma.toLowerCase().replace(/\.+$/, ""))) return true;
  if (ONLY_MARKER_RE.test(lemma)) return true;
  if (TRAILING_ASPECT_RE.test(lemma)) return true;
  if (NUMBERED_FRAGMENT_RE.test(lemma)) return true;
  if ([...translation].length === 1 && !ONE_LETTER_RU_WORDS.has(translation.toLowerCase())) return true;

  return false;
}
