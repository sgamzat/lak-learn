/**
 * Парсер алфавитного словаря учебника «Лакку дуниял» (С. Мусаев):
 * parse/lakku_dunial_dictionary.txt — текст словаря из PDF книги.
 *
 * Формат статьи:
 *   тIахIни III (тIахIунттул, тIахIунтту, тIахIунттал) – посуда
 *   ажар(и) II (-ттул, -тту, -ттал) – петух
 *   агьалий [ăгьа:ли:] (-нал) – народ, население
 *   лишин (ливхьуну II, лирхьуну III; лиша) – вытереть, протереть
 *   чаху III (-лул, -рду, -рдал) – 1) пелерина; 2) воротник для шубы
 *
 *   класс — I, II, III, IV (у существительных; у глаголов — форма класса);
 *   в круглых скобках у существительных — родительный падеж, множественное
 *   число и родительный множественного; у глаголов — деепричастие и повелительное;
 *   в квадратных — транскрипция.
 */

import { toLakCanonical } from "../lak/alphabet.ts";

export type LakkuDunialEntry = {
  lemma: string;
  /** Значения: «1) пелерина; 2) воротник» → два значения */
  senses: string[];
  /** 1–4, если указан один класс */
  lakClass: number | null;
  /** Формы как в книге: «тIахIунттул, тIахIунтту, тIахIунттал» */
  forms: string | null;
  /** Множественное число, если его можно восстановить из форм */
  plural: string | null;
  transcription: string | null;
  /**
   * Что записал в транскрипцию прежний парсер (первые квадратные скобки строки,
   * в том числе внутри форм: «цIу II (цIил [цIи:л])» → «цIи:л»). Сид исправляет такие записи.
   */
  legacyTranscription: string | null;
  partOfSpeech: "noun" | "verb" | null;
  wordType: "word" | "phrase";
  line: number;
};

const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4 };
const DASH_RE = /\s[–-]\s/;
const CLASS_RE = /(?:^|\s)((?:IV|I{1,3})(?:\s*,\s*(?:IV|I{1,3}))*)(?=\s|$|\(|\[)/;
const CYR = "А-Яа-яЁёӀӏI";

/** Склеить статьи, перенесённые на следующую строку */
export function joinEntryLines(text: string): { text: string; line: number }[] {
  const out: { text: string; line: number }[] = [];
  const lines = text.split(/\r?\n/);
  const unbalanced = (s: string) =>
    (s.match(/\(/g)?.length ?? 0) > (s.match(/\)/g)?.length ?? 0) ||
    (s.match(/\[/g)?.length ?? 0) > (s.match(/\]/g)?.length ?? 0);

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || /^\d+$/.test(line) || /^[А-ЯЁ]$/.test(line) || line === "СЛОВАРЬ") return;
    const prev = out.at(-1);
    // «(щицӀун-бунугу) бакӀ бахӀин – связать судьбу» — отдельная статья, а не продолжение
    const continues = /^\(/.test(line) && !DASH_RE.test(prev?.text ?? "");
    if (prev && (unbalanced(prev.text) || /[,–-]$/.test(prev.text) || continues)) {
      prev.text = `${prev.text} ${line}`.replace(/\s+/g, " ");
      return;
    }
    out.push({ text: line, line: i + 1 });
  });
  return out;
}

/** «1) пелерина; 2) воротник для шубы» → ["пелерина", "воротник для шубы"] */
export function splitSenses(translation: string): string[] {
  const t = translation.replace(/\s[–-]\s*\d+\s*$/, "").trim();
  if (/(^|\s)1\)/.test(t)) {
    return t
      .split(/(?:^|;?\s*)\d\)\s*/)
      .map((s) => s.replace(/[;,.\s]+$/, "").trim())
      .filter(Boolean);
  }
  return t ? [t.replace(/[;.\s]+$/, "")] : [];
}

function looksLikeVerb(senses: string[]): boolean {
  const first = senses[0]?.split(/[,;(]/)[0]?.trim().split(/\s+/)[0] ?? "";
  return /(ть|ться|чь|чься|ти)$/i.test(first);
}

/**
 * Множественное число из форм существительного (род. ед., мн., род. мн.):
 *   «ажар(и)», «-ттул, -тту, -ттал» → «ажартту»
 *   «адимина», «адиминал, арамтал, арамтурал» → «арамтал»
 */
export function pluralFromForms(lemma: string, forms: string): string | null {
  const parts = forms.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 3) return null;
  const pl = parts[1];
  const stem = lemma.replace(/\([^)]*\)$/, "");
  if (pl.startsWith("-")) {
    const suffix = pl.slice(1).trim();
    return /^[А-Яа-яЁёӀӏ]+$/.test(suffix) ? stem + suffix : null;
  }
  // Полная форма: длинная или начинается как само слово («уссурвал»); «ртту» без дефиса — опечатка
  if (!/^[А-Яа-яЁёӀӏ]+$/.test(pl)) return null;
  if (pl.length >= 5 || pl[0].toLowerCase() === stem[0]?.toLowerCase()) return pl;
  return null;
}

export function parseEntry(text: string, line = 0): LakkuDunialEntry | null {
  const canonical = toLakCanonical(text);
  const m = DASH_RE.exec(canonical);
  if (!m) return null; // без перевода
  let head = canonical.slice(0, m.index).trim();
  const senses = splitSenses(canonical.slice(m.index + m[0].length));
  if (senses.length === 0) return null;

  // Названия в кавычках («Азаллий ца хьхьу»), суффиксы («-хьуви») — не слова
  if (/^[«"-]/.test(head)) return null;
  const legacyTranscription = head.match(/\[([^\]]+)\]/)?.[1]?.trim() ?? null;

  // Формы в скобках, отделённых пробелом; «ажар(и)» — необязательное окончание, оставляем.
  // Транскрипция внутри форм («цIил [цIи:л]») относится к форме, а не к слову — убираем
  let forms: string | null = null;
  head = head.replace(/\s\(([^)]*)\)/g, (_, inner: string) => {
    if (!forms) forms = inner.replace(/\s*\[[^\]]*\]/g, "").trim();
    return " ";
  });

  const transcription = head.match(/\[([^\]]+)\]/)?.[1]?.trim() ?? null;
  head = head.replace(/\[[^\]]*\]/g, " ");

  let lakClass: number | null = null;
  const cls = CLASS_RE.exec(head);
  if (cls) {
    const list = cls[1].split(",").map((c) => c.trim());
    lakClass = list.length === 1 ? ROMAN[list[0]] ?? null : null;
    head = head.slice(0, cls.index) + " " + head.slice(cls.index + cls[0].length);
  }
  // Класс иногда стоит и внутри форм у глаголов: «ливхьуну II» — это не класс слова
  const lemma = head.replace(/\s+/g, " ").replace(/\s*,\s*$/, "").trim();
  if (!lemma || !new RegExp(`[${CYR}]`).test(lemma)) return null;
  // Обрывки перенесённых строк: «бяххан (бявххуну;»
  if ((lemma.match(/\(/g)?.length ?? 0) !== (lemma.match(/\)/g)?.length ?? 0)) return null;
  if (/^[)\]]/.test(senses[0])) return null;

  const verb = looksLikeVerb(senses);
  const formsText = forms as string | null;
  const formList = formsText ? formsText.split(/[,;]/).map((f) => f.trim()).filter(Boolean) : [];
  // Существительное узнаём по формам: окончания «-лул, -рду» или родительный падеж на -л
  // («бургъил»). Класс без форм бывает и у глаголов-связок («бур II — есть»),
  // и у прилагательных («бювчӀусса II») — такой класс не переносим.
  const nounForms =
    formList.some((f) => f.startsWith("-")) ||
    formList.length === 3 ||
    (formList.length >= 1 && /^[А-Яа-яЁёӀӏ]+л$/.test(formList[0]));
  const singleWord = !/\s/.test(lemma);
  const partOfSpeech = verb ? "verb" : nounForms && singleWord ? "noun" : null;

  return {
    lemma,
    senses,
    lakClass: partOfSpeech === "noun" ? lakClass : null,
    forms: formsText,
    plural: partOfSpeech === "noun" && formsText ? pluralFromForms(lemma, formsText) : null,
    transcription,
    legacyTranscription,
    partOfSpeech,
    wordType: /\s/.test(lemma.replace(/\([^)]*\)/g, "")) ? "phrase" : "word",
    line
  };
}

/** Каноническая лемма для словаря: «ажар(и)» → «ажари» */
export function displayLemma(lemma: string): string {
  return lemma.replace(/\(([^)]*)\)/g, "$1");
}

export function parseLakkuDunialDictionary(text: string): LakkuDunialEntry[] {
  return joinEntryLines(text)
    .map((e) => parseEntry(e.text, e.line))
    .filter((e): e is LakkuDunialEntry => e !== null);
}
