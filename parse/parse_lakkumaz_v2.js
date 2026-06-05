#!/usr/bin/env node

/**
 * parse_lakkumaz_v2.js
 * Парсер Русско-лакского разговорника Дигиева Л. А.
 * Версия 2 — чистое разделение словаря и разговорника
 *
 * Использование:
 *   node parse_lakkumaz_v2.js                          — парсинг, сохранить JSON
 *   node parse_lakkumaz_v2.js --dry-run                — показать первые 20 записей
 *   node parse_lakkumaz_v2.js --import http://localhost:3000 --cookie "lak_access_token=xxx"
 *
 * npm install node-fetch cheerio
 */

"use strict";

const fs   = require("fs");
const path = require("path");

const SOURCE_URL  = "https://lakkumaz.narod.ru/russko-lakskiy_razgovornik_digiev.html";
const OUTPUT_FILE = path.join(__dirname, "lakkumaz_v2.json");

// ─────────────────────────────────────────────────────────────────────────────
// ГЛАВНОЕ: карта разделов с явным type
//   type: "phrasebook" → разговорник  (сортировка 1-50)
//   type: "dictionary" → словарь      (сортировка 101-200)
//
// sortOrder разделён на два непересекающихся диапазона — никакой эвристики
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_MAP = {

  // ══════════════════════════════════════════
  // РАЗГОВОРНИК (type: phrasebook, order 1–50)
  // ══════════════════════════════════════════

  "ОБРАЩЕНИЕ": {
    slug: "obrashchenie", title: "Обращение",
    description: "Обращения к людям",
    type: "phrasebook", sortOrder: 1,
  },
  "ПРИВЕТСТВИЕ": {
    slug: "privetstvie", title: "Приветствие",
    description: "Приветствия и пожелания",
    type: "phrasebook", sortOrder: 2,
  },
  "ПРОЩАНИЕ": {
    slug: "proshchanie", title: "Прощание",
    description: "Фразы прощания",
    type: "phrasebook", sortOrder: 3,
  },
  "ПРОСЬБА": {
    slug: "prosba", title: "Просьба",
    description: "Как попросить о чём-либо",
    type: "phrasebook", sortOrder: 4,
  },
  "БЛАГОДАРНОСТЬ. РАДОСТЬ": {
    slug: "blagodarnost", title: "Благодарность",
    description: "Выражение благодарности и радости",
    type: "phrasebook", sortOrder: 5,
  },
  "ПРИГЛАШЕНИЕ": {
    slug: "priglashenie", title: "Приглашение",
    description: "Как пригласить",
    type: "phrasebook", sortOrder: 6,
  },
  "ИЗВИНЕНИЕ": {
    slug: "izvinenie", title: "Извинение",
    description: "Как попросить прощения",
    type: "phrasebook", sortOrder: 7,
  },
  "ПОЗДРАВЛЕНИЕ": {
    slug: "pozdravlenie", title: "Поздравление",
    description: "Поздравления с праздниками",
    type: "phrasebook", sortOrder: 8,
  },
  "СОЖАЛЕНИЕ. СОЧУВСТВИЕ. СОБОЛЕЗНОВАНИЕ": {
    slug: "sozhalenie", title: "Сожаление и сочувствие",
    description: "Выражение сочувствия",
    type: "phrasebook", sortOrder: 9,
  },
  "СОГЛАСИЕ": {
    slug: "soglasie", title: "Согласие",
    description: "Как выразить согласие",
    type: "phrasebook", sortOrder: 10,
  },
  "ОТКАЗ": {
    slug: "otkaz", title: "Отказ",
    description: "Как вежливо отказать",
    type: "phrasebook", sortOrder: 11,
  },
  "ВОПРОСЫ": {
    slug: "voprosy", title: "Вопросы",
    description: "Вопросительные фразы",
    type: "phrasebook", sortOrder: 12,
  },
  "ОТВЕТЫ": {
    slug: "otvety", title: "Ответы",
    description: "Базовые ответы",
    type: "phrasebook", sortOrder: 13,
  },
  "ЗНАКОМСТВО. РАЗГОВОР": {
    slug: "znakomstvo", title: "Знакомство",
    description: "Фразы для знакомства и разговора",
    type: "phrasebook", sortOrder: 14,
  },
  "СЕМЬЯ": {
    slug: "semya", title: "Семья",
    description: "Слова о семье",
    type: "phrasebook", sortOrder: 15,
  },
  "РОДСТВЕННЫЕ ОТНОШЕНИЯ": {
    slug: "rodstvenniki", title: "Родственники",
    description: "Названия родственников",
    type: "phrasebook", sortOrder: 16,
  },
  "ЧИСЛИТЕЛЬНЫЕ": {
    slug: "chislitelnyye", title: "Числа",
    description: "Числа и числительные",
    type: "phrasebook", sortOrder: 17,
  },
  "ДНИ НЕДЕЛИ": {
    slug: "dni-nedeli", title: "Дни недели",
    description: "Дни недели на лакском",
    type: "phrasebook", sortOrder: 18,
  },
  "МЕСЯЦЫ": {
    slug: "mesyatsy", title: "Месяцы",
    description: "Месяцы года",
    type: "phrasebook", sortOrder: 19,
  },
  "ВРЕМЕНА ГОДА": {
    slug: "vremena-goda", title: "Времена года",
    description: "Времена года",
    type: "phrasebook", sortOrder: 20,
  },
  "ЦВЕТА": {
    slug: "tsveta", title: "Цвета",
    description: "Цвета на лакском",
    type: "phrasebook", sortOrder: 21,
  },
  "ЖИВОТНЫЕ": {
    slug: "zhivotnyye", title: "Животные",
    description: "Животные на лакском",
    type: "phrasebook", sortOrder: 22,
  },
  "ДИКИЕ ЖИВОТНЫЕ": {
    slug: "dikie-zhivotnyye", title: "Дикие животные",
    description: "Дикие животные",
    type: "phrasebook", sortOrder: 23,
  },
  "ДОМАШНИЕ ЖИВОТНЫЕ": {
    slug: "domashnie-zhivotnyye", title: "Домашние животные",
    description: "Домашние животные",
    type: "phrasebook", sortOrder: 24,
  },
  "ПТИЦЫ": {
    slug: "ptitsy", title: "Птицы",
    description: "Птицы на лакском",
    type: "phrasebook", sortOrder: 25,
  },
  "ЗДОРОВЬЕ": {
    slug: "zdorovye", title: "Здоровье",
    description: "Слова и фразы о здоровье",
    type: "phrasebook", sortOrder: 26,
  },
  "У ВРАЧА": {
    slug: "u-vracha", title: "У врача",
    description: "Фразы у врача",
    type: "phrasebook", sortOrder: 27,
  },
  "ПОГОДА": {
    slug: "pogoda", title: "Погода",
    description: "Слова о погоде",
    type: "phrasebook", sortOrder: 28,
  },
  "ПРИРОДА": {
    slug: "priroda", title: "Природа",
    description: "Слова о природе",
    type: "phrasebook", sortOrder: 29,
  },
  "ЗНАНИЕ И ИЗУЧЕНИЕ ЯЗЫКОВ": {
    slug: "izuchenie-yazyka", title: "Изучение языков",
    description: "Фразы об изучении языков",
    type: "phrasebook", sortOrder: 30,
  },
  "ЛАКСКАЯ КУХНЯ": {
    slug: "lakskaya-kukhnya", title: "Лакская кухня",
    description: "Блюда лакской кухни",
    type: "phrasebook", sortOrder: 31,
  },
  "ОДЕЖДА. ОБУВЬ": {
    slug: "odezhda", title: "Одежда и обувь",
    description: "Названия одежды и обуви",
    type: "phrasebook", sortOrder: 32,
  },

  // ══════════════════════════════════════════
  // СЛОВАРЬ (type: dictionary, order 101–200)
  // Диапазон 101+ — гарантированно не пересекается с разговорником
  // ══════════════════════════════════════════

  "ИМЕНА СУЩЕСТВИТЕЛЬНЫЕ": {
    slug: "sushchestvitelnye", title: "Существительные",
    description: "Краткий словарь существительных",
    type: "dictionary", sortOrder: 101,
    partOfSpeech: "Сущ.",
  },
  "ГЛАГОЛЫ": {
    slug: "glagoly", title: "Глаголы",
    description: "Краткий словарь глаголов",
    type: "dictionary", sortOrder: 102,
    partOfSpeech: "Глаг.",
  },
  "ПРИЛАГАТЕЛЬНЫЕ": {
    slug: "prilagatelnye", title: "Прилагательные",
    description: "Краткий словарь прилагательных",
    type: "dictionary", sortOrder: 103,
    partOfSpeech: "Прил.",
  },
  "АНТОНИМЫ": {
    slug: "antonimy", title: "Антонимы",
    description: "Пары противоположных слов",
    type: "dictionary", sortOrder: 104,
    partOfSpeech: null,
  },
  "НАРЕЧИЯ": {
    slug: "narechiya", title: "Наречия",
    description: "Краткий словарь наречий",
    type: "dictionary", sortOrder: 105,
    partOfSpeech: "Нареч.",
  },
  "МЕСТОИМЕНИЯ": {
    slug: "mestoimeniya", title: "Местоимения",
    description: "Местоимения на лакском",
    type: "dictionary", sortOrder: 106,
    partOfSpeech: "Мест.",
  },
};

// Список всех ключей разделов для поиска по тексту
const SECTION_KEYS = Object.keys(SECTION_MAP);

// ─────────────────────────────────────────────────────────────────────────────
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ─────────────────────────────────────────────────────────────────────────────

function normalizeCharset(charset) {
  if (!charset) return null;
  const v = charset.trim().toLowerCase();
  if (["utf8", "utf-8"].includes(v)) return "utf-8";
  if (["windows-1251", "win-1251", "cp1251", "x-cp1251"].includes(v)) return "windows-1251";
  return null;
}

function decodeBuffer(arrayBuffer, contentTypeHeader) {
  const bytes = Buffer.from(arrayBuffer);

  // Пробуем достать charset из заголовка или <meta>
  const headerMatch = (contentTypeHeader || "").match(/charset\s*=\s*['"]?\s*([a-zA-Z0-9_-]+)/i);
  const hint = normalizeCharset(headerMatch ? headerMatch[1] : null);

  const headChunk = bytes.toString("latin1", 0, Math.min(bytes.length, 8192));
  const metaMatch = headChunk.match(/<meta[^>]+charset\s*=\s*['"]?\s*([a-zA-Z0-9_-]+)/i);
  const metaHint  = normalizeCharset(metaMatch ? metaMatch[1] : null);

  const candidates = [...new Set([hint, metaHint, "utf-8", "windows-1251"].filter(Boolean))];

  let best = null;
  for (const cs of candidates) {
    const text  = new TextDecoder(cs).decode(bytes);
    // Считаем кириллицу — правильная кодировка даст больше читаемых символов
    const score = (text.match(/[А-Яа-яЁё]/g) || []).length
                - (text.match(/[^\x00-\xFF]/g) || []).length * 10;
    if (!best || score > best.score) best = { cs, text, score };
  }

  return best ? best.text : new TextDecoder("utf-8").decode(bytes);
}

/** Ищем раздел по тексту заголовка */
function findSection(rawText) {
  const text = (rawText || "").trim().toUpperCase().replace(/\s+/g, " ");
  if (!text) return null;

  for (const key of SECTION_KEYS) {
    if (text === key || text.includes(key) || key.includes(text)) {
      return { key, data: SECTION_MAP[key] };
    }
  }
  return null;
}

/** Нормализация текста ячейки */
function normalizeCell(raw) {
  if (!raw) return null;
  const text = raw.replace(/\s+/g, " ").replace(/\[\d+\]/g, "").trim();
  return text.length ? text : null;
}

/**
 * Извлекаем основную форму:
 * "(м.) Ивзрав! / (ж.) Бивзрав!" → "Ивзрав!"
 * Убираем пометки рода, лишние скобки
 */
function primaryForm(text) {
  if (!text) return null;

  // Есть пометка мужского рода — берём только её
  const maleMatch = text.match(/\(м\.\)\s*([^(/\n]+)/);
  if (maleMatch) return maleMatch[1].trim();

  return text
    .replace(/\s*\(м\.\)[^\n)]*/g, "")
    .replace(/\s*\(ж\.\)[^\n)]*/g, "")
    .replace(/\s*\(от муж\. лица\)[^\n]*/g, "")
    .replace(/\s*\(от жен\. лица\)[^\n]*/g, "")
    .replace(/\s*\(к муж\.\)[^\n]*/g, "")
    .replace(/\s*\(к жен\.\)[^\n]*/g, "")
    .replace(/\s*\(множ\. чис\.\)[^\n]*/g, "")
    .trim() || text.trim();
}

/** Является ли строка фразой, а не одиночным словом */
function isPhrase(text) {
  if (!text) return false;
  return text.includes(" ") || text.endsWith("?") || text.endsWith("!") || text.endsWith(".");
}

function makeKey(ru, lak) {
  return `${ru.slice(0, 60).toLowerCase()}::${lak.slice(0, 60).toLowerCase()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ПАРСЕР
// ─────────────────────────────────────────────────────────────────────────────

async function fetchAndParse() {
  console.log(`\n📥 Загружаем: ${SOURCE_URL}`);

  let fetch, cheerio;
  try { fetch   = (await import("node-fetch")).default; }
  catch { console.error("❌ npm install node-fetch"); process.exit(1); }
  try { cheerio = await import("cheerio"); }
  catch { console.error("❌ npm install cheerio");   process.exit(1); }

  const res    = await fetch(SOURCE_URL, { headers: { "User-Agent": "lak-learn-parser/2.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const buf  = await res.arrayBuffer();
  const html = decodeBuffer(buf, res.headers.get("content-type"));
  console.log(`✅ Загружено (${Math.round(html.length / 1024)} KB)`);

  const $ = cheerio.load(html, { decodeEntities: false });

  const words   = [];
  const seen    = new Set();
  let   current = null;   // текущий раздел { key, data }
  let   stats   = { tables: 0, rows: 0, skipped: 0, noSection: 0 };

  // ── Шаг 1: найти все заголовки разделов и таблицы в порядке документа ────
  // Итерируем по всем элементам body последовательно
  $("body *").each((_, el) => {
    const tag  = (el.tagName || "").toLowerCase();
    const text = $(el).text();

    // ── Ищем заголовок раздела ──────────────────────────────────────────────
    // Заголовки бывают в <b>, <strong>, <p>, <td> с заглавными буквами
    if (["b", "strong", "p", "h1", "h2", "h3", "h4", "font"].includes(tag)) {
      const found = findSection(text);
      if (found) {
        current = found;
        return; // идём дальше
      }
    }

    // ── Обрабатываем таблицу ────────────────────────────────────────────────
    if (tag !== "table") return;
    stats.tables++;

    // Первая строка таблицы тоже может быть заголовком раздела
    const firstRow = $(el).find("tr").first();
    const firstCell = normalizeCell(firstRow.find("td").first().text());
    if (firstCell) {
      const foundInTable = findSection(firstCell);
      if (foundInTable) {
        current = foundInTable;
      }
    }

    if (!current) {
      stats.noSection++;
      return; // таблица вне известного раздела — пропускаем
    }

    const section = current; // захватываем для замыкания

    $(el).find("tr").each((rowIdx, row) => {
      const cells = $(row).find("td");
      if (cells.length < 2) return;

      const raw0 = normalizeCell($(cells[0]).text());
      const raw1 = normalizeCell($(cells[1]).text());
      if (!raw0 || !raw1) return;

      // Пропускаем заголовочные строки (обе — заглавными)
      if (raw0.toUpperCase() === raw0 && raw0.length > 2 && !raw0.includes(" ") &&
          raw0 === raw1.toUpperCase()) return;

      // В разговорнике: col0 = русский, col1 = лакский
      // В словаре (существительные и т.д.): тоже col0 = русский, col1 = лакский
      const russian = primaryForm(raw0);
      const lak     = primaryForm(raw1);

      if (!russian || !lak || russian === lak) return;
      if (russian.length < 1 || lak.length < 1) return;

      // Пропускаем строки-заголовки где русский = заглавные буквы без пробела
      if (
        russian === russian.toUpperCase() &&
        russian.length > 3 &&
        !russian.includes(" ") &&
        !russian.match(/[0-9]/)
      ) return;

      const key = makeKey(russian, lak);
      if (seen.has(key)) { stats.skipped++; return; }
      seen.add(key);
      stats.rows++;

      // ── Определяем часть речи ──────────────────────────────────────────
      let partOfSpeech = section.data.partOfSpeech ?? null;

      // Для разговорника — если явная часть речи не задана, определяем по контексту
      if (!partOfSpeech && section.data.type === "phrasebook") {
        partOfSpeech = isPhrase(russian) ? "Фраза" : null;
      }

      words.push({
        lemma:                  lak,        // лакский текст — основная форма
        translation:            russian,    // русский перевод
        transcription:          null,       // на сайте не указана
        partOfSpeech,
        // ── Метаданные коллекции ──
        collectionSlug:         section.data.slug,
        collectionTitle:        section.data.title,
        collectionDescription:  section.data.description,
        collectionType:         section.data.type,     // "phrasebook" | "dictionary"
        collectionLevel:        null,
        collectionIsPublic:     true,
        collectionSortOrder:    section.data.sortOrder,
        collectionRuleTagCodes: [],
        isManual:               true,
        isExcluded:             false,
      });
    });
  });

  // ── Статистика ─────────────────────────────────────────────────────────────
  console.log(`\n📊 Результаты парсинга:`);
  console.log(`   Таблиц найдено:      ${stats.tables}`);
  console.log(`   Записей извлечено:   ${stats.rows}`);
  console.log(`   Дубликатов:          ${stats.skipped}`);
  console.log(`   Таблиц без раздела:  ${stats.noSection}`);

  // Группировка по type
  const byType = {};
  const byCol  = {};
  for (const w of words) {
    byType[w.collectionType] = (byType[w.collectionType] || 0) + 1;
    byCol[w.collectionTitle] = (byCol[w.collectionTitle]  || 0) + 1;
  }

  console.log(`\n📂 По типу:`);
  for (const [type, count] of Object.entries(byType)) {
    console.log(`   ${count.toString().padStart(5)}  ${type === "phrasebook" ? "📗 Разговорник" : "📘 Словарь"}`);
  }

  console.log(`\n📚 По коллекциям:`);
  for (const [title, count] of Object.entries(byCol).sort((a, b) => b[1] - a[1])) {
    const type = words.find(w => w.collectionTitle === title)?.collectionType;
    const icon = type === "phrasebook" ? "📗" : "📘";
    console.log(`   ${count.toString().padStart(4)}  ${icon}  ${title}`);
  }

  return words;
}

// ─────────────────────────────────────────────────────────────────────────────
// ИМПОРТ В API
// ─────────────────────────────────────────────────────────────────────────────

async function importToApi(words, baseUrl, cookie) {
  const fetch = (await import("node-fetch")).default;
  const url   = `${baseUrl}/api/admin/words`;

  console.log(`\n🚀 Импортируем ${words.length} записей → ${url}`);

  const BATCH = 200;
  const batches = [];
  for (let i = 0; i < words.length; i += BATCH) batches.push(words.slice(i, i + BATCH));

  let totalAdded = 0, totalSkipped = 0, totalInvalid = 0, collectionsCreated = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    process.stdout.write(`   Батч ${i + 1}/${batches.length} (${batch.length} записей)... `);

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify({ format: "json", mode: "backup", content: JSON.stringify(batch) }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`❌ HTTP ${res.status}: ${text}`);
      continue;
    }

    const r = await res.json();
    const s = r.summary || {};
    totalAdded        += s.added            || 0;
    totalSkipped      += s.skipped          || 0;
    totalInvalid      += s.invalid          || 0;
    collectionsCreated += s.collectionsCreated || 0;

    console.log(`✅ +${s.added} | пропущено: ${s.skipped} | невалид: ${s.invalid} | коллекций: ${s.collectionsCreated}`);
  }

  console.log(`\n✅ Итог импорта:`);
  console.log(`   Добавлено:         ${totalAdded}`);
  console.log(`   Пропущено (дубли): ${totalSkipped}`);
  console.log(`   Невалидных:        ${totalInvalid}`);
  console.log(`   Коллекций создано: ${collectionsCreated}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const args      = process.argv.slice(2);
  const isDryRun  = args.includes("--dry-run");
  const importIdx = args.indexOf("--import");
  const baseUrl   = importIdx !== -1 ? args[importIdx + 1] : null;
  const cookieIdx = args.indexOf("--cookie");
  const cookie    = cookieIdx !== -1 ? args[cookieIdx + 1] : null;

  console.log("══════════════════════════════════════════════════");
  console.log("  lak-learn: Парсер разговорника Дигиева v2.0");
  console.log("══════════════════════════════════════════════════");

  let words;
  try {
    words = await fetchAndParse();
  } catch (err) {
    console.error(`\n❌ Ошибка парсинга: ${err.message}`);
    process.exit(1);
  }

  if (words.length === 0) {
    console.error("\n❌ Ничего не найдено. Возможно, структура страницы изменилась.");
    process.exit(1);
  }

  // Сохранить JSON
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(words, null, 2), "utf-8");
  console.log(`\n💾 JSON сохранён: ${OUTPUT_FILE} (${words.length} записей)`);

  if (isDryRun) {
    console.log("\n🔍 Первые 20 записей:");
    words.slice(0, 20).forEach((w, i) => {
      const icon = w.collectionType === "phrasebook" ? "📗" : "📘";
      console.log(
        `  ${String(i + 1).padStart(2)}. ${icon} [${w.collectionTitle}] "${w.lemma}" → "${w.translation}"` +
        (w.partOfSpeech ? `  (${w.partOfSpeech})` : "")
      );
    });
    console.log("\n✅ Dry-run завершён. Для импорта добавьте --import http://localhost:3000");
    return;
  }

  if (baseUrl) {
    if (!cookie) {
      console.log("\n⚠️  Cookie не передан. Добавьте: --cookie \"lak_access_token=xxx\"");
    }
    try {
      await importToApi(words, baseUrl.replace(/\/$/, ""), cookie);
    } catch (err) {
      console.error(`\n❌ Ошибка импорта: ${err.message}`);
      process.exit(1);
    }
  } else {
    console.log("\n💡 Для импорта:");
    console.log(`   node parse_lakkumaz_v2.js --import http://localhost:3000 --cookie "lak_access_token=..."`);
    console.log("\n   Или через admin-панель: /admin → Импорт → Режим: Backup → JSON → lakkumaz_v2.json");
  }
}

main().catch(err => {
  console.error(`\n💥 ${err.message}`);
  process.exit(1);
});