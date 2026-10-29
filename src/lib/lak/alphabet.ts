/**
 * Лакский алфавит и работа с палочкой (Ӏ).
 *
 * ВАЖНО: те же правила реализованы в SQL (db/migrations/011_lak_alphabet.sql:
 * lak_canonical, lak_search_key, lak_first_letter, lak_sort_key). Меняя здесь —
 * меняйте и там; тест src/lib/lak/alphabet.test.ts фиксирует общие примеры.
 */

/** Каноническая палочка в хранимом тексте — U+04C0 (Ӏ), как в печатных изданиях. */
export const PALOCHKA = "Ӏ";
/** Палочка в ключах поиска и сравнения (строчная форма) — U+04CF (ӏ). */
export const PALOCHKA_KEY = "ӏ";

/**
 * Буквы лакского алфавита в порядке словаря (строчные, палочка = U+04CF).
 * Порядок сверен по словарю 1958 г.: хьхь есть (208 слов на эту букву),
 * гӏ и уь в лакской орфографии не встречаются.
 */
export const LAK_ALPHABET = [
  "а", "аь", "б", "в", "г", "гъ", "гь", "д", "е", "ё", "ж", "з", "и", "й",
  "к", "кк", "къ", "кь", "кӏ", "л", "м", "н", "о", "оь", "п", "пп", "пӏ", "р",
  "с", "сс", "т", "тт", "тӏ", "у", "ф", "х", "хх", "хъ", "хь", "хьхь", "хӏ",
  "ц", "цц", "цӏ", "ч", "чч", "чӏ", "ш", "щ", "ъ", "ы", "ь", "э", "ю", "я"
] as const;

export type LakLetter = (typeof LAK_ALPHABET)[number];

const LETTER_INDEX = new Map<string, number>(LAK_ALPHABET.map((l, i) => [l, i]));

// Самые длинные буквы первыми: «хьхь» раньше «хь», «хь» раньше «х»
const LETTERS_LONGEST_FIRST = [...LAK_ALPHABET].sort((a, b) => b.length - a.length);

// Символы, которыми на практике набирают палочку:
// латинские I, i, L, l, цифра 1, вертикальная черта, украинские І/і, строчная и прописная Ӏ/ӏ.
// Строчная i встречается в разговорнике Дигиева («пIяй, чIапIи») и на клавиатуре телефона.
const PALOCHKA_VARIANTS = "IiLl1|ІіӏӀ";
const CYRILLIC_LETTER = "А-Яа-яЁё";

// Палочка — только сразу после кириллической буквы: «кIа», «танмих1».
// Отдельно стоящие числа («1000 ват», «1 несов») не трогаем.
const CONTEXT_PALOCHKA_RE = new RegExp(`([${CYRILLIC_LETTER}])[${PALOCHKA_VARIANTS}]`, "g");
const ANY_PALOCHKA_RE = new RegExp(`[${PALOCHKA_VARIANTS}]`, "g");
const STRESS_RE = /[̀́́]/g;
const SPACES_RE = /\s+/g;

/**
 * Каноническая запись для хранения и показа: палочка → Ӏ (U+04C0).
 * Регистр и остальной текст не меняются.
 */
export function toLakCanonical(text: string): string {
  return text.normalize("NFC").replace(CONTEXT_PALOCHKA_RE, `$1${PALOCHKA}`);
}

/**
 * Ключ для поиска: канонизация, нижний регистр, палочка → ӏ,
 * без ударений и лишних пробелов. Совпадает с SQL lak_search_key().
 */
export function lakSearchKey(text: string): string {
  return toLakCanonical(text)
    .normalize("NFD")
    .replace(STRESS_RE, "")
    .normalize("NFC")
    .toLowerCase()
    .replaceAll(PALOCHKA, PALOCHKA_KEY)
    .replace(SPACES_RE, " ")
    .trim();
}

/**
 * Нестрогий ключ для сравнения ответа ученика с лакским словом: любой
 * вариант палочки считается палочкой, где бы он ни стоял. Подходит и для
 * отдельных символов (посимвольное выравнивание ответа).
 */
export function lakLooseKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(STRESS_RE, "")
    .normalize("NFC")
    .replace(ANY_PALOCHKA_RE, PALOCHKA_KEY)
    .toLowerCase()
    .replace(SPACES_RE, " ")
    .trim();
}

/**
 * Разбивает слово на буквы лакского алфавита (самое длинное совпадение первым).
 * Символы вне алфавита (пробел, дефис, цифры) возвращаются как есть.
 */
export function splitLakLetters(text: string): string[] {
  const key = lakSearchKey(text);
  const result: string[] = [];
  let i = 0;
  while (i < key.length) {
    const letter = LETTERS_LONGEST_FIRST.find((l) => key.startsWith(l, i));
    if (letter) {
      result.push(letter);
      i += letter.length;
    } else {
      result.push(key[i]);
      i += 1;
    }
  }
  return result;
}

/** Первая буква слова по лакскому алфавиту или null (слово начинается с цифры, скобки…). */
export function lakFirstLetter(text: string): LakLetter | null {
  const first = splitLakLetters(text)[0];
  return first !== undefined && LETTER_INDEX.has(first) ? (first as LakLetter) : null;
}

/**
 * Ключ сортировки: номера букв по лакскому алфавиту. Совпадает с SQL lak_sort_key().
 * Пробел = 0 (короткое слово раньше словосочетания), буквы = 1..N,
 * прочие символы — после всех букв, по коду символа.
 */
export function lakSortKey(text: string): number[] {
  return splitLakLetters(text).map((part) => {
    if (part === " ") return 0;
    const index = LETTER_INDEX.get(part);
    return index !== undefined ? index + 1 : 1000 + (part.codePointAt(0) ?? 0);
  });
}

/** Сравнение для Array.prototype.sort по лакскому алфавиту. */
export function compareLak(a: string, b: string): number {
  const ka = lakSortKey(a);
  const kb = lakSortKey(b);
  const len = Math.min(ka.length, kb.length);
  for (let i = 0; i < len; i += 1) {
    if (ka[i] !== kb[i]) return ka[i] - kb[i];
  }
  return ka.length - kb.length;
}

/** Буква для показа в интерфейсе: «кӏ» → «КӀ», «хьхь» → «Хьхь». */
export function displayLetter(letter: string): string {
  const canonical = letter.replaceAll(PALOCHKA_KEY, PALOCHKA);
  return canonical.charAt(0).toUpperCase() + canonical.slice(1);
}
