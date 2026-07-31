/**
 * CLI: Русско-лакский разговорник Дигиева → JSON / прямой импорт в БД.
 *
 *   npm run parse:digiev -- --dry-run
 *   npm run parse:digiev -- --from-file parse/lak.html
 *   npm run parse:digiev -- --direct
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  chaptersToImportRecords,
  parseDigievHtml,
  type DigievPhrase
} from "../src/lib/import/digievPhrasebook.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE = path.join(__dirname, "lak.html");
const OUTPUT_FILE = path.join(__dirname, "digiev_phrasebook.json");
const SOURCE_URL =
  "https://lakkumaz.narod.ru/russko-lakskiy_razgovornik_digiev.html";

function loadEnv(): void {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

async function fetchHtml(fromFile: string | null): Promise<string> {
  if (fromFile) {
    const full = path.isAbsolute(fromFile) ? fromFile : path.join(process.cwd(), fromFile);
    console.log(`\n📄 Читаем файл: ${full}`);
    return fs.readFileSync(full, "utf8");
  }

  if (fs.existsSync(DEFAULT_FILE)) {
    console.log(`\n📄 Локальный файл: ${DEFAULT_FILE}`);
    return fs.readFileSync(DEFAULT_FILE, "utf8");
  }

  console.log(`\n📥 Загружаем: ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL, {
    headers: { "User-Agent": "lak-learn-parser/1.0" }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.text();
}

function dedupeForDb(words: DigievPhrase[]): DigievPhrase[] {
  const map = new Map<string, DigievPhrase>();
  for (const w of words) {
    const lemma = w.lemma.trim();
    const translation = w.translation.trim();
    if (!lemma || !translation) continue;
    const key = `${lemma.toLowerCase()}\0${translation.toLowerCase()}`;
    const prev = map.get(key);
    if (!prev || w.collectionSortOrder < prev.collectionSortOrder) {
      map.set(key, w);
    }
  }
  return [...map.values()];
}

async function importDirect(words: DigievPhrase[]): Promise<void> {
  loadEnv();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL не задан в .env");

  const deduped = dedupeForDb(words);
  console.log(`\n🧹 Уникальных пар lemma+translation: ${deduped.length} (из ${words.length})`);

  const pg = await import("pg");
  const pool = new pg.default.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const colMap = new Map<string, DigievPhrase>();
    for (const w of words) {
      if (w.collectionSlug && !colMap.has(w.collectionSlug)) {
        colMap.set(w.collectionSlug, w);
      }
    }

    const collectionIdBySlug = new Map<string, number>();
    for (const [slug, w] of colMap) {
      const res = await client.query<{ id: number }>(
        `
          INSERT INTO collections (slug, title, description, level, is_public, sort_order, kind)
          VALUES ($1, $2, $3, NULL, TRUE, $4, 'topic')
          ON CONFLICT (slug) DO UPDATE
            SET title = EXCLUDED.title,
                description = EXCLUDED.description,
                sort_order = EXCLUDED.sort_order,
                kind = 'topic',
                is_public = TRUE,
                is_active = TRUE,
                updated_at = NOW()
          RETURNING id
        `,
        [slug, w.collectionTitle, w.collectionDescription, w.collectionSortOrder]
      );
      collectionIdBySlug.set(slug, res.rows[0].id);
    }
    console.log(`📚 Коллекций (тем): ${collectionIdBySlug.size}`);

    // Map every phrase (including duplicates across chapters) to its chapter collection
    // Re-link using original words list for multi-collection membership
    let added = 0;
    let updated = 0;
    let skipped = 0;
    let linked = 0;
    const BATCH = 400;

    // First upsert all unique words
    const wordIdByKey = new Map<string, number>();
    for (let i = 0; i < deduped.length; i += BATCH) {
      const batch = deduped.slice(i, i + BATCH);
      for (const w of batch) {
        const lemma = w.lemma.trim();
        const translation = w.translation.trim();
        if (!lemma || !translation) {
          skipped += 1;
          continue;
        }

        const ins = await client.query<{ id: number; xmax: string }>(
          `
            INSERT INTO words
              (lemma, translation, transcription, part_of_speech,
               gender, verb_aspect, word_type, notes, image_url,
               translation_priority, synonym_group_id)
            VALUES (
              $1::text, $2::text, NULL, NULL,
              NULL, NULL, 'phrase', $3::text, NULL,
              1, NULL
            )
            ON CONFLICT (lemma, translation) DO UPDATE SET
              word_type = 'phrase',
              notes = COALESCE(EXCLUDED.notes, words.notes),
              updated_at = NOW()
            RETURNING id, xmax
          `,
          [lemma, translation, w.notes]
        );

        const row = ins.rows[0];
        if (!row) {
          skipped += 1;
          continue;
        }
        if (row.xmax === "0") added += 1;
        else updated += 1;

        wordIdByKey.set(`${lemma.toLowerCase()}\0${translation.toLowerCase()}`, row.id);
      }
      process.stdout.write(
        `\r   Слова: батч ${Math.floor(i / BATCH) + 1}/${Math.ceil(deduped.length / BATCH)} | +${added} ~${updated}`
      );
    }

    // Link each phrase to its chapter collection (is_manual=TRUE for word counts)
    console.log("");
    for (const w of words) {
      const key = `${w.lemma.trim().toLowerCase()}\0${w.translation.trim().toLowerCase()}`;
      const wordId = wordIdByKey.get(key);
      const cid = collectionIdBySlug.get(w.collectionSlug);
      if (!wordId || !cid) continue;
      await client.query(
        `
          INSERT INTO collection_words (word_id, collection_id, is_manual, is_excluded)
          VALUES ($1, $2, TRUE, FALSE)
          ON CONFLICT (collection_id, word_id) DO UPDATE
            SET is_manual = TRUE, is_excluded = FALSE, updated_at = NOW()
        `,
        [wordId, cid]
      );
      linked += 1;
    }

    await client.query(
      `
        INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, payload)
        VALUES (NULL, $1, $2, $3, $4)
      `,
      [
        "admin.words.bulk_import",
        "word",
        "bulk",
        JSON.stringify({
          source: "digiev_phrasebook",
          added,
          updated,
          skipped,
          linked,
          collections: collectionIdBySlug.size
        })
      ]
    );

    await client.query("COMMIT");
    console.log(
      `\n✅ Импорт: +${added} слов, ~${updated} обновлено, связей ${linked}, тем ${collectionIdBySlug.size}`
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const direct = args.includes("--direct");
  const fromIdx = args.indexOf("--from-file");
  const fromFile = fromIdx >= 0 ? args[fromIdx + 1] ?? null : null;

  console.log("══════════════════════════════════════════════════════════");
  console.log("  lak-learn: разговорник Дигиева → темы + фразы");
  console.log("══════════════════════════════════════════════════════════");

  const html = await fetchHtml(fromFile);
  const chapters = parseDigievHtml(html);
  const words = chaptersToImportRecords(chapters);

  if (!chapters.length) throw new Error("Ничего не найдено");

  console.log(`\n📖 Глав:   ${chapters.length}`);
  console.log(`💬 Фраз:   ${words.length}`);

  const top = [...chapters]
    .sort((a, b) => b.phrases.length - a.phrases.length)
    .slice(0, 8);
  console.log("\nТоп тем по числу фраз:");
  for (const ch of top) {
    console.log(`  ${String(ch.chapter).padStart(3)}. ${ch.titleRu} — ${ch.phrases.length}`);
  }

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify({ chapters, words }, null, 2),
    "utf8"
  );
  console.log(`\n💾 ${OUTPUT_FILE}`);

  if (dryRun) {
    console.log("\n🔍 Примеры (гл. 1 и 77):");
    for (const n of [1, 77]) {
      const ch = chapters.find((c) => c.chapter === n);
      if (!ch) continue;
      console.log(`\n  [${ch.slug}] ${ch.titleRu}`);
      for (const p of ch.phrases.slice(0, 5)) {
        console.log(`    «${p.translation}» → «${p.lemma}»`);
      }
    }
    console.log("\n✅ Dry-run. Импорт: npm run parse:digiev -- --direct");
    return;
  }

  if (direct) {
    await importDirect(words);
    return;
  }

  console.log("\n💡 Импорт в БД: npm run parse:digiev -- --direct");
}

main().catch((err: Error) => {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
});
