#!/usr/bin/env node

/**
 * Парсер и импортёр данных с сайта lakkumaz.narod.ru
 * Русско-лакский разговорник Дигиева Л. А.
 *
 * Использование:
 *   node parse_lakkumaz.js                        — парсинг и сохранение JSON
 *   node parse_lakkumaz.js --import http://localhost:3000  — парсинг + импорт
 *   node parse_lakkumaz.js --dry-run              — только показать что будет импортировано
 *
 * Требования:
 *   npm install node-fetch cheerio
 *
 * После импорта в БД появятся:
 *   - ~800+ слов и фраз
 *   - 30+ тематических коллекций
 *   - Теги по частям речи
 */

const fs = require("fs");
const path = require("path");

// ─────────────────────────────────────────────
// КОНФИГУРАЦИЯ
// ─────────────────────────────────────────────

const SOURCE_URL =
  "https://lakkumaz.narod.ru/russko-lakskiy_razgovornik_digiev.html";

const OUTPUT_FILE = path.join(__dirname, "lakkumaz_words.json");

// Маппинг: заголовок раздела → slug коллекции + метаданные
const SECTION_MAP = {
  "ОБРАЩЕНИЕ": {
    slug: "obrashchenie",
    title: "Обращение",
    description: "Обращения к людям на лакском языке",
    sortOrder: 1,
  },
  "ПРИВЕТСТВИЕ": {
    slug: "privetstvie",
    title: "Приветствие",
    description: "Приветствия и пожелания",
    sortOrder: 2,
  },
  "ПРОЩАНИЕ": {
    slug: "proshchanie",
    title: "Прощание",
    description: "Фразы прощания",
    sortOrder: 3,
  },
  "ПРОСЬБА": {
    slug: "prosba",
    title: "Просьба",
    description: "Фразы для выражения просьбы",
    sortOrder: 4,
  },
  "БЛАГОДАРНОСТЬ. РАДОСТЬ": {
    slug: "blagodarnost",
    title: "Благодарность и радость",
    description: "Выражение благодарности и радости",
    sortOrder: 5,
  },
  "ПРИГЛАШЕНИЕ": {
    slug: "priglashenie",
    title: "Приглашение",
    description: "Фразы для приглашения",
    sortOrder: 6,
  },
  "ИЗВИНЕНИЕ": {
    slug: "izvinenie",
    title: "Извинение",
    description: "Как попросить прощения",
    sortOrder: 7,
  },
  "ПОЗДРАВЛЕНИЕ": {
    slug: "pozdravlenie",
    title: "Поздравление",
    description: "Поздравления с праздниками и событиями",
    sortOrder: 8,
  },
  "СОЖАЛЕНИЕ. СОЧУВСТВИЕ. СОБОЛЕЗНОВАНИЕ": {
    slug: "sozhalenie",
    title: "Сожаление и сочувствие",
    description: "Выражение сочувствия",
    sortOrder: 9,
  },
  "СОГЛАСИЕ": {
    slug: "soglasie",
    title: "Согласие",
    description: "Как выразить согласие",
    sortOrder: 10,
  },
  "ОТКАЗ": {
    slug: "otkaz",
    title: "Отказ",
    description: "Как отказать",
    sortOrder: 11,
  },
  "ВОПРОСЫ": {
    slug: "voprosy",
    title: "Вопросы",
    description: "Вопросительные слова и фразы",
    sortOrder: 12,
  },
  "ОТВЕТЫ": {
    slug: "otvety",
    title: "Ответы",
    description: "Базовые ответы",
    sortOrder: 13,
  },
  "ЗНАКОМСТВО. РАЗГОВОР": {
    slug: "znakomstvo",
    title: "Знакомство и разговор",
    description: "Фразы для знакомства",
    sortOrder: 14,
  },
  "СЕМЬЯ": {
    slug: "semya",
    title: "Семья",
    description: "Слова о семье и родственниках",
    sortOrder: 15,
  },
  "РОДСТВЕННЫЕ ОТНОШЕНИЯ": {
    slug: "rodstvenniki",
    title: "Родственные отношения",
    description: "Названия родственников",
    sortOrder: 16,
  },
  "ЧИСЛИТЕЛЬНЫЕ": {
    slug: "chislitelnyye",
    title: "Числительные",
    description: "Числа на лакском языке",
    sortOrder: 17,
  },
  "ДНИ НЕДЕЛИ": {
    slug: "dni-nedeli",
    title: "Дни недели",
    description: "Дни недели на лакском",
    sortOrder: 18,
  },
  "МЕСЯЦЫ": {
    slug: "mesyatsy",
    title: "Месяцы",
    description: "Месяцы года на лакском",
    sortOrder: 19,
  },
  "ВРЕМЕНА ГОДА": {
    slug: "vremena-goda",
    title: "Времена года",
    description: "Времена года на лакском",
    sortOrder: 20,
  },
  "ЦВЕТА": {
    slug: "tsveta",
    title: "Цвета",
    description: "Цвета на лакском языке",
    sortOrder: 21,
  },
  "ЖИВОТНЫЕ": {
    slug: "zhivotnyye",
    title: "Животные",
    description: "Животные на лакском языке",
    sortOrder: 22,
  },
  "ДИКИЕ ЖИВОТНЫЕ": {
    slug: "dikie-zhivotnyye",
    title: "Дикие животные",
    description: "Дикие животные",
    sortOrder: 23,
  },
  "ДОМАШНИЕ ЖИВОТНЫЕ": {
    slug: "domashnie-zhivotnyye",
    title: "Домашние животные",
    description: "Домашние животные",
    sortOrder: 24,
  },
  "ПТИЦЫ": {
    slug: "ptitsy",
    title: "Птицы",
    description: "Птицы на лакском",
    sortOrder: 25,
  },
  "ЗДОРОВЬЕ": {
    slug: "zdorovye",
    title: "Здоровье",
    description: "Слова и фразы о здоровье",
    sortOrder: 26,
  },
  "У ВРАЧА": {
    slug: "u-vracha",
    title: "У врача",
    description: "Фразы у врача",
    sortOrder: 27,
  },
  "ПОГОДА": {
    slug: "pogoda",
    title: "Погода",
    description: "Слова о погоде",
    sortOrder: 28,
  },
  "ПРИРОДА": {
    slug: "priroda",
    title: "Природа",
    description: "Слова о природе",
    sortOrder: 29,
  },
  "ЗНАНИЕ И ИЗУЧЕНИЕ ЯЗЫКОВ": {
    slug: "izuchenie-yazyka",
    title: "Изучение языков",
    description: "Фразы об изучении языков",
    sortOrder: 30,
  },
  "ЛАКСКАЯ КУХНЯ": {
    slug: "lakskaya-kukhnya",
    title: "Лакская кухня",
    description: "Названия блюд лакской кухни",
    sortOrder: 31,
  },
  "ОДЕЖДА. ОБУВЬ": {
    slug: "odezhda",
    title: "Одежда и обувь",
    description: "Названия одежды и обуви",
    sortOrder: 32,
  },
  "ИМЕНА СУЩЕСТВИТЕЛЬНЫЕ": {
    slug: "sushchestvitelnye",
    title: "Существительные",
    description: "Краткий словарь существительных",
    sortOrder: 33,
  },
  "ГЛАГОЛЫ": {
    slug: "glagoly",
    title: "Глаголы",
    description: "Краткий словарь глаголов",
    sortOrder: 34,
  },
  "ПРИЛАГАТЕЛЬНЫЕ": {
    slug: "prilagatelnye",
    title: "Прилагательные",
    description: "Краткий словарь прилагательных",
    sortOrder: 35,
  },
  "АНТОНИМЫ": {
    slug: "antonimy",
    title: "Антонимы",
    description: "Пары противоположных слов",
    sortOrder: 36,
  },
  "НАРЕЧИЯ": {
    slug: "narechiya",
    title: "Наречия",
    description: "Краткий словарь наречий",
    sortOrder: 37,
  },
  "МЕСТОИМЕНИЯ": {
    slug: "mestoimeniya",
    title: "Местоимения",
    description: "Местоимения на лакском языке",
    sortOrder: 38,
  },
};

// Определение части речи по коллекции
const PART_OF_SPEECH_MAP = {
  "sushchestvitelnye": "Сущ.",
  "glagoly": "Глаг.",
  "prilagatelnye": "Прил.",
  "narechiya": "Нареч.",
  "mestoimeniya": "Мест.",
  "chislitelnyye": "Числ.",
  "antonimy": null,
};

const SECTION_TITLES = Object.keys(SECTION_MAP);

function findSectionByText(rawText) {
  const text = (rawText || "").trim().toUpperCase();
  if (!text) return null;

  for (const [sectionTitle, collectionData] of Object.entries(SECTION_MAP)) {
    if (
      text === sectionTitle ||
      text.includes(sectionTitle) ||
      sectionTitle.includes(text)
    ) {
      return { sectionTitle, collectionData };
    }
  }

  return null;
}

function normalizeCharset(charset) {
  if (!charset) return null;
  const value = charset.trim().toLowerCase();

  if (["utf8", "utf-8"].includes(value)) return "utf-8";
  if (["windows-1251", "win-1251", "cp1251", "x-cp1251"].includes(value)) return "windows-1251";

  return null;
}

function extractCharsetHint(contentTypeHeader, bytes) {
  const headerMatch = (contentTypeHeader || "").match(/charset\s*=\s*['"]?\s*([a-zA-Z0-9_-]+)/i);
  const headerCharset = normalizeCharset(headerMatch ? headerMatch[1] : null);
  if (headerCharset) return headerCharset;

  const headChunk = bytes.toString("latin1", 0, Math.min(bytes.length, 16 * 1024));
  const metaMatch = headChunk.match(/<meta[^>]+charset\s*=\s*['"]?\s*([a-zA-Z0-9_-]+)/i);
  const metaCharset = normalizeCharset(metaMatch ? metaMatch[1] : null);
  if (metaCharset) return metaCharset;

  return null;
}

function scoreDecodedHtml(text) {
  const upper = text.toUpperCase();
  let sectionHits = 0;

  for (const sectionTitle of SECTION_TITLES) {
    if (upper.includes(sectionTitle)) {
      sectionHits += 1;
    }
  }

  const cyrillicCount = (text.match(/[А-Яа-яЁё]/g) || []).length;
  const replacementCount = (text.match(/�/g) || []).length;
  const mojibakeCount = (text.match(/Р[\x80-\xBF]|С[\x80-\xBF]/g) || []).length;

  return sectionHits * 100 + cyrillicCount * 0.01 - replacementCount * 5 - mojibakeCount;
}

function decodeHtmlBuffer(arrayBuffer, contentTypeHeader) {
  const bytes = Buffer.from(arrayBuffer);
  const charsetHint = extractCharsetHint(contentTypeHeader, bytes);

  const candidateCharsets = Array.from(
    new Set([charsetHint, "utf-8", "windows-1251"].filter(Boolean))
  );

  let best = null;
  for (const charset of candidateCharsets) {
    const text = new TextDecoder(charset).decode(bytes);
    const score = scoreDecodedHtml(text);

    if (!best || score > best.score) {
      best = { charset, text, score };
    }
  }

  return {
    html: best ? best.text : new TextDecoder("utf-8").decode(bytes),
    charset: best ? best.charset : "utf-8",
  };
}

// ─────────────────────────────────────────────
// УТИЛИТЫ
// ─────────────────────────────────────────────

/**
 * Нормализация текста ячейки:
 * убираем лишние пробелы, скобочные пояснения о роде/числе,
 * но сохраняем лакские специальные символы
 */
function normalizeText(raw) {
  if (!raw) return null;

  let text = raw
    .replace(/\s+/g, " ")
    .replace(/\[[\d]+\]/g, "") // убираем [4], [5] — номера страниц
    .trim();

  if (text.length === 0) return null;
  return text;
}

/**
 * Для ячеек где может быть несколько вариантов через перенос строки
 * "(м.) Ивзрав! / (ж.) Бивзрав!" — берём первый вариант как основной
 */
function extractPrimaryForm(text) {
  if (!text) return null;

  // Если есть пометка (м.) — берём только эту форму
  const maleMatch = text.match(/\(м\.\)\s*([^\n(]+)/);
  if (maleMatch) {
    return maleMatch[1].trim();
  }

  // Убираем пометки о роде из основного текста
  const cleaned = text
    .replace(/\s*\(м\.\)[^)]*\)/g, "")
    .replace(/\s*\(ж\.\)[^)]*\)/g, "")
    .replace(/\s*\(от муж\. лица\)[^\n]*/g, "")
    .replace(/\s*\(от жен\. лица\)[^\n]*/g, "")
    .replace(/\s*\(к муж\.\)[^\n]*/g, "")
    .replace(/\s*\(к жен\.\)[^\n]*/g, "")
    .replace(/\s*\(множ\. чис\.\)[^\n]*/g, "")
    .trim();

  return cleaned || text;
}

/**
 * Определяем часть речи по коллекции или по контексту
 */
function detectPartOfSpeech(collectionSlug, russianText) {
  if (PART_OF_SPEECH_MAP[collectionSlug] !== undefined) {
    return PART_OF_SPEECH_MAP[collectionSlug];
  }

  // Эвристика по русскому тексту
  const lower = russianText.toLowerCase();
  if (lower.startsWith("как ") || lower.startsWith("что ") ||
      lower.startsWith("где ") || lower.startsWith("когда ") ||
      lower.endsWith("?")) {
    return "Фраза";
  }

  // Слова-фразы (содержат пробел и без знаков препинания в конце)
  if (russianText.includes(" ") && !russianText.endsWith("!") &&
      !russianText.endsWith("?") && !russianText.endsWith(".")) {
    return "Фраза";
  }

  return null;
}

/**
 * Slugify для создания ключей
 */
function makeKey(ru, lak) {
  return `${ru.toLowerCase().slice(0, 50)}::${lak.toLowerCase().slice(0, 50)}`;
}

// ─────────────────────────────────────────────
// ПАРСЕР
// ─────────────────────────────────────────────

async function fetchAndParse() {
  console.log(`\n📥 Загрузка страницы: ${SOURCE_URL}`);

  let fetch;
  let cheerio;

  try {
    fetch = (await import("node-fetch")).default;
  } catch {
    console.error("❌ Установите node-fetch: npm install node-fetch");
    process.exit(1);
  }

  try {
    cheerio = await import("cheerio");
  } catch {
    console.error("❌ Установите cheerio: npm install cheerio");
    process.exit(1);
  }

  const response = await fetch(SOURCE_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; lak-learn-parser/1.0)",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const { html, charset } = decodeHtmlBuffer(
    buffer,
    response.headers.get("content-type")
  );

  console.log(`✅ Страница загружена (${Math.round(html.length / 1024)} KB), charset: ${charset}`);

  const $ = cheerio.load(html, { decodeEntities: false });

  const words = [];
  const seen = new Set(); // дедупликация
  let currentSection = null;
  let currentCollection = null;
  let totalTables = 0;
  let parsedPairs = 0;
  let skippedPairs = 0;

  // Проходим по всем элементам страницы последовательно
  $("body").find("*").each((_, el) => {
    const tag = el.tagName ? el.tagName.toLowerCase() : "";

    // Определяем заголовок раздела через <h4> или ячейку таблицы с заглавием
    if (tag === "h4" || tag === "h3" || tag === "h2") {
      const headerText = $(el).text().trim().toUpperCase();
      const matched = findSectionByText(headerText);

      if (matched) {
        currentSection = matched.sectionTitle;
        currentCollection = matched.collectionData;
      } else {
        // Важно: не переносим коллекцию через произвольные заголовки
        currentSection = null;
        currentCollection = null;
      }
    }

    // Парсим таблицы с парами русский | лакский
    if (tag === "table") {
      totalTables++;

      let tableCollection = currentCollection;

      // Проверяем ближайший предыдущий заголовок перед таблицей
      const previousHeaderText = $(el)
        .prevAll("h2, h3, h4")
        .first()
        .text()
        .trim()
        .toUpperCase();
      const previousHeaderMatched = findSectionByText(previousHeaderText);
      if (previousHeaderMatched) {
        tableCollection = previousHeaderMatched.collectionData;
      }

      // Проверяем заголовок таблицы — первая строка может содержать название раздела
      const firstRow = $(el).find("tr").first();
      const firstCells = firstRow.find("td, th");

      if (firstCells.length >= 2) {
        const potentialHeader = $(firstCells[0]).text().trim().toUpperCase();

        const tableHeaderMatched = findSectionByText(potentialHeader);
        if (tableHeaderMatched) {
          currentSection = tableHeaderMatched.sectionTitle;
          currentCollection = tableHeaderMatched.collectionData;
          tableCollection = tableHeaderMatched.collectionData;
        } else if (
          potentialHeader.length > 3 &&
          potentialHeader === potentialHeader.toUpperCase() &&
          !potentialHeader.includes(" ")
        ) {
          // Похоже на заголовок, но не наш раздел — не наследуем прошлую коллекцию
          tableCollection = null;
        }
      }

      if (!tableCollection) return; // пропускаем таблицы вне известных разделов

      // Парсим все строки таблицы
      $(el).find("tr").each((rowIdx, row) => {
        const cells = $(row).find("td");
        if (cells.length < 2) return;

        const cell0 = normalizeText($(cells[0]).text());
        const cell1 = normalizeText($(cells[1]).text());

        if (!cell0 || !cell1) return;

        // Первая строка таблицы часто является заголовком раздела
        if (rowIdx === 0) {
          const upper0 = cell0.toUpperCase();
          for (const sectionTitle of Object.keys(SECTION_MAP)) {
            if (upper0 === sectionTitle || upper0.includes(sectionTitle)) {
              return; // это заголовок, пропускаем
            }
          }
        }

        // Пропускаем строки с лакским заголовком (вторая колонка — транслитерация раздела)
        if (cell0 === cell1) return;
        if (cell0.length < 1 || cell1.length < 1) return;

        // Русский текст — первая колонка, лакский — вторая
        const russianRaw = cell0;
        const lakhRaw = cell1;

        const russian = extractPrimaryForm(normalizeText(russianRaw));
        const lakh = extractPrimaryForm(normalizeText(lakhRaw));

        if (!russian || !lakh) return;
        if (russian.length < 1 || lakh.length < 1) return;

        // Пропускаем строки где обе колонки выглядят как заголовки
        if (russian === russian.toUpperCase() &&
            russian.length > 3 &&
            !russian.includes(" ")) {
          return;
        }

        const key = makeKey(russian, lakh);
        if (seen.has(key)) {
          skippedPairs++;
          return;
        }
        seen.add(key);

        const partOfSpeech = detectPartOfSpeech(
          tableCollection.slug,
          russian
        );

        words.push({
          lemma: lakh,           // лакское слово/фраза
          translation: russian,  // русский перевод
          transcription: null,   // транскрипция на сайте не указана
          partOfSpeech,
          collectionSlug: tableCollection.slug,
          collectionTitle: tableCollection.title,
          collectionDescription: tableCollection.description,
          collectionLevel: null,
          collectionIsPublic: true,
          collectionSortOrder: tableCollection.sortOrder,
          collectionRuleTagCodes: [],
          isManual: true,
          isExcluded: false,
        });

        parsedPairs++;
      });
    }
  });

  console.log(`\n📊 Результаты парсинга:`);
  console.log(`   Таблиц найдено:     ${totalTables}`);
  console.log(`   Пар слов/фраз:      ${parsedPairs}`);
  console.log(`   Дубликатов:         ${skippedPairs}`);

  // Статистика по коллекциям
  const byCollection = {};
  for (const w of words) {
    byCollection[w.collectionTitle] = (byCollection[w.collectionTitle] || 0) + 1;
  }

  console.log(`\n📚 По коллекциям:`);
  for (const [title, count] of Object.entries(byCollection).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`   ${count.toString().padStart(4)} слов  — ${title}`);
  }

  return words;
}

// ─────────────────────────────────────────────
// ИМПОРТ В API
// ─────────────────────────────────────────────

async function importToApi(words, baseUrl, cookie, options = {}) {
  const fetch = (await import("node-fetch")).default;

  const url = `${baseUrl}/api/admin/words`;
  console.log(`\n🚀 Импорт ${words.length} слов в ${url}`);

  // Разбиваем на батчи по 200 слов чтобы не перегружать API
  const BATCH_SIZE = 200;
  const batches = [];
  for (let i = 0; i < words.length; i += BATCH_SIZE) {
    batches.push(words.slice(i, i + BATCH_SIZE));
  }

  const fromBatchRaw = Number.parseInt(String(options.fromBatch ?? "1"), 10);
  const toBatchRaw = Number.parseInt(String(options.toBatch ?? String(batches.length)), 10);
  const fromBatch = Number.isInteger(fromBatchRaw) && fromBatchRaw > 0 ? fromBatchRaw : 1;
  const toBatch = Number.isInteger(toBatchRaw) && toBatchRaw > 0 ? toBatchRaw : batches.length;
  const startIndex = Math.max(0, fromBatch - 1);
  const endIndexExclusive = Math.min(batches.length, toBatch);

  if (startIndex >= endIndexExclusive) {
    console.log("\n⚠️ Диапазон батчей пустой. Нечего импортировать.");
    return;
  }

  if (startIndex !== 0 || endIndexExclusive !== batches.length) {
    console.log(
      `\nℹ️ Выбран частичный импорт: батчи ${startIndex + 1}-${endIndexExclusive} из ${batches.length}`
    );
  }

  let totalAdded = 0;
  let totalSkipped = 0;
  let totalInvalid = 0;
  let collectionsCreated = 0;

  for (let i = startIndex; i < endIndexExclusive; i++) {
    const batch = batches[i];
    console.log(
      `\n   Батч ${i + 1}/${batches.length} (${batch.length} слов)...`
    );

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify({
        format: "json",
        mode: "backup",
        content: JSON.stringify(batch),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`   ❌ Ошибка HTTP ${response.status}: ${text}`);
      continue;
    }

    const result = await response.json();
    const s = result.summary || {};

    totalAdded += s.added || 0;
    totalSkipped += s.skipped || 0;
    totalInvalid += s.invalid || 0;
    collectionsCreated += s.collectionsCreated || 0;

    console.log(
      `   ✅ added: ${s.added}, skipped: ${s.skipped}, invalid: ${s.invalid}, collections: ${s.collectionsCreated}`
    );

    if (s.invalidItems && s.invalidItems.length > 0) {
      console.log(`   ⚠️  Невалидные записи (первые 5):`);
      s.invalidItems.slice(0, 5).forEach((item) => {
        console.log(`      #${item.index}: ${item.reason}`);
      });
    }
  }

  console.log(`\n✅ Импорт завершён:`);
  console.log(`   Добавлено слов:        ${totalAdded}`);
  console.log(`   Пропущено (дубли):     ${totalSkipped}`);
  console.log(`   Невалидных:            ${totalInvalid}`);
  console.log(`   Создано коллекций:     ${collectionsCreated}`);
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const importIdx = args.indexOf("--import");
  const baseUrl = importIdx !== -1 ? args[importIdx + 1] : null;
  const fromBatchIdx = args.indexOf("--from-batch");
  const toBatchIdx = args.indexOf("--to-batch");
  const fromBatch = fromBatchIdx !== -1 ? args[fromBatchIdx + 1] : null;
  const toBatch = toBatchIdx !== -1 ? args[toBatchIdx + 1] : null;

  // Cookie для авторизации (получить из браузера: DevTools → Application → Cookies)
  // Формат: "lak_access_token=xxx; lak_refresh_token=yyy"
  const cookieIdx = args.indexOf("--cookie");
  const cookie = cookieIdx !== -1 ? args[cookieIdx + 1] : null;

  console.log("═══════════════════════════════════════════════════");
  console.log("  lak-learn: Парсер Русско-лакского разговорника");
  console.log("═══════════════════════════════════════════════════");

  let words;

  try {
    words = await fetchAndParse();
  } catch (err) {
    console.error(`\n❌ Ошибка парсинга: ${err.message}`);
    process.exit(1);
  }

  if (words.length === 0) {
    console.error("\n❌ Не удалось извлечь слова. Проверьте структуру страницы.");
    process.exit(1);
  }

  // Сохраняем JSON на диск
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(words, null, 2), "utf-8");
  console.log(`\n💾 JSON сохранён: ${OUTPUT_FILE} (${words.length} записей)`);

  if (isDryRun) {
    console.log("\n🔍 Dry-run: первые 10 записей:");
    words.slice(0, 10).forEach((w, i) => {
      console.log(
        `   ${i + 1}. [${w.collectionTitle}] "${w.lemma}" → "${w.translation}"`
      );
    });
    console.log("\n✅ Dry-run завершён. Для импорта используйте --import");
    return;
  }

  if (baseUrl) {
    if (!cookie) {
      console.log(
        "\n⚠️  Cookie не передан (--cookie). Попытка без авторизации..."
      );
      console.log(
        "   Чтобы авторизоваться, войдите в браузере, скопируйте cookie и добавьте:"
      );
      console.log(
        '   --cookie "lak_access_token=xxx; lak_refresh_token=yyy"'
      );
    }

    try {
      await importToApi(words, baseUrl.replace(/\/$/, ""), cookie, {
        fromBatch,
        toBatch,
      });
    } catch (err) {
      console.error(`\n❌ Ошибка импорта: ${err.message}`);
      process.exit(1);
    }
  } else {
    console.log("\n💡 Для импорта в приложение выполните:");
    console.log(
      `   node parse_lakkumaz.js --import http://localhost:3000 --cookie "lak_access_token=..."`
    );
    console.log("\n   Или импортируйте JSON вручную через admin-панель:");
    console.log(`   → /admin → Импорт / Экспорт слов → Режим: Backup → JSON`);
    console.log(`   → Выберите файл: ${OUTPUT_FILE}`);
  }
}

main().catch((err) => {
  console.error(`\n💥 Критическая ошибка: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
