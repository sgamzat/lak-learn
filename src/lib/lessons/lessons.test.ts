import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LESSONS, getLesson } from "./index.ts";
import { validateLesson } from "./validate.ts";
import { buildLessonsSeedSql } from "./seed.ts";
import { buildQuiz, countExercises, examplesFor, isOrderCorrect, orderTokens } from "./exercises.ts";
import type { QuizStep } from "./types.ts";

describe("содержание уроков", () => {
  it("уроки идут по порядку без пропусков", () => {
    expect(LESSONS.map((l) => l.number)).toEqual(LESSONS.map((_, i) => i + 1));
  });

  it("в уроках нет ошибок", () => {
    expect(LESSONS.flatMap(validateLesson)).toEqual([]);
  });

  it("сид db/seeds/lessons.sql собран из текущих уроков (npm run lessons:seed)", () => {
    const file = readFileSync(new URL("../../../db/seeds/lessons.sql", import.meta.url), "utf8");
    expect(file === buildLessonsSeedSql(LESSONS)).toBe(true);
  });
});

describe("собрать фразу", () => {
  it("слова без знаков препинания", () => {
    expect(orderTokens("За бакъар. Вила ци иш бур?")).toEqual(["За", "бакъар", "Вила", "ци", "иш", "бур"]);
    expect(orderTokens("А – хӀарпри.")).toEqual(["А", "хӀарпри"]);
  });

  it("проверка не зависит от регистра и палочки", () => {
    expect(isOrderCorrect(["бивзрав", "инагу"], "Бивзрав инагу!")).toBe(true);
    expect(isOrderCorrect(["Ттун", "цIа", "Шуаьнатри"], "Ттун цӀа Шуаьнатри.")).toBe(true);
    expect(isOrderCorrect(["инагу", "Бивзрав"], "Бивзрав инагу!")).toBe(false);
  });
});

describe("квиз", () => {
  const lesson = getLesson(1)!;
  const step = lesson.steps.find((s): s is QuizStep => s.type === "quiz")!;

  it("одинаковый при одинаковом зерне, правильный ответ среди вариантов", () => {
    const a = buildQuiz(lesson, step, 42);
    const b = buildQuiz(lesson, step, 42);
    expect(a).toEqual(b);
    expect(a).toHaveLength(step.count!);
    for (const q of a) {
      expect(q.options.length).toBe(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options[q.answer]).toBe(q.promptIsLak ? q.word.ru : q.word.lak);
    }
  });

  it("во всех уроках: 4 разных варианта, а в парах — разные переводы", () => {
    for (const l of LESSONS) {
      l.steps.forEach((s, i) => {
        if (s.type === "quiz") {
          for (const q of buildQuiz(l, s, l.number * 1000 + i)) {
            expect(`${l.number}:${q.word.lak}:${new Set(q.options).size}`).toBe(`${l.number}:${q.word.lak}:4`);
          }
        }
        if (s.type === "match") {
          const ru = s.words.map((w) => l.words.find((x) => x.lak === w)!.ru);
          expect(`${l.number}:${new Set(ru).size}`).toBe(`${l.number}:${ru.length}`);
        }
      });
    }
  });

  it("счёт заданий: квиз считается по вопросам", () => {
    const simple = lesson.steps.filter((s) => ["choice", "order", "match"].includes(s.type)).length;
    expect(countExercises(lesson)).toBe(simple + step.count!);
  });
});

describe("примеры к словам", () => {
  it("берутся из фраз урока, где слово стоит целиком", () => {
    const lesson = getLesson(1)!;
    const word = lesson.words.find((w) => w.lak === "инагу")!;
    const ex = examplesFor(lesson, word);
    expect(ex.length).toBeGreaterThan(0);
    for (const e of ex) expect(e.lak.toLowerCase()).toContain("инагу");
  });
});
