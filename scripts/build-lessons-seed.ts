/**
 * Собирает db/seeds/lessons.sql из content/lessons/*.json.
 * Запуск: npm run lessons:seed
 */

import { writeFileSync } from "node:fs";
import { LESSONS } from "../src/lib/lessons/index.ts";
import { validateLesson } from "../src/lib/lessons/validate.ts";
import { buildLessonsSeedSql } from "../src/lib/lessons/seed.ts";

const errors = LESSONS.flatMap(validateLesson);
if (errors.length > 0) {
  console.error("Ошибки в уроках:\n" + errors.map((e) => "  • " + e).join("\n"));
  process.exit(1);
}

const out = new URL("../db/seeds/lessons.sql", import.meta.url);
writeFileSync(out, buildLessonsSeedSql(LESSONS));
console.log(`Готово: ${LESSONS.length} уроков → db/seeds/lessons.sql`);
