/**
 * Логика упражнений урока — без React, чтобы её можно было проверить тестами.
 */

import { lakAnswerKey } from "../lak/variants.ts";
import { makeCloze } from "../lak/cloze.ts";
import type { Lesson, LessonWord, QuizStep, LakLine } from "./types.ts";
import { EXERCISE_TYPES } from "./types.ts";

/** Детерминированный генератор: одинаковый порядок при каждом показе шага */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rand: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Перемешать так, чтобы порядок отличался от исходного (если это возможно) */
export function shuffleNotIdentity<T>(items: T[], rand: () => number, same: (a: T[], b: T[]) => boolean): T[] {
  if (items.length < 2) return [...items];
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const out = shuffle(items, rand);
    if (!same(out, items)) return out;
  }
  return [...items.slice(1), items[0]];
}

export function wordMap(lesson: Lesson): Map<string, LessonWord> {
  return new Map(lesson.words.map((w) => [w.lak, w]));
}

// ── Собрать фразу ────────────────────────────────────────────────────────────

/** Слова фразы без знаков препинания: «За бакъар. Вила ци иш бур?» → 6 слов */
export function orderTokens(answer: string): string[] {
  return answer
    .split(/\s+/)
    .map((t) => t.replace(/^[«"(–—-]+|[.,!?;:»")]+$/g, ""))
    .filter((t) => t.length > 0 && !/^[–—-]$/.test(t));
}

export function isOrderCorrect(chosen: string[], answer: string): boolean {
  return lakAnswerKey(chosen.join(" ")) === lakAnswerKey(orderTokens(answer).join(" "));
}

// ── Вопросы «выберите перевод» ───────────────────────────────────────────────

export type QuizQuestion = {
  /** Что показываем: лакское слово или перевод */
  prompt: string;
  promptIsLak: boolean;
  options: string[];
  answer: number;
  word: LessonWord;
};

export function buildQuiz(lesson: Lesson, step: QuizStep, seed: number): QuizQuestion[] {
  const rand = seededRandom(seed);
  const map = wordMap(lesson);
  const pool = step.words.map((w) => map.get(w)).filter((w): w is LessonWord => Boolean(w));
  const count = Math.min(step.count ?? pool.length, pool.length);
  const picked = shuffle(pool, rand).slice(0, count);

  return picked.map((word, index) => {
    const promptIsLak = index % 2 === 0;
    const sameKind = lesson.words.filter((w) => w.lak !== word.lak && (w.kind ?? "word") === (word.kind ?? "word"));
    const others = sameKind.length >= 3 ? sameKind : lesson.words.filter((w) => w.lak !== word.lak);
    const value = (w: LessonWord) => (promptIsLak ? w.ru : w.lak);
    const correct = value(word);
    const distractors: string[] = [];
    for (const w of shuffle(others, rand)) {
      const v = value(w);
      if (v !== correct && !distractors.includes(v)) distractors.push(v);
      if (distractors.length === 3) break;
    }
    const options = shuffle([correct, ...distractors], rand);
    return {
      prompt: promptIsLak ? word.lak : word.ru,
      promptIsLak,
      options,
      answer: options.indexOf(correct),
      word
    };
  });
}

// ── Счёт ─────────────────────────────────────────────────────────────────────

/** Сколько «заданий» в уроке: вопрос квиза — каждый отдельно, остальное — по одному */
export function countExercises(lesson: Lesson): number {
  return lesson.steps.reduce((sum, step) => {
    if (step.type === "quiz") return sum + Math.min(step.count ?? step.words.length, step.words.length);
    return sum + (EXERCISE_TYPES.has(step.type) ? 1 : 0);
  }, 0);
}

// ── Примеры для словаря ──────────────────────────────────────────────────────

/** Все лакские фразы урока с переводом — кандидаты в примеры к словам */
export function lessonLines(lesson: Lesson): LakLine[] {
  const out: LakLine[] = [];
  for (const step of lesson.steps) {
    if (step.type === "dialogue") out.push(...step.lines);
    if (step.type === "text") out.push(...step.sentences);
    if (step.type === "rule" && step.examples) out.push(...step.examples);
  }
  return out.filter((l) => l.ru && !l.ru.startsWith("["));
}

/** До двух самых коротких фраз урока, где слово встречается целиком */
export function examplesFor(lesson: Lesson, word: LessonWord, limit = 2): LakLine[] {
  const seen = new Set<string>();
  return lessonLines(lesson)
    .filter((line) => {
      const key = lakAnswerKey(line.lak);
      if (seen.has(key) || key === lakAnswerKey(word.lak)) return false;
      seen.add(key);
      return makeCloze(`${line.lak} — x`, [word.lak]).lak !== null;
    })
    .sort((a, b) => a.lak.length - b.lak.length)
    .slice(0, limit);
}
