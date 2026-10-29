/**
 * Пример с пропуском для упражнения на ввод: «Ва ___ ппури — Это мой отец».
 *
 * Пример на карточке — «лакская фраза — перевод». В упражнении «Как по-лакски?»
 * лакская фраза содержит само искомое слово и подсказывает ответ. Слово
 * заменяется пропуском; если его не удалось найти (другая форма слова) — лакская
 * часть скрывается совсем, остаётся только перевод.
 */

import { lakAnswerKey } from "./variants.ts";

export const CLOZE_GAP = "___";

export type ClozeResult = {
  /** Лакская часть с пропуском или null, если её пришлось скрыть */
  lak: string | null;
  /** Русский перевод примера (если был) */
  translation: string | null;
};

/** «Ва ттул ппури — Это мой отец» → ["Ва ттул ппури", "Это мой отец"] */
export function splitExample(example: string): { lak: string; translation: string | null } {
  const i = example.indexOf(" — ");
  if (i < 0) return { lak: example.trim(), translation: null };
  return { lak: example.slice(0, i).trim(), translation: example.slice(i + 3).trim() || null };
}

/**
 * @param example  «лакская фраза — перевод»
 * @param answers  варианты ответа (lakAnswerVariants), например ["ттул"]
 */
export function makeCloze(example: string, answers: string[]): ClozeResult {
  const { lak, translation } = splitExample(example);
  const tokens = lak.split(/(\s+)/); // сохраняем пробелы
  const keyOf = (t: string) => lakAnswerKey(t);

  // Ищем самый длинный вариант ответа как последовательность слов
  const targets = answers
    .map((a) => a.split(/\s+/).map(keyOf).filter(Boolean))
    .filter((t) => t.length > 0)
    .sort((a, b) => b.length - a.length);

  const words = tokens.map((t, i) => ({ i, key: /\s/.test(t) ? null : keyOf(t) })).filter((w) => w.key !== null);

  for (const target of targets) {
    for (let start = 0; start + target.length <= words.length; start += 1) {
      const match = target.every((k, j) => words[start + j].key === k);
      if (!match) continue;
      const first = words[start].i;
      const last = words[start + target.length - 1].i;
      // Знаки препинания у краёв слова сохраняем: «ттул,» → «___,»
      const lead = tokens[first].match(/^[^А-Яа-яЁёӀӏIl1|]*/)?.[0] ?? "";
      const trail = tokens[last].match(/[^А-Яа-яЁёӀӏIl1|]*$/)?.[0] ?? "";
      const out = [...tokens.slice(0, first), `${lead}${CLOZE_GAP}${trail}`, ...tokens.slice(last + 1)].join("");
      return { lak: out, translation };
    }
  }

  return { lak: null, translation };
}
