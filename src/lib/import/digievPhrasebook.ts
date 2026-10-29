/**
 * Парсер «Русско-лакского разговорника» Л. А. Дигиева (HTML).
 * Источник: parse/lak.html (сохранённая копия lakkumaz.narod.ru).
 *
 * Структура книги:
 *   гл. 0       — предисловие (пропускается)
 *   гл. 1–90    — разговорник по темам: фразы и тематические слова
 *   гл. 91–98   — «Краткий русско-лакский словарь»: существительные, глаголы,
 *                 прилагательные, антонимы, цвета, наречия, местоимения, числительные
 *   гл. 99–100  — списки лакских имён (не пары перевода — пропускаются)
 */

import { toLakCanonical } from "../lak/alphabet.ts";
import { extractLeafTables, decodeEntities, type HtmlRow } from "./htmlTables.ts";

export type DigievWordType = "word" | "phrase";

export type DigievEntry = {
  lemma: string;
  translation: string;
  notes: string | null;
  wordType: DigievWordType;
  /** 1 — основной вариант; 2+ — другие значения из «1. … 2. …» */
  translationPriority: number;
  synonymGroupId: string | null;
};

export type DigievChapter = {
  chapter: number;
  slug: string;
  titleRu: string;
  titleLak: string | null;
  phrases: DigievEntry[];
};

export type DigievRecord = DigievEntry & {
  collectionSlug: string;
  collectionTitle: string;
  collectionTitleLak: string | null;
  collectionDescription: string;
  collectionSortOrder: number;
  collectionKind: "topic";
  chapter: number;
};

/** Главы «Краткого словаря» — отдельные слова, а не фразы */
export const DIGIEV_DICTIONARY_CHAPTERS = { from: 91, to: 98 } as const;
/** Списки имён: в строке по 6 имён, это не пары «русский — лакский» */
const NAME_LIST_CHAPTERS = new Set([99, 100]);
const NUMERALS_CHAPTER = 98;

// ─── Слаг коллекции ──────────────────────────────────────────────────────────

const CYR_TO_LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  і: "i", ӏ: "i", Ӏ: "i"
};

function translitSlug(value: string): string {
  let out = "";
  for (const ch of value.toLowerCase()) {
    if (CYR_TO_LAT[ch] !== undefined) out += CYR_TO_LAT[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
    else if (/[\s._—–−-]/.test(ch)) out += "-";
  }
  return out.replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export function digievCollectionSlug(chapter: number, titleRu: string): string {
  return `digiev-${String(chapter).padStart(2, "0")}-${translitSlug(titleRu) || "tema"}`;
}

// ─── Оглавление: названия глав (у гл. 94 в тексте вместо заголовка «* * *») ───

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

export function parseTableOfContents(html: string): Map<number, { ru: string; lak: string | null }> {
  const toc = new Map<number, { ru: string; lak: string | null }>();
  const re = /<a\s+href="#glava(\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const n = Number.parseInt(m[1], 10);
    if (toc.has(n)) continue; // первое вхождение — основное оглавление
    const text = stripTags(m[2]);
    const [ru, lak] = text.split(/\s*(?:\.\s){3,}\.?\s*|\s+—\s+/);
    if (ru) toc.set(n, { ru: ru.trim(), lak: lak?.trim() || null });
  }
  return toc;
}

// ─── Очистка текста ──────────────────────────────────────────────────────────

const ELLIPSIS_START = /^\s*(?:\.{2,}|…)\s*/;
const ELLIPSIS_END = /\s*(?:\.{2,}|…)\s*$/;

function startsWithEllipsis(s: string): boolean {
  return ELLIPSIS_START.test(s);
}
function endsWithEllipsis(s: string): boolean {
  return ELLIPSIS_END.test(s);
}
function stripEllipses(s: string): string {
  return s.replace(ELLIPSIS_START, "").replace(ELLIPSIS_END, "").trim();
}
function oneLine(s: string): string {
  return s
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*[;:,]+$/, "") // «бюхълан;»
    .trim();
}

/** «Как это будет по-лакски?Лакку мазрай…» — русский и лакский в одной ячейке */
const LAK_MARKERS = /[гкптхцчГКПТХЦЧ][IӀӏ]|аь|оь|[гкх][ъь]|кк|сс|тт|чч|хх|цц|пп/i;
export function splitMergedCell(text: string): { ru: string; lak: string } | null {
  const m = text.match(/^(.+?[?!.])\s*([А-ЯЁ].+)$/);
  if (!m) return null;
  const [, ru, lak] = m;
  if (!LAK_MARKERS.test(lak) || LAK_MARKERS.test(ru)) return null;
  return { ru: ru.trim(), lak: lak.trim() };
}

/** «1. ласун 2. дугьан» → ["ласун", "дугьан"] */
export function splitNumberedSenses(text: string): string[] {
  const flat = oneLine(text);
  if (!/^1\.\s/.test(flat) || !/\s2\.\s/.test(flat)) return [flat];
  return flat
    .split(/(?:^|\s)\d+\.\s+/)
    .map((s) => oneLine(s)) // «1. бюхълан; 2. …» → без «;»
    .filter(Boolean);
}

// ─── Классификация ───────────────────────────────────────────────────────────

/**
 * Слово или фраза. Главы словаря (91–98) — всегда слова. В тематических главах
 * слово — это «Воробей → ЧӀелму, шярлу», «Головастик → Магъду кӀичӀала»:
 * не больше двух слов с каждой стороны (варианты через запятую и скобки не считаются)
 * и без знаков предложения. «Желаю вам (тебе) успехов» — уже фраза.
 */
export function classifyWordType(chapter: number, ru: string, lak: string): DigievWordType {
  if (chapter >= DIGIEV_DICTIONARY_CHAPTERS.from && chapter <= DIGIEV_DICTIONARY_CHAPTERS.to) return "word";
  if (/[.!?]/.test(ru) || /[.!?]/.test(lak)) return "phrase";
  const words = (s: string) =>
    s.replace(/\([^)]*\)/g, " ").split(",")[0].trim().split(/\s+/).filter(Boolean).length;
  return words(ru) > 2 || words(lak) > 2 ? "phrase" : "word";
}

// ─── Строки таблиц → пары ────────────────────────────────────────────────────

type Pair = { ru: string; lak: string };

/**
 * «НацIу мечI КРАТКИЙ РУССКО-ЛАКСКИЙ СЛОВАРЬ» — к последней строке главы
 * приклеился заголовок следующего раздела. Отрезаем хвост из 2+ слов
 * заглавными, если до него текст в обычном регистре.
 */
export function stripTrailingHeading(text: string): string {
  const m = text.match(/^(.*[а-яё].*?)\s+((?:[А-ЯЁ][А-ЯЁӀ-]+\s*){2,})$/);
  return m ? m[1].trim() : text;
}

function rowPair(row: HtmlRow): Pair | null {
  const cells = row.cells.filter((c) => !c.isHeader);
  if (cells.length === 0) return null;
  const ru = stripTrailingHeading(cells[0]?.text ?? "");
  const lak = stripTrailingHeading(cells[1]?.text ?? "");
  if (ru && !lak) {
    const merged = splitMergedCell(oneLine(ru));
    if (merged) return merged;
  }
  return { ru, lak };
}

function isChildRow(row: HtmlRow): boolean {
  return row.alignRight || row.cells[0]?.alignRight === true;
}

function combine(stem: string, tail: string): string {
  return oneLine(`${stripEllipses(stem)} ${stripEllipses(tail)}`);
}

function combineHeading(parentRu: string, childRu: string): string {
  const p = parentRu.replace(/:\s*$/, "").trim();
  const c = stripEllipses(childRu);
  if (!p) return c;
  if (!c) return p;
  if (endsWithEllipsis(p)) return combine(p, c);
  if (c.startsWith("(") && c.endsWith(")")) return `${p} ${c}`;
  return `${p} (${c})`;
}

/**
 * Правила склейки (проверены на всех 90 главах разговорника):
 *  1. «Тетя:» без перевода + строки с отступом «по отцу | Бутталссу!» →
 *     «Тетя (по отцу) → Бутталссу!».
 *  2. Основа с многоточием «Желаю вам (тебе)... | Зун (вин)...» + продолжения
 *     «...успехов | ...тIайлабацIу хьуннав» → склеиваются ОБЕ стороны:
 *     «Желаю вам (тебе) успехов → Зун (вин) тIайлабацIу хьуннав».
 *     Сама основа отдельной записью не сохраняется — это неполная фраза.
 *  3. Продолжение «...это не моя вина...» без основы (предыдущая фраза полная) —
 *     самостоятельная фраза, многоточия убираются.
 */
export function rowsToPairs(rows: HtmlRow[]): Pair[] {
  const out: Pair[] = [];
  let heading: string | null = null; // «Тетя:» — русский заголовок без перевода
  let stem: Pair | null = null; // основа с многоточием
  let stemUsed = false;
  let lastRu: string | null = null; // русская часть последней полной фразы — для «(жен.)»

  // Основа без продолжений — всё-таки полная фраза, не теряем её
  const flushStem = () => {
    if (stem && !stemUsed) out.push({ ru: oneLine(stripEllipses(stem.ru)), lak: oneLine(stripEllipses(stem.lak)) });
    stem = null;
    stemUsed = false;
  };

  for (const row of rows) {
    const pair = rowPair(row);
    if (!pair) continue;
    const { ru, lak } = pair;
    if (!ru && !lak) continue;
    if (/©/.test(ru) || /©/.test(lak)) continue; // подвал страницы

    const child = isChildRow(row);

    // Заголовок без перевода — ждём строки с отступом
    if (!child && ru && !lak) {
      flushStem();
      heading = ru;
      lastRu = null;
      continue;
    }
    if (!ru || !lak) continue; // одна сторона пустая — пропуск

    const continuation = startsWithEllipsis(ru) && startsWithEllipsis(lak);

    if (stem && (continuation || child)) {
      out.push({ ru: combine(stem.ru, ru), lak: combine(stem.lak, lak) });
      stemUsed = true;
      continue;
    }
    if (heading && child) {
      out.push({ ru: combineHeading(heading, ru), lak: oneLine(stripEllipses(lak)) });
      continue;
    }

    // «Я согласен → Ттун рязи ур», затем «(жен.) → Ттун рязи бур»
    if (/^\(.*\)$/.test(ru) && lastRu) {
      out.push({ ru: `${lastRu} ${ru}`, lak: oneLine(stripEllipses(lak)) });
      continue;
    }

    heading = null;
    flushStem();

    const isStem =
      !startsWithEllipsis(ru) && !startsWithEllipsis(lak) && endsWithEllipsis(ru) && endsWithEllipsis(lak);
    if (isStem) {
      stem = { ru, lak };
      continue;
    }

    const full = { ru: oneLine(stripEllipses(ru)), lak: oneLine(stripEllipses(lak)) };
    out.push(full);
    lastRu = full.ru.replace(/\s*\((?:муж|м)\.?\)\s*$/, "");
  }

  flushStem();
  return out;
}

function pairsToEntries(chapter: number, pairs: Pair[]): DigievEntry[] {
  const entries: DigievEntry[] = [];
  const seen = new Set<string>();

  for (const { ru: rawRu, lak: rawLak } of pairs) {
    let ru = rawRu;

    // «1 один» → «один (1)»; строку «| 0 ноль» без русской стороны отсекли раньше
    if (chapter === NUMERALS_CHAPTER) {
      const m = ru.match(/^(\d+)\s+(.+)$/);
      if (m) ru = `${m[2]} (${m[1]})`;
    }

    const senses = splitNumberedSenses(rawLak).map((s) => toLakCanonical(s));
    const translation = oneLine(ru);
    if (!translation) continue;
    const groupId = senses.length > 1 ? translation.toLowerCase() : null;

    senses.forEach((lemma, index) => {
      if (!lemma) return;
      const key = `${lemma.toLowerCase()}\0${translation.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      entries.push({
        lemma,
        translation,
        notes: null,
        wordType: classifyWordType(chapter, translation, lemma),
        translationPriority: index + 1,
        synonymGroupId: groupId
      });
    });
  }
  return entries;
}

// ─── Главы ───────────────────────────────────────────────────────────────────

function sectionTitle(rows: HtmlRow[]): { ru: string; lak: string | null } | null {
  for (const row of rows) {
    const headers = row.cells.filter((c) => c.isHeader).map((c) => oneLine(c.text)).filter(Boolean);
    if (headers.length) return { ru: headers[0], lak: headers[1] ?? null };
  }
  return null;
}

/**
 * Разбирает HTML разговорника на главы и пары RU|Лак.
 * Лакская сторона приводится к канону (палочка → Ӏ).
 */
export function parseDigievHtml(html: string): DigievChapter[] {
  const toc = parseTableOfContents(html);
  const parts = html.split(/<a\s+name="(glava\d+)"\s*>\s*<\/a>/i);
  const chapters: DigievChapter[] = [];

  for (let i = 1; i < parts.length; i += 2) {
    const chapter = Number.parseInt((parts[i] ?? "").replace(/\D/g, ""), 10);
    if (!Number.isFinite(chapter) || chapter < 1 || NAME_LIST_CHAPTERS.has(chapter)) continue;

    const tables = extractLeafTables(parts[i + 1] ?? "");
    const rows = tables.flatMap((t) => t.rows);
    const title = sectionTitle(rows) ?? toc.get(chapter) ?? { ru: "Без названия", lak: null };
    const entries = pairsToEntries(chapter, rowsToPairs(rows));
    if (!entries.length) continue;

    chapters.push({
      chapter,
      slug: digievCollectionSlug(chapter, title.ru),
      titleRu: title.ru,
      titleLak: title.lak ? toLakCanonical(title.lak) : null,
      phrases: entries
    });
  }

  return chapters.sort((a, b) => a.chapter - b.chapter);
}

/** Плоский список записей для импорта в БД. */
export function chaptersToImportRecords(chapters: DigievChapter[]): DigievRecord[] {
  return chapters.flatMap((ch) => {
    const description = ch.titleLak ? `${ch.titleLak} · Дигиев, гл. ${ch.chapter}` : `Дигиев, гл. ${ch.chapter}`;
    return ch.phrases.map((p) => ({
      ...p,
      collectionSlug: ch.slug,
      collectionTitle: ch.titleRu,
      collectionTitleLak: ch.titleLak,
      collectionDescription: description,
      collectionSortOrder: ch.chapter,
      collectionKind: "topic" as const,
      chapter: ch.chapter
    }));
  });
}
