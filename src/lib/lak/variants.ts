/**
 * Варианты правильного ответа для лакского слова или фразы.
 *
 * В источниках формы записаны прямо в тексте:
 *   «лечлан, лечин»               — варианты через запятую (часто видовая пара)
 *   «инжит уллан (буллан)»        — классная форма вместо предыдущего слова
 *   «вил (зул) дакӀнин …»         — «твой (ваш)»: альтернатива слову перед скобкой
 *   «Къаоьвчинна (занг къаданна)» — альтернатива всему, что перед скобкой
 *   «буси(яра)»                   — необязательное окончание: «буси» или «бусияра»
 *   «Хъинну бикӀи (множ. чис.)»   — помета, не часть ответа
 *
 * Ученик в упражнении на ввод не должен набирать скобки, запятые и знаки
 * препинания: засчитывается любой из вариантов (см. lakAnswerKey).
 */

import { lakLooseKey } from "./alphabet.ts";

const MAX_VARIANTS = 16;

// Слова-реплики: «нет, спасибо» — это фраза, а не два варианта
const DISCOURSE_WORDS = new Set(["нет", "да", "спасибо", "пожалуйста", "хорошо", "ладно", "конечно", "извините", "простите"]);

function words(s: string): string[] {
  return s.trim().split(/\s+/).filter(Boolean);
}

/** Делит по запятым/точкам с запятой вне скобок: «микӀ (бичайсса, …), …» */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if ((ch === "," || ch === ";") && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current.trim());
  return parts.filter(Boolean);
}

/** Непарные скобки (ошибки распознавания текста) убираем */
function balanceParentheses(text: string): string {
  let depth = 0;
  let out = "";
  for (const ch of text) {
    if (ch === "(") {
      depth += 1;
      out += ch;
    } else if (ch === ")") {
      if (depth === 0) continue;
      depth -= 1;
      out += ch;
    } else {
      out += ch;
    }
  }
  if (depth === 0) return out;
  // Незакрытые «(» — убираем саму скобку, текст оставляем
  return out.replace(/\((?![^()]*\))/g, " ");
}

function isMark(inside: string): boolean {
  // «(ж.)», «(мн.ч.)», «(множ. чис.)», «(к муж.)»: короткие слова с точками
  return /\./.test(inside) && words(inside).every((w) => w.length <= 6 || /\.$/.test(w));
}

function expandParentheses(text: string): string[] {
  const m = text.match(/^(.*?)(\s*)\(([^()]*)\)(.*)$/);
  if (!m) return [text.trim()];
  const [, before, gap, inside, after] = m;
  const tails = expandParentheses(after);
  const heads: string[] = [];

  if (isMark(inside) || !inside.trim()) {
    heads.push(before.trim());
  } else if (!gap && /[А-Яа-яЁёӀӏ]$/.test(before)) {
    // «ба(ра)» — необязательное окончание
    heads.push(before.trim(), `${before}${inside.trim()}`.trim());
  } else {
    const beforeWords = words(before);
    const insideWords = words(inside);
    heads.push(beforeWords.join(" "));
    const keep = Math.max(0, beforeWords.length - insideWords.length);
    heads.push([...beforeWords.slice(0, keep), ...insideWords].join(" "));
  }

  const out: string[] = [];
  for (const head of heads) {
    for (const tail of tails) {
      out.push(`${head} ${tail}`.replace(/\s+/g, " ").trim());
      if (out.length >= MAX_VARIANTS) return out;
    }
  }
  return out;
}

/** Делить ли запятые на варианты: «лечлан, лечин» — да, «юх, барчаллагь» — нет */
function commaMeansVariants(lemma: string, translation: string): boolean {
  const lakParts = splitTopLevel(lemma);
  if (lakParts.length < 2) return false;
  if (lakParts.some((p) => words(p.replace(/\([^)]*\)/g, " ")).length > 3)) return false;
  const ruParts = translation.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean);
  if (ruParts.length < 2) return true; // «воробей → чӀелму, шярлу»
  // «бегать, бежать → лечлан, лечин» — параллельные варианты; «нет, спасибо» — реплика
  return ruParts.every((p) => words(p).length === 1 && !DISCOURSE_WORDS.has(p.replace(/[!?.]/g, "")));
}

/**
 * Все допустимые варианты ответа (первый — основной, как в источнике без скобок).
 */
export function lakAnswerVariants(
  lemma: string,
  options: { wordType?: "word" | "phrase"; translation?: string } = {}
): string[] {
  const text = balanceParentheses(lemma);
  const splitCommas = (options.wordType ?? "word") === "word" && commaMeansVariants(text, options.translation ?? "");
  const parts = splitCommas ? splitTopLevel(text) : [text];

  const seen = new Set<string>();
  const result: string[] = [];
  const add = (variant: string) => {
    const clean = variant.replace(/\s+([!?.,;:])/g, "$1").replace(/\s+/g, " ").trim();
    const key = lakAnswerKey(clean);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(clean);
  };

  // Всегда принимаем и запись целиком (без скобок)
  for (const v of expandParentheses(text)) add(v);
  if (splitCommas) for (const part of parts) for (const v of expandParentheses(part)) add(v);

  return (result.length ? result : [lemma.trim()]).slice(0, MAX_VARIANTS);
}

/**
 * Ключ сравнения ответа: любой вариант палочки, без регистра, ударений
 * и знаков препинания. «Цукун ура?» = «цукун ура».
 */
export function lakAnswerKey(text: string): string {
  return lakLooseKey(text.replace(/[!?.,;:«»"“”„—–-]+/g, " "));
}
