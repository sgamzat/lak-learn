/**
 * CLI: «Русско-лакский школьный словарь» 1958 → JSON / SQL-сид.
 *
 * Спека: docs/import-1958.md
 * Извлечение статей: src/lib/import/slovar1958Html.ts, разбор статьи: slovar1958.ts
 *
 *   npm run parse:1958                 — разобрать parse/slovar_1958.html, показать статистику
 *   npm run parse:1958 -- --dry-run    — то же + примеры
 *   npm run parse:1958 -- --seed       — записать db/seeds/slovar_1958.sql
 *   npm run parse:1958 -- --from-file путь/к/странице.html
 *
 * Импорт в БД: сид применяется db/migrate.sh при `docker compose up`
 * (только если файл изменился). Прямой записи в БД (--direct) больше нет.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ImportWordRecord } from "../src/lib/import/slovar1958.ts";
import { parseSlovar1958Html } from "../src/lib/import/slovar1958Html.ts";
import { buildSlovar1958SeedSql } from "../src/lib/import/slovar1958Seed.ts";
import { isJunkEntry } from "../src/lib/import/junk.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_URL = "https://lakkumaz.narod.ru/orus_mazral_va_lakku_mazral_shkolalul_slovar.html";
const DEFAULT_FILE = path.join(__dirname, "slovar_1958.html");
const OUTPUT_FILE = path.join(__dirname, "slovar_1958.json");
const SEED_FILE = path.join(__dirname, "..", "db", "seeds", "slovar_1958.sql");

function readHtml(fromFile: string | null): string {
  const file = fromFile ? (path.isAbsolute(fromFile) ? fromFile : path.join(process.cwd(), fromFile)) : DEFAULT_FILE;
  if (!fs.existsSync(file)) {
    throw new Error(`Нет файла ${file}. Сохраните страницу ${SOURCE_URL} как parse/slovar_1958.html`);
  }
  console.log(`\n📄 ${file}`);
  return fs.readFileSync(file, "utf8");
}

function printStats(words: ImportWordRecord[]): void {
  const byPos: Record<string, number> = {};
  for (const w of words) byPos[w.partOfSpeech || "(нет)"] = (byPos[w.partOfSpeech || "(нет)"] || 0) + 1;
  console.log("\n🏷️  По частям речи:");
  for (const [pos, count] of Object.entries(byPos).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(count).padStart(5)}  ${pos}`);
  }
  console.log(`\n🔗 priority=1 (слова): ${words.filter((w) => w.translationPriority === 1 && w.wordType === "word").length}`);
  console.log(`   priority>1:         ${words.filter((w) => w.translationPriority > 1).length}`);
  console.log(`   phrases:            ${words.filter((w) => w.wordType === "phrase").length}`);
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.includes("--direct")) {
    throw new Error("--direct больше не поддерживается: используйте --seed, затем docker compose up -d --build");
  }
  const dryRun = args.includes("--dry-run");
  const seed = args.includes("--seed");
  const fromIdx = args.indexOf("--from-file");
  const fromFile = fromIdx >= 0 ? args[fromIdx + 1] ?? null : null;

  console.log("══════════════════════════════════════════════════════════");
  console.log("  lak-learn: словарь 1958 → учебные атомы");
  console.log("══════════════════════════════════════════════════════════");

  const parsed = parseSlovar1958Html(readHtml(fromFile));
  if (!parsed.length) throw new Error("Ничего не найдено");

  // Отсев ошибок парсера: помета вместо слова («несов», «Союз»),
  // обрезок вместо перевода («п»). Правила — src/lib/import/junk.ts
  const words = parsed.filter((w) => !isJunkEntry(w));
  console.log(`\n📚 Записей: ${words.length} (отброшено ошибочных: ${parsed.length - words.length})`);

  printStats(words);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(words, null, 2), "utf8");
  console.log(`\n💾 ${OUTPUT_FILE}`);

  if (dryRun) {
    console.log("\n🔍 Первые 15:");
    for (const [i, w] of words.slice(0, 15).entries()) {
      console.log(`  ${String(i + 1).padStart(2)}. [${w.wordType}] «${w.translation}» → «${w.lemma}»`);
    }
  }

  if (seed) {
    fs.mkdirSync(path.dirname(SEED_FILE), { recursive: true });
    fs.writeFileSync(SEED_FILE, buildSlovar1958SeedSql(words), "utf8");
    console.log(`\n🌱 ${SEED_FILE}`);
    console.log("   Применится при следующем запуске: docker compose up -d --build");
  } else {
    console.log("\n💡 Сгенерировать сид для БД: npm run parse:1958 -- --seed");
  }
}

try {
  main();
} catch (err) {
  console.error(`\n❌ ${(err as Error).message}`);
  process.exit(1);
}
