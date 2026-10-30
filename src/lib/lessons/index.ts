/**
 * Все уроки курса. Содержание — в content/lessons/*.json (правится там же).
 * Новый урок: добавить файл, импорт ниже и пересобрать сид: npm run lessons:seed.
 */

import type { Lesson, LessonMeta } from "./types.ts";
import l01 from "../../../content/lessons/01.json" with { type: "json" };
import l02 from "../../../content/lessons/02.json" with { type: "json" };
import l03 from "../../../content/lessons/03.json" with { type: "json" };
import l04 from "../../../content/lessons/04.json" with { type: "json" };
import l05 from "../../../content/lessons/05.json" with { type: "json" };
import l06 from "../../../content/lessons/06.json" with { type: "json" };
import l07 from "../../../content/lessons/07.json" with { type: "json" };
import l08 from "../../../content/lessons/08.json" with { type: "json" };
import l09 from "../../../content/lessons/09.json" with { type: "json" };
import l10 from "../../../content/lessons/10.json" with { type: "json" };
import l11 from "../../../content/lessons/11.json" with { type: "json" };
import l12 from "../../../content/lessons/12.json" with { type: "json" };
import l13 from "../../../content/lessons/13.json" with { type: "json" };
import l14 from "../../../content/lessons/14.json" with { type: "json" };
import l15 from "../../../content/lessons/15.json" with { type: "json" };
import l16 from "../../../content/lessons/16.json" with { type: "json" };
import l17 from "../../../content/lessons/17.json" with { type: "json" };
import l18 from "../../../content/lessons/18.json" with { type: "json" };

export const LESSONS: Lesson[] = ([
  l01, l02, l03, l04, l05, l06, l07, l08, l09,
  l10, l11, l12, l13, l14, l15, l16, l17, l18
] as unknown as Lesson[]).sort(
  (a, b) => a.number - b.number
);

/** Учебник, по которому построены уроки */
export const LESSON_SOURCE = {
  title: "«Лакку дуниял»",
  author: "С. Мусаев, лакская редакция ГТРК «Дагестан»"
};

/** Части курса — для списка уроков */
export const LESSON_PARTS = [
  { title: "Часть 1 · Первые шаги", from: 1, to: 9 },
  { title: "Часть 2 · Время, природа, люди", from: 10, to: 18 }
];

export function getLesson(number: number): Lesson | null {
  return LESSONS.find((l) => l.number === number) ?? null;
}

export function lessonMeta(lesson: Lesson): LessonMeta {
  return {
    number: lesson.number,
    title: lesson.title,
    titleLak: lesson.titleLak,
    goal: lesson.goal,
    sounds: lesson.sounds,
    wordCount: lesson.words.length,
    stepCount: lesson.steps.length
  };
}

export function lessonSlug(number: number): string {
  return `lesson-${String(number).padStart(2, "0")}`;
}
