/**
 * CLI: Русско-лакский школьный словарь 1958 → JSON / прямой импорт в БД.
 *
 * Спека: docs/import-1958.md
 * Парсер: src/lib/import/slovar1958.ts
 *
 *   npm run parse:1958 -- --dry-run
 *   npm run parse:1958 -- --from-file path/to.html
 *   npm run parse:1958 -- --direct
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import {
  parseEntry,
  type ImportWordRecord
} from "../src/lib/import/slovar1958.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_URL = "https://lakkumaz.narod.ru/orus_mazral_va_lakku_mazral_shkolalul_slovar.html";
const OUTPUT_FILE = path.join(__dirname, "slovar_1958.json");

function loadEnv(): void {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) {
      continue;
    }
    const eq = t.indexOf("=");
    if (eq < 0) {
      continue;
    }
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) {
      process.env[k] = v;
    }
  }
}

/** <b><i>для кого</i></b> перед тире — оборот внутри статьи, не заголовок. */
function isInlineIdiomBold(el: cheerio.Element, $: cheerio.CheerioAPI): boolean {
  const $el = $(el);
  const onlyItalic =
    $el.contents().toArray().every((child) => {
      if (child.type === "text") {
        return !String(child.data || "").trim();
      }
      return child.type === "tag" && (child.name === "i" || child.name === "em");
    }) && $el.find("i, em").length > 0;

  if (!onlyItalic) {
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = el.nextSibling;
  let guard = 0;
  while (node && guard < 4) {
    if (node.type === "text") {
      const t = String(node.data || "");
      if (/[—–−]/.test(t) || /\s-\s/.test(t)) {
        return true;
      }
      if (t.trim()) {
        return false;
      }
    } else if (node.type === "tag") {
      return false;
    }
    node = node.nextSibling;
    guard += 1;
  }
  return false;
}

/** Вторая лемма в паре сов./несов. в одном <p>. */
function isSecondaryAspectHeadword(el: cheerio.Element, $: cheerio.CheerioAPI): boolean {
  // Вторая форма сама должна иметь помету вида
  if (!peekAspectAfterBold(el, $)) {
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = el.previousSibling;
  let guard = 0;
  while (node && guard < 12) {
    if (node.type === "text") {
      const t = String(node.data || "");
      if (t.trim() && !/^[,\s]+$/.test(t)) {
        return false;
      }
    } else if (node.type === "tag") {
      const name = String(node.name || "");
      if (name === "em" || name === "i") {
        const t = $(node).text();
        if (!/сов|несов|однокр/i.test(t)) {
          return false;
        }
      } else if (name === "strong" || name === "b") {
        return true;
      } else {
        return false;
      }
    }
    node = node.previousSibling;
    guard += 1;
  }
  return false;
}

function extractBodyAfterBold(el: cheerio.Element, $: cheerio.CheerioAPI): string {
  let body = "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = el.nextSibling;
  let steps = 0;

  while (node && steps < 80) {
    if (node.type === "text") {
      body += node.data || "";
    } else if (node.type === "tag") {
      const name = String(node.name || "");
      if (name === "em" || name === "i") {
        const hasNestedBold = $(node).find("strong, b").length > 0;
        body += hasNestedBold ? ` ${$(node).text()} ` : ` ${$(node).text()} `;
      } else if (name === "strong" || name === "b") {
        const pairAspect = peekAspectAfterBold(node, $);
        if (pairAspect) {
          // Текст уже может содержать «, » перед этим <b> — не дублируем запятую
          body += ` ${$(node).text()} ${pairAspect.aspect}`;
          node = pairAspect.resumeAfter;
          steps += 1;
          continue;
        }
        // Inline-идиома <b><i>…</i></b> — продолжаем ту же статью
        if (isInlineIdiomBold(node, $)) {
          body += ` ${$(node).text()} `;
          node = node.nextSibling;
          steps += 1;
          continue;
        }
        break;
      } else if (name === "br" || name === "p") {
        break;
      } else {
        body += $(node).text() || "";
      }
    }
    node = node.nextSibling;
    steps += 1;
  }

  return body.replace(/^\s*[.,]\s*/, "").trim();
}

/** Если после соседнего <b> идёт вид глагола — это продолжение той же статьи. */
function peekAspectAfterBold(
  boldEl: cheerio.Element,
  $: cheerio.CheerioAPI
): { aspect: string; resumeAfter: cheerio.Element | null } | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = boldEl.nextSibling;
  let guard = 0;
  while (node && guard < 6) {
    if (node.type === "text") {
      const t = String(node.data || "");
      if (t.trim() && !/^[,\s]+$/.test(t)) {
        return null;
      }
    } else if (node.type === "tag") {
      const name = String(node.name || "");
      if (name === "em" || name === "i") {
        const t = $(node).text().trim();
        if (/сов|несов|однокр/i.test(t)) {
          return { aspect: t, resumeAfter: node.nextSibling };
        }
        return null;
      }
      return null;
    }
    node = node.nextSibling;
    guard += 1;
  }
  return null;
}

function parseHtml(html: string): ImportWordRecord[] {
  // Основной корпус начинается с алфавита; предисловие с примерами пропускаем
  const marker = html.search(/ОЬРУС\s+АЛФАВИТ/i);
  const corpus = marker >= 0 ? html.slice(marker) : html;

  const $ = cheerio.load(corpus);
  const words: ImportWordRecord[] = [];
  const seen = new Set<string>();
  let entries = 0;

  $("strong, b").each((_, el) => {
    const $el = $(el);
    if ($el.parents("strong, b").length > 0) {
      return;
    }
    // Идиомы: <i><b>…</b></i> или <b><i>…</i></b> — не отдельные статьи
    if ($el.parents("i, em").length > 0) {
      return;
    }
    if (isInlineIdiomBold(el, $)) {
      return;
    }
    // Вторая форма пары «добавить сов., добавлять несов.» — не отдельная статья
    if (isSecondaryAspectHeadword(el, $)) {
      return;
    }

    const russian = $el
      .text()
      .replace(/\u0301/g, "")
      .replace(/́/g, "")
      .trim();

    if (!russian || russian.length < 1) {
      return;
    }
    if (/^[А-ЯЁ\s\-–—]+$/.test(russian) && russian.length > 15) {
      return;
    }
    if (!/^[А-ЯЁа-яёA-Za-zIӀӏ]/.test(russian)) {
      return;
    }
    if (/^(оьрус|русско|словарь|составитель|редактор|даг|алфавит)/i.test(russian)) {
      return;
    }

    const body = extractBodyAfterBold(el, $);
    if (!body) {
      return;
    }

    const records = parseEntry({ headword: russian, body });
    if (!records.length) {
      return;
    }

    entries += 1;
    for (const record of records) {
      const key = `${record.lemma.toLowerCase()}\0${record.translation.toLowerCase()}\0${record.synonymGroupId ?? ""}\0${record.wordType}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      words.push(record);
    }
  });

  console.log(`   Статей с разбором: ${entries}`);
  console.log(`   Записей:           ${words.length}`);
  return words;
}

async function fetchHtml(fromFile: string | null): Promise<string> {
  if (fromFile) {
    const full = path.isAbsolute(fromFile) ? fromFile : path.join(process.cwd(), fromFile);
    console.log(`\n📄 Читаем файл: ${full}`);
    return fs.readFileSync(full, "utf8");
  }

  console.log(`\n📥 Загружаем: ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL, {
    headers: { "User-Agent": "lak-learn-parser/1.0" }
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  const html = await res.text();
  console.log(`   Размер HTML: ${(html.length / 1024).toFixed(1)} KB`);
  return html;
}

function printStats(words: ImportWordRecord[]): void {
  const byPos: Record<string, number> = {};
  for (const w of words) {
    const pos = w.partOfSpeech || "(нет)";
    byPos[pos] = (byPos[pos] || 0) + 1;
  }
  console.log("\n🏷️  По частям речи:");
  for (const [pos, count] of Object.entries(byPos).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(count).padStart(5)}  ${pos}`);
  }

  const pri1 = words.filter((w) => w.translationPriority === 1 && w.wordType === "word").length;
  const syn = words.filter((w) => w.translationPriority > 1).length;
  const phrases = words.filter((w) => w.wordType === "phrase").length;
  console.log(`\n🔗 priority=1 (слова): ${pri1}`);
  console.log(`   priority>1:         ${syn}`);
  console.log(`   phrases:            ${phrases}`);
}

async function importDirect(words: ImportWordRecord[]): Promise<void> {
  loadEnv();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL не задан в .env");
  }

  // В БД UNIQUE (lemma, translation) — оставляем лучшую запись на пару
  const deduped = dedupeForDb(words);
  console.log(`\n🧹 Уникальных пар lemma+translation: ${deduped.length} (из ${words.length})`);

  const pg = await import("pg");
  const pool = new pg.default.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const colMap = new Map<string, ImportWordRecord>();
    for (const w of deduped) {
      if (w.collectionSlug && !colMap.has(w.collectionSlug)) {
        colMap.set(w.collectionSlug, w);
      }
    }

    const collectionIdBySlug = new Map<string, number>();
    for (const [slug, w] of colMap) {
      const res = await client.query<{ id: number }>(
        `
          INSERT INTO collections (slug, title, description, level, is_public, sort_order, kind)
          VALUES ($1, $2, $3, NULL, TRUE, $4, 'alphabet')
          ON CONFLICT (slug) DO UPDATE
            SET title = EXCLUDED.title,
                description = EXCLUDED.description,
                sort_order = EXCLUDED.sort_order,
                kind = 'alphabet',
                updated_at = NOW()
          RETURNING id
        `,
        [slug, w.collectionTitle, w.collectionDescription, w.collectionSortOrder]
      );
      collectionIdBySlug.set(slug, res.rows[0].id);
    }
    console.log(`📚 Коллекций: ${collectionIdBySlug.size}`);

    const BATCH = 400;
    let added = 0;
    let updated = 0;
    let skipped = 0;

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
              $1::text,
              $2::text,
              $3::text,
              $4::text,
              $5::varchar(4),
              $6::varchar(8),
              $7::varchar(8),
              $8::text,
              $9::text,
              $10::smallint,
              $11::varchar(255)
            )
            ON CONFLICT (lemma, translation) DO UPDATE SET
              transcription = EXCLUDED.transcription,
              part_of_speech = COALESCE(EXCLUDED.part_of_speech, words.part_of_speech),
              gender = COALESCE(EXCLUDED.gender, words.gender),
              verb_aspect = COALESCE(EXCLUDED.verb_aspect, words.verb_aspect),
              word_type = EXCLUDED.word_type,
              notes = EXCLUDED.notes,
              image_url = COALESCE(EXCLUDED.image_url, words.image_url),
              translation_priority = EXCLUDED.translation_priority,
              synonym_group_id = COALESCE(EXCLUDED.synonym_group_id, words.synonym_group_id),
              updated_at = NOW()
            RETURNING id, xmax
          `,
          [
            lemma,
            translation,
            w.transcription,
            w.partOfSpeech,
            w.gender,
            w.verbAspect,
            w.wordType,
            w.notes,
            w.imageUrl,
            w.translationPriority,
            w.synonymGroupId
          ]
        );

        const row = ins.rows[0];
        if (!row) {
          skipped += 1;
          continue;
        }

        // xmax = 0 у свежего INSERT; иначе это был UPDATE
        if (row.xmax === "0") {
          added += 1;
        } else {
          updated += 1;
        }

        const cid = collectionIdBySlug.get(w.collectionSlug);
        if (cid) {
          await client.query(
            `
              INSERT INTO collection_words (word_id, collection_id, is_manual, is_excluded)
              VALUES ($1, $2, FALSE, FALSE)
              ON CONFLICT (collection_id, word_id) DO NOTHING
            `,
            [row.id, cid]
          );
        }
      }
      process.stdout.write(
        `\r   Батч ${Math.floor(i / BATCH) + 1}/${Math.ceil(deduped.length / BATCH)} | +${added} ~${updated} / skip ${skipped}`
      );
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
        JSON.stringify({ source: "slovar_1958_v5", added, updated, skipped })
      ]
    );

    await client.query("COMMIT");
    console.log(`\n\n✅ Импорт: добавлено ${added}, обновлено ${updated}, пропущено ${skipped}`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

/** Одна запись на UNIQUE (lemma, translation): word > phrase, меньший priority. */
function dedupeForDb(words: ImportWordRecord[]): ImportWordRecord[] {
  const map = new Map<string, ImportWordRecord>();

  for (const w of words) {
    const lemma = w.lemma.trim();
    const translation = w.translation.trim();
    if (!lemma || !translation) {
      continue;
    }
    const key = `${lemma.toLowerCase()}\0${translation.toLowerCase()}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, w);
      continue;
    }

    const score = (r: ImportWordRecord) =>
      (r.wordType === "word" ? 0 : 10) + r.translationPriority + (r.notes ? 0 : 0.1);

    if (score(w) < score(prev)) {
      map.set(key, w);
    } else if (score(w) === score(prev) && w.notes && !prev.notes) {
      map.set(key, w);
    }
  }

  return [...map.values()];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const direct = args.includes("--direct");
  const fromIdx = args.indexOf("--from-file");
  const fromFile = fromIdx >= 0 ? args[fromIdx + 1] ?? null : null;

  console.log("══════════════════════════════════════════════════════════");
  console.log("  lak-learn: словарь 1958 → учебные атомы (v5)");
  console.log("══════════════════════════════════════════════════════════");

  const html = await fetchHtml(fromFile);
  const words = parseHtml(html);
  if (!words.length) {
    throw new Error("Ничего не найдено");
  }

  printStats(words);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(words, null, 2), "utf8");
  console.log(`\n💾 ${OUTPUT_FILE} (${words.length} записей)`);

  if (dryRun) {
    console.log("\n🔍 Первые 15:");
    for (const [i, w] of words.slice(0, 15).entries()) {
      console.log(
        `  ${String(i + 1).padStart(2)}. [${w.wordType}] "${w.lemma}" → "${w.translation}"` +
          (w.synonymGroupId ? `  {${w.synonymGroupId} p${w.translationPriority}}` : "")
      );
    }
    console.log("\n✅ Dry-run. Импорт: npm run parse:1958 -- --direct");
    return;
  }

  if (direct) {
    await importDirect(words);
    return;
  }

  console.log("\n💡 Импорт в БД: npm run parse:1958 -- --direct");
}

main().catch((err: Error) => {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
});
