/**
 * CLI: «Русско-лакский разговорник» Дигиева → JSON / SQL-сид.
 *
 *   npm run parse:digiev                 — разобрать parse/lak.html, показать статистику
 *   npm run parse:digiev -- --dry-run    — то же + примеры записей
 *   npm run parse:digiev -- --seed       — записать db/seeds/digiev_phrasebook.sql
 *   npm run parse:digiev -- --from-file путь/к/странице.html
 *
 * Импорт в БД: сид применяется автоматически скриптом db/migrate.sh при
 * `docker compose up` (только если файл изменился). Прямой записи в БД
 * из CLI больше нет — так данные одинаковы на любой машине и в любой среде.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  chaptersToImportRecords,
  parseDigievHtml
} from "../src/lib/import/digievPhrasebook.ts";
import { buildDigievSeedSql } from "../src/lib/import/digievSeed.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE = path.join(__dirname, "lak.html");
const OUTPUT_FILE = path.join(__dirname, "digiev_phrasebook.json");
const SEED_FILE = path.join(__dirname, "..", "db", "seeds", "digiev_phrasebook.sql");

function readHtml(fromFile: string | null): string {
  const file = fromFile ? (path.isAbsolute(fromFile) ? fromFile : path.join(process.cwd(), fromFile)) : DEFAULT_FILE;
  if (!fs.existsSync(file)) {
    throw new Error(
      `Нет файла ${file}. Сохраните страницу https://lakkumaz.narod.ru/russko-lakskiy_razgovornik_digiev.html как parse/lak.html`
    );
  }
  console.log(`\n📄 ${file}`);
  return fs.readFileSync(file, "utf8");
}

function main(): void {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const seed = args.includes("--seed");
  const fromIdx = args.indexOf("--from-file");
  const fromFile = fromIdx >= 0 ? args[fromIdx + 1] ?? null : null;

  if (args.includes("--direct")) {
    throw new Error("--direct больше не поддерживается: используйте --seed, затем docker compose up -d --build");
  }

  console.log("══════════════════════════════════════════════════════════");
  console.log("  lak-learn: разговорник Дигиева → темы, слова и фразы");
  console.log("══════════════════════════════════════════════════════════");

  const chapters = parseDigievHtml(readHtml(fromFile));
  if (!chapters.length) throw new Error("Ничего не найдено");
  const records = chaptersToImportRecords(chapters);

  const words = records.filter((r) => r.wordType === "word").length;
  console.log(`\n📖 Глав:    ${chapters.length}`);
  console.log(`🔤 Слов:    ${words}`);
  console.log(`💬 Фраз:    ${records.length - words}`);

  console.log("\nГлавы по числу записей:");
  for (const ch of [...chapters].sort((a, b) => b.phrases.length - a.phrases.length).slice(0, 10)) {
    console.log(`  ${String(ch.chapter).padStart(3)}. ${ch.titleRu} — ${ch.phrases.length}`);
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ chapters, records }, null, 2), "utf8");
  console.log(`\n💾 ${OUTPUT_FILE}`);

  if (dryRun) {
    for (const n of [1, 7, 92]) {
      const ch = chapters.find((c) => c.chapter === n);
      if (!ch) continue;
      console.log(`\n  [${ch.slug}] ${ch.titleRu}`);
      for (const p of ch.phrases.slice(0, 5)) {
        console.log(`    [${p.wordType}] «${p.translation}» → «${p.lemma}»`);
      }
    }
  }

  if (seed) {
    fs.mkdirSync(path.dirname(SEED_FILE), { recursive: true });
    fs.writeFileSync(SEED_FILE, buildDigievSeedSql(chapters, records), "utf8");
    console.log(`\n🌱 ${SEED_FILE}`);
    console.log("   Применится при следующем запуске: docker compose up -d --build");
  } else {
    console.log("\n💡 Сгенерировать сид для БД: npm run parse:digiev -- --seed");
  }
}

try {
  main();
} catch (err) {
  console.error(`\n❌ ${(err as Error).message}`);
  process.exit(1);
}
