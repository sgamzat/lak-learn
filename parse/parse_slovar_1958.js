#!/usr/bin/env node

/**
 * Парсер Русско-лакского школьного словаря (1958) — версия 4
 * Источник: https://lakkumaz.narod.ru/orus_mazral_va_lakku_mazral_shkolalul_slovar.html
 * Составитель: Гаджиев Г.М., ~14 500 слов
 *
 * Использование:
 *   node parse_slovar_1958.js --dry-run
 *   node parse_slovar_1958.js --direct
 *
 * Требования: npm install node-fetch cheerio pg
 *
 * Что нового в v4:
 *   - translation_priority: первый лакский перевод = 1 (в SRS), остальные 2,3... (справка)
 *   - synonym_group_id: связывает все переводы одного русского слова
 */

const fs   = require("fs");
const path = require("path");

const SOURCE_URL  = "https://lakkumaz.narod.ru/orus_mazral_va_lakku_mazral_shkolalul_slovar.html";
const OUTPUT_FILE = path.join(__dirname, "slovar_1958.json");

// ─────────────────────────────────────────────────────────────────────────────
// СТОП-СЛОВА для lemma
// ─────────────────────────────────────────────────────────────────────────────
const LEMMA_STOPWORDS = new Set([
  "нет", "мн", "ед", "ср", "мн.", "ед.", "ср.",
  "см", "см.", "дахх", "дахх.", "тж", "тж.",
  "и", "в", "на", "с", "по", "за", "от", "до", "из", "к",
]);

function isStopLemma(w) {
  if (!w) return true;
  const lower = w.toLowerCase().trim();
  if (LEMMA_STOPWORDS.has(lower)) return true;
  if (/^[а-яё]{1,2}\.?$/.test(lower)) return true;
  if (/^[—–\-]/.test(w)) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// ИЗВЛЕЧЕНИЕ РОД, ВИД, ПОМЕТЫ, ЧАСТЬ РЕЧИ
// ─────────────────────────────────────────────────────────────────────────────
function extractGender(posRaw) {
  if (!posRaw) return null;
  const s = " " + posRaw.toLowerCase() + " ";
  if (/[\s,]ср\.[\s,;)]/.test(s) || s.includes(" ср. ")) return "ср";
  if (/[\s,]ж\.[\s,;)]/.test(s)  || s.includes(" ж. "))  return "ж";
  if (/[\s,]м\.[\s,;)]/.test(s)  || s.includes(" м. "))  return "м";
  return null;
}

function extractVerbAspect(posRaw) {
  if (!posRaw) return null;
  const s = posRaw.toLowerCase();
  if (s.includes("однокр")) return "однокр.";
  if (s.includes("несов"))  return "несов.";
  if (s.includes("сов"))    return "сов.";
  return null;
}

function extractNotes(posRaw) {
  if (!posRaw) return null;
  const s = posRaw.toLowerCase();
  const found = [];
  if (s.includes("устар"))   found.push("устар.");
  if (s.includes("разг"))    found.push("разг.");
  if (s.includes("собир"))   found.push("собир.");
  if (s.includes("нескл"))   found.push("нескл.");
  if (s.includes("ист"))     found.push("ист.");
  if (s.includes("мн. нет") || s.includes("мн.нет")) found.push("мн. нет");
  if (s.includes("ед. нет") || s.includes("ед.нет")) found.push("ед. нет");
  return found.length > 0 ? found.join(", ") : null;
}

function normalizePartOfSpeech(posRaw) {
  if (!posRaw) return null;
  const s = posRaw.toLowerCase();
  if (s.includes("прил"))      return "Прил.";
  if (s.includes("нареч"))     return "Нареч.";
  if (s.includes("мест"))      return "Мест.";
  if (s.includes("числ. порядк")) return "Числ. порядк.";
  if (s.includes("числ"))      return "Числ.";
  if (s.includes("предл"))     return "Предл.";
  if (s.includes("союз"))      return "Союз";
  if (s.includes("межд"))      return "Межд.";
  if (s.includes("вводн"))     return "Вводн. сл.";
  if (s.includes("однокр") || s.includes("несов") || s.includes("сов")) return "Глаг.";
  if (/[\s,]м\.[\s,;]|[\s,]ж\.[\s,;]|[\s,]ср\.[\s,;]/.test(" " + s + " ")) return "Сущ.";
  if (s.includes("сущ"))       return "Сущ.";
  if (s.includes("частица"))   return "Частица";
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ОЧИСТКА И ИЗВЛЕЧЕНИЕ ЛАКСКИХ СЛОВ
// ─────────────────────────────────────────────────────────────────────────────
function cleanLakWord(raw) {
  return raw
    .replace(/\(.*?\)/g, "")
    .replace(/[«»""'']/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:]+$/, "")
    .trim();
}

function extractLakWords(text) {
  let t = text.replace(/[◆♦].*$/s, "").trim();
  t = t.replace(/\[\d+\]/g, "");
  t = t.replace(/\bмн\.\s*нет\b/gi, "");
  t = t.replace(/\bед\.\s*нет\b/gi, "");
  t = t.replace(/\bмн\.\s*ч?\.?\s*/gi, "");
  t = t.replace(/\bед\.\s*ч?\.?\s*/gi, "");
  t = t.replace(/\bмн\.\s+[а-яёА-ЯЁ]+/gi, "");
  t = t.replace(/^\s*[мжМЖ]\.\s+/g, "");
  t = t.replace(/\bср\.\s*/gi, "");
  t = t.trim();
  if (!t) return [];

  const numbered = [...t.matchAll(/\d+\)\s*([^;0-9)]+)/g)].map(m => m[1].trim());
  let parts;
  if (numbered.length > 1)     { parts = numbered; }
  else if (numbered.length === 1) { parts = [numbered[0]]; }
  else                          { parts = t.split(/[,;]/).map(p => p.trim()); }

  return parts
    .map(cleanLakWord)
    .filter(w => {
      if (!w || w.length < 2) return false;
      if (isStopLemma(w)) return false;
      if (/^\d+$/.test(w)) return false;
      if (!/[а-яёА-ЯЁ\u0400-\u04FF]/.test(w)) return false;
      return true;
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// ПАРСИНГ СТРАНИЦЫ
// ─────────────────────────────────────────────────────────────────────────────
async function fetchAndParse() {
  const fetch   = (await import("node-fetch")).default;
  const cheerio = require("cheerio");

  console.log(`\n📥 Загружаем страницу: ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

  const html = await res.text();
  console.log(`   Размер HTML: ${(html.length / 1024).toFixed(1)} KB`);

  const $ = cheerio.load(html, { decodeEntities: false });

  const words   = [];
  const seen    = new Set();
  let totalEntries = 0;
  let totalRecords = 0;
  let skipped      = 0;

  const boldEls = $("strong, b");
  console.log(`   Найдено bold-элементов: ${boldEls.length}`);

  boldEls.each((_, el) => {
    const $el = $(el);
    if ($el.parents("strong, b").length > 0) return;

    const russian = $el.text()
      .replace(/\u0301/g, "")
      .replace(/́/g, "")
      .trim();

    if (!russian || russian.length < 2) return;
    if (/^[А-ЯЁ\s\-–—]+$/.test(russian) && russian.length > 15) return;
    if (!/^[А-ЯЁа-яёA-Za-z]/.test(russian)) return;

    const firstChar = russian[0].toUpperCase();
    const letter    = /[А-ЯЁ]/.test(firstChar) ? firstChar : "?";

    let defText = "";
    let posRaw  = "";
    let node    = el.nextSibling;
    let steps   = 0;

    while (node && steps < 40) {
      if (node.type === "text") {
        const txt = (node.data || "").trim();
        if (/^[.,;]?\s*([мжМЖ]|ср)\.\s*$/.test(txt)) {
          posRaw += " " + txt;
        } else {
          defText += node.data || "";
        }
      } else if (node.name === "em" || node.name === "i") {
        posRaw  += " " + $(node).text();
        defText += " ";
      } else if (node.name === "strong" || node.name === "b") {
        break;
      } else if (node.name === "br") {
        break;
      } else {
        defText += $(node).text() || "";
      }
      node = node.nextSibling;
      steps++;
    }

    defText = defText.replace(/^\s*[.,]\s*/, "").trim();
    if (!defText) return;

    const partOfSpeech = normalizePartOfSpeech(posRaw);
    const gender       = extractGender(posRaw);
    const verbAspect   = extractVerbAspect(posRaw);
    const notes        = extractNotes(posRaw);
    const lakWords     = extractLakWords(defText);
    if (lakWords.length === 0) return;

    totalEntries++;
    const added = pushWords(
      words, seen,
      russian, letter,
      partOfSpeech, gender, verbAspect, notes,
      lakWords
    );
    totalRecords += added.total;
    skipped      += added.skipped;
  });

  // Статистика
  console.log(`\n📊 Результаты парсинга:`);
  console.log(`   Словарных статей:  ${totalEntries}`);
  console.log(`   Записей создано:   ${totalRecords}`);
  console.log(`   Дубликатов:        ${skipped}`);

  const byPos = {};
  for (const w of words) {
    const pos = w.partOfSpeech || "(нет)";
    byPos[pos] = (byPos[pos] || 0) + 1;
  }
  console.log(`\n🏷️  По частям речи:`);
  for (const [pos, count] of Object.entries(byPos).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${count.toString().padStart(5)}  ${pos}`);
  }

  const gm = words.filter(w => w.gender === "м").length;
  const gf = words.filter(w => w.gender === "ж").length;
  const gn = words.filter(w => w.gender === "ср").length;
  const g0 = words.filter(w => !w.gender).length;
  console.log(`\n⚥  По роду:`);
  console.log(`   ${gm.toString().padStart(5)}  м.`);
  console.log(`   ${gf.toString().padStart(5)}  ж.`);
  console.log(`   ${gn.toString().padStart(5)}  ср.`);
  console.log(`   ${g0.toString().padStart(5)}  (нет)`);

  const byAspect = {};
  for (const w of words) {
    if (w.verbAspect) byAspect[w.verbAspect] = (byAspect[w.verbAspect] || 0) + 1;
  }
  if (Object.keys(byAspect).length) {
    console.log(`\n🔄 По виду глагола:`);
    for (const [a, c] of Object.entries(byAspect)) {
      console.log(`   ${c.toString().padStart(5)}  ${a}`);
    }
  }

  const withNotes   = words.filter(w => w.notes).length;
  const withSynonyms = words.filter(w => w.translationPriority > 1).length;
  const pri1        = words.filter(w => w.translationPriority === 1).length;
  console.log(`\n📝 С пометами (notes): ${withNotes}`);
  console.log(`\n🔗 Приоритеты переводов:`);
  console.log(`   ${pri1.toString().padStart(5)}  priority=1 (в SRS)`);
  console.log(`   ${withSynonyms.toString().padStart(5)}  priority>1 (синонимы на карточке)`);

  return words;
}

// ─────────────────────────────────────────────────────────────────────────────
// ДОБАВЛЕНИЕ ЗАПИСЕЙ В МАССИВ
// translation_priority и synonym_group_id вычисляются здесь при парсинге
// ─────────────────────────────────────────────────────────────────────────────
function pushWords(
  words, seen,
  russian, letter,
  partOfSpeech, gender, verbAspect, notes,
  lakWords
) {
  const ALPHABET  = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ";
  const idx       = ALPHABET.indexOf(letter);
  const sortOrder = idx >= 0 ? idx + 101 : 200;

  // Дедупликация внутри текущего русского слова
  const uniqueLak = [];
  let skipped = 0;
  for (const lakWord of lakWords) {
    if (!lakWord || lakWord.length < 2) continue;
    const key = `${lakWord.toLowerCase()}|||${russian.toLowerCase()}`;
    if (seen.has(key)) { skipped++; continue; }
    seen.add(key);
    uniqueLak.push(lakWord);
  }

  if (uniqueLak.length === 0) return { total: 0, skipped };

  // synonym_group_id только если переводов больше одного
  const groupId = uniqueLak.length > 1
    ? russian.toLowerCase().trim()
    : null;

  uniqueLak.forEach((lakWord, i) => {
    words.push({
      lemma:               lakWord,
      translation:         russian,
      transcription:       null,
      partOfSpeech,
      gender,
      verbAspect,
      wordType:            "word",
      notes,
      imageUrl:            null,

      // ── Ключевые поля синонимов ──────────────────────────────────────────
      translationPriority: i + 1,   // 1 = основное (в SRS), 2,3... = синонимы
      synonymGroupId:      groupId, // null если слово одно

      collectionSlug:         `slovar-1958-${letter.toLowerCase()}`,
      collectionTitle:        `${letter}`,
      collectionDescription:  `Русско-лакский школьный словарь 1958 г. Гаджиев Г.М., буква ${letter}`,
      collectionLevel:        null,
      collectionIsPublic:     true,
      collectionSortOrder:    sortOrder,
      collectionRuleTagCodes: [],
      collectionType:         "dictionary",
      isManual:               false,
      isExcluded:             false,
    });
  });

  return { total: uniqueLak.length, skipped };
}

// ─────────────────────────────────────────────────────────────────────────────
// ПРЯМОЙ ИМПОРТ В POSTGRESQL
// ─────────────────────────────────────────────────────────────────────────────
async function importDirect(words) {
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 0) continue;
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[k]) process.env[k] = v;
    }
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) throw new Error("DATABASE_URL не задан в .env");

  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    await pool.query("SELECT 1");
    console.log("✅ Подключение к БД успешно");
  } catch (err) {
    throw new Error(`Не удалось подключиться: ${err.message}`);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Коллекции
    console.log("\n📚 Создаём коллекции...");
    const colMap = new Map();
    for (const w of words) {
      if (!w.collectionSlug || colMap.has(w.collectionSlug)) continue;
      colMap.set(w.collectionSlug, w);
    }
    const collectionIdBySlug = new Map();
    for (const [slug, w] of colMap) {
      const res = await client.query(
        `INSERT INTO collections (slug, title, description, level, is_public, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (slug) DO UPDATE
           SET title=$2, sort_order=$6, updated_at=NOW()
         RETURNING id`,
        [slug, w.collectionTitle, w.collectionDescription, null, true, w.collectionSortOrder]
      );
      collectionIdBySlug.set(slug, res.rows[0].id);
    }
    console.log(`   Коллекций: ${collectionIdBySlug.size}`);

    // Слова батчами по 500
    console.log("\n📝 Вставляем слова...");
    const BATCH = 500;
    let added = 0, skipped = 0;

    for (let i = 0; i < words.length; i += BATCH) {
      const batch = words.slice(i, i + BATCH);
      const vp = [], params = [];
      let pi = 1;

      for (const w of batch) {
        const lemma = (w.lemma || "").trim();
        const trans = (w.translation || "").trim();
        if (!lemma || !trans) { skipped++; continue; }

        params.push(
          lemma, trans,
          w.transcription      || null,
          w.partOfSpeech       || null,
          w.gender             || null,
          w.verbAspect         || null,
          w.wordType           || "word",
          w.notes              || null,
          w.imageUrl           || null,
          w.translationPriority || 1,
          w.synonymGroupId     || null
        );
        vp.push(
          `($${pi},$${pi+1},$${pi+2},$${pi+3},$${pi+4},$${pi+5},$${pi+6},$${pi+7},$${pi+8},$${pi+9},$${pi+10})`
        );
        pi += 11;
      }

      if (vp.length === 0) continue;

      const ins = await client.query(
        `INSERT INTO words
           (lemma, translation, transcription, part_of_speech,
            gender, verb_aspect, word_type, notes, image_url,
            translation_priority, synonym_group_id)
         VALUES ${vp.join(",")}
         ON CONFLICT (lemma, translation) DO NOTHING
         RETURNING id, lemma, translation`,
        params
      );

      added   += ins.rows.length;
      skipped += vp.length - ins.rows.length;

      // Связи с коллекциями
      if (ins.rows.length > 0) {
        const imap = new Map(ins.rows.map(r => [`${r.lemma}|||${r.translation}`, r.id]));
        const lp = [], lparams = [];
        let li = 1;

        for (const w of batch) {
          const lemma = (w.lemma || "").trim();
          const trans = (w.translation || "").trim();
          const wid   = imap.get(`${lemma}|||${trans}`);
          const cid   = collectionIdBySlug.get(w.collectionSlug);
          if (!wid || !cid) continue;
          lparams.push(wid, cid, false, false);
          lp.push(`($${li},$${li+1},$${li+2},$${li+3})`);
          li += 4;
        }

        if (lp.length > 0) {
          await client.query(
            `INSERT INTO collection_words (word_id, collection_id, is_manual, is_excluded)
             VALUES ${lp.join(",")}
             ON CONFLICT (collection_id, word_id) DO NOTHING`,
            lparams
          );
        }
      }

      const bn = Math.floor(i / BATCH) + 1;
      const bt = Math.ceil(words.length / BATCH);
      process.stdout.write(`\r   Батч ${bn}/${bt} | добавлено: ${added} | пропущено: ${skipped}`);
    }

    // Audit log
    try {
      await client.query(
        `INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, payload)
         VALUES ($1,$2,$3,$4,$5)`,
        [null, "admin.words.bulk_import", "word", "bulk",
          JSON.stringify({ source: "slovar_1958_v4", added, skipped })]
      );
    } catch { /* не критично */ }

    await client.query("COMMIT");
    console.log(`\n\n✅ Импорт завершён:`);
    console.log(`   Добавлено:         ${added}`);
    console.log(`   Пропущено (дубли): ${skipped}`);
    console.log(`   Коллекций:         ${collectionIdBySlug.size}`);

  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const args     = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const isDirect = args.includes("--direct");

  console.log("══════════════════════════════════════════════════════════");
  console.log("  lak-learn: Парсер Русско-лакского школьного словаря 1958 v4");
  console.log("══════════════════════════════════════════════════════════");

  let words;
  try {
    words = await fetchAndParse();
  } catch (err) {
    console.error(`\n❌ Ошибка парсинга: ${err.message}`);
    process.exit(1);
  }

  if (words.length === 0) {
    console.error("\n❌ Ничего не найдено.");
    process.exit(1);
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(words, null, 2), "utf-8");
  console.log(`\n💾 JSON сохранён: ${OUTPUT_FILE} (${words.length} записей)`);

  if (isDryRun) {
    console.log("\n🔍 Первые 20 записей:");
    words.slice(0, 20).forEach((w, i) => {
      const meta = [
        w.partOfSpeech,
        w.gender,
        w.verbAspect,
        w.notes,
        w.translationPriority > 1 ? `syn:${w.translationPriority}` : null,
      ].filter(Boolean).join(" · ");
      console.log(
        `  ${String(i + 1).padStart(2)}. "${w.lemma}" → "${w.translation}"` +
        (meta ? `  [${meta}]` : "")
      );
    });
    console.log("\n✅ Dry-run завершён.");
    console.log("   Прямой импорт:  node parse_slovar_1958.js --direct");
    return;
  }

  if (isDirect) {
    try {
      await importDirect(words);
    } catch (err) {
      console.error(`\n❌ Ошибка импорта: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  console.log("\n💡 Для импорта:  node parse_slovar_1958.js --direct");
}

main().catch(err => {
  console.error(`\n💥 ${err.message}`);
  process.exit(1);
});