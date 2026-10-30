/**
 * CLI: словарь учебника «Лакку дуниял» → SQL-сид.
 *
 *   npm run parse:lakku-dunial            — разобрать parse/lakku_dunial_dictionary.txt, статистика
 *   npm run parse:lakku-dunial -- --seed  — записать db/seeds/lakku_dunial.sql
 *
 * parse/lakku_dunial_dictionary.txt — текст алфавитного словаря из PDF книги
 * (pdftotext -layout, без номеров страниц). Разбор статьи: src/lib/import/lakkuDunial.ts.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseLakkuDunialDictionary } from "../src/lib/import/lakkuDunial.ts";
import { buildLakkuDunialSeedSql, lakkuDunialRows } from "../src/lib/import/lakkuDunialSeed.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(__dirname, "lakku_dunial_dictionary.txt");
const SEED_FILE = path.join(__dirname, "..", "db", "seeds", "lakku_dunial.sql");

const entries = parseLakkuDunialDictionary(fs.readFileSync(SOURCE, "utf8"));
const rows = lakkuDunialRows(entries);
const count = (f: (r: (typeof rows)[number]) => unknown) => rows.filter(f).length;

console.log(`Статей: ${entries.length}, пар «слово — значение»: ${rows.length}`);
console.log(`  существительных: ${count((r) => r.partOfSpeech === "Сущ.")}, глаголов: ${count((r) => r.partOfSpeech === "Глаг.")}`);
console.log(`  с классом: ${count((r) => r.lakClass)}, с мн. числом: ${count((r) => r.plural)}, с формами: ${count((r) => r.forms)}`);

if (process.argv.includes("--seed")) {
  fs.writeFileSync(SEED_FILE, buildLakkuDunialSeedSql(rows));
  console.log(`Готово: ${path.relative(process.cwd(), SEED_FILE)}`);
}
