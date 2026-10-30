/**
 * Проверка содержания урока. Запускается тестами (lessons.test.ts), чтобы
 * опечатка в JSON не сломала урок у ученика.
 */

import { toLakCanonical } from "../lak/alphabet.ts";
import type { Lesson } from "./types.ts";
import { orderTokens } from "./exercises.ts";

const STEP_TYPES = new Set(["intro", "sound", "dialogue", "text", "rule", "words", "choice", "order", "match", "quiz", "summary"]);

export function validateLesson(lesson: Lesson): string[] {
  const errors: string[] = [];
  const where = (i: number) => `урок ${lesson.number}, шаг ${i + 1}`;
  const words = new Set<string>();

  if (!lesson.title || !lesson.goal) errors.push(`урок ${lesson.number}: нет названия или цели`);

  for (const w of lesson.words) {
    if (!w.lak.trim() || !w.ru.trim()) errors.push(`урок ${lesson.number}: пустое слово «${w.lak}»`);
    if (words.has(w.lak)) errors.push(`урок ${lesson.number}: слово «${w.lak}» повторяется`);
    words.add(w.lak);
    if (w.cls && !["I", "II", "III"].includes(w.cls)) errors.push(`урок ${lesson.number}: класс «${w.cls}» у «${w.lak}»`);
  }

  // Палочка везде должна быть канонической (Ӏ), иначе слова не совпадут со словарём
  const json = JSON.stringify(lesson);
  if (toLakCanonical(json) !== json) errors.push(`урок ${lesson.number}: палочка записана латинской I или цифрой 1`);

  const known = (list: string[] | undefined, i: number) => {
    for (const w of list ?? []) if (!words.has(w)) errors.push(`${where(i)}: слова «${w}» нет в списке слов урока`);
  };

  lesson.steps.forEach((step, i) => {
    if (!STEP_TYPES.has(step.type)) {
      errors.push(`${where(i)}: неизвестный тип «${(step as { type: string }).type}»`);
      return;
    }
    switch (step.type) {
      case "words":
        known(step.words, i);
        break;
      case "match":
        known(step.words, i);
        if (step.words.length < 3) errors.push(`${where(i)}: в сопоставлении меньше трёх слов`);
        break;
      case "quiz":
        known(step.words, i);
        if (step.words.length < 4) errors.push(`${where(i)}: в квизе меньше четырёх слов`);
        break;
      case "choice":
        if (step.answer < 0 || step.answer >= step.options.length) errors.push(`${where(i)}: ответ вне вариантов`);
        if (new Set(step.options).size !== step.options.length) errors.push(`${where(i)}: варианты повторяются`);
        break;
      case "order": {
        const n = orderTokens(step.answer).length;
        if (n < 2 || n > 9) errors.push(`${where(i)}: во фразе «${step.answer}» ${n} слов (нужно 2–9)`);
        break;
      }
      case "dialogue":
        if (step.lines.length === 0) errors.push(`${where(i)}: пустой диалог`);
        break;
      case "text":
        if (step.sentences.length === 0) errors.push(`${where(i)}: пустой текст`);
        break;
      default:
        break;
    }
  });

  if (lesson.steps.at(-1)?.type !== "summary") errors.push(`урок ${lesson.number}: последний шаг должен быть summary`);
  if (!lesson.steps.some((s) => s.type === "words")) errors.push(`урок ${lesson.number}: нет шага со словами`);

  return errors;
}
