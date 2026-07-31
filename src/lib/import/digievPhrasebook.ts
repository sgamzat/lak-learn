/**
 * Парсер «Русско-лакского разговорника» Л. А. Дигиева (HTML).
 * Источник: parse/lak.html / lakkumaz.narod.ru
 */

export type DigievPhrase = {
  lemma: string;
  translation: string;
  notes: string | null;
  wordType: "phrase";
  translationPriority: 1;
  collectionSlug: string;
  collectionTitle: string;
  collectionTitleLak: string | null;
  collectionDescription: string;
  collectionSortOrder: number;
  collectionKind: "topic";
  chapter: number;
};

export type DigievChapter = {
  chapter: number;
  slug: string;
  titleRu: string;
  titleLak: string | null;
  phrases: Array<{ lemma: string; translation: string; notes: string | null }>;
};

const CYR_TO_LAT: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
  і: "i",
  ӏ: "i",
  Ӏ: "i"
};

function cleanText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function translitSlug(value: string): string {
  const lower = value.toLowerCase();
  let out = "";
  for (const ch of lower) {
    if (CYR_TO_LAT[ch] !== undefined) {
      out += CYR_TO_LAT[ch];
    } else if (/[a-z0-9]/.test(ch)) {
      out += ch;
    } else if (/[\s._—–−-]+/.test(ch)) {
      out += "-";
    }
  }
  return out
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function digievCollectionSlug(chapter: number, titleRu: string): string {
  const base = translitSlug(titleRu) || "tema";
  return `digiev-${String(chapter).padStart(2, "0")}-${base}`;
}

type RawCell = { text: string; alignRight: boolean };

type RawRow = { cells: RawCell[]; alignRight: boolean };

function extractRowsFromTableHtml(tableHtml: string): RawRow[] {
  const rows: RawRow[] = [];
  const trRe = /<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;
  while ((trMatch = trRe.exec(tableHtml))) {
    const trAttrs = trMatch[1] ?? "";
    const trBody = trMatch[2] ?? "";
    const rowAlignRight = /align\s*=\s*["']?right/i.test(trAttrs);

    if (/<th\b/i.test(trBody)) {
      continue;
    }

    const cells: RawCell[] = [];
    const tdRe = /<td\b([^>]*)>([\s\S]*?)(?=<td\b|<\/tr>|$)/gi;
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRe.exec(trBody))) {
      const attrs = tdMatch[1] ?? "";
      const inner = tdMatch[2] ?? "";
      // Skip nested tables' outer wrapper cells that only contain another table
      if (/<table\b/i.test(inner)) {
        continue;
      }
      cells.push({
        text: cleanText(inner),
        alignRight: rowAlignRight || /align\s*=\s*["']?right/i.test(attrs)
      });
    }

    if (cells.length >= 2) {
      rows.push({ cells: cells.slice(0, 2), alignRight: rowAlignRight });
    } else if (cells.length === 1 && cells[0].text) {
      rows.push({
        cells: [cells[0], { text: "", alignRight: false }],
        alignRight: rowAlignRight
      });
    }
  }
  return rows;
}

function combineParentChild(parentRu: string, childRu: string): string {
  const p = parentRu.replace(/:\s*$/, "").trim();
  const c = childRu.replace(/^\.+/, "").trim();
  if (!p) return c;
  if (!c) return p;
  if (p.includes("...") || p.endsWith("…")) {
    return `${p.replace(/\.{3}|…/g, "").trim()} ${c}`.replace(/\s+/g, " ").trim();
  }
  if (c.startsWith("(") && c.endsWith(")")) {
    return `${p} ${c}`;
  }
  return `${p} (${c})`;
}

function rowsToPhrases(
  rows: RawRow[]
): Array<{ lemma: string; translation: string; notes: string | null }> {
  const phrases: Array<{ lemma: string; translation: string; notes: string | null }> = [];
  let i = 0;

  while (i < rows.length) {
    const row = rows[i];
    const ru = row.cells[0]?.text ?? "";
    const lak = row.cells[1]?.text ?? "";
    const isChild = row.alignRight || row.cells[0]?.alignRight;

    // Parent with empty Lak followed by indented children
    if (!isChild && ru && !lak) {
      const children: RawRow[] = [];
      let j = i + 1;
      while (j < rows.length) {
        const next = rows[j];
        const nextChild =
          next.alignRight || next.cells[0]?.alignRight;
        const nextRu = next.cells[0]?.text ?? "";
        const nextLak = next.cells[1]?.text ?? "";
        if (!nextChild) break;
        if (!nextRu && !nextLak) {
          j += 1;
          continue;
        }
        children.push(next);
        j += 1;
      }

      if (children.length) {
        for (const child of children) {
          const childRu = child.cells[0]?.text ?? "";
          const childLak = child.cells[1]?.text ?? "";
          if (!childLak) continue;
          phrases.push({
            translation: combineParentChild(ru, childRu),
            lemma: childLak,
            notes: null
          });
        }
        i = j;
        continue;
      }

      i += 1;
      continue;
    }

    // Parent with both sides + indented continuations (...друг)
    if (!isChild && ru && lak) {
      const children: RawRow[] = [];
      let j = i + 1;
      while (j < rows.length) {
        const next = rows[j];
        const nextChild =
          next.alignRight || next.cells[0]?.alignRight;
        if (!nextChild) break;
        children.push(next);
        j += 1;
      }

      if (children.length) {
        phrases.push({ translation: ru, lemma: lak, notes: null });
        for (const child of children) {
          const childRu = child.cells[0]?.text ?? "";
          const childLak = child.cells[1]?.text ?? "";
          if (!childLak && !childRu) continue;
          phrases.push({
            translation: combineParentChild(ru, childRu),
            lemma: childLak || lak,
            notes: childRu || null
          });
        }
        i = j;
        continue;
      }

      phrases.push({ translation: ru, lemma: lak, notes: null });
      i += 1;
      continue;
    }

    // Standalone child without parent context — keep as-is if both present
    if (ru && lak) {
      phrases.push({ translation: ru, lemma: lak, notes: null });
    }

    i += 1;
  }

  // Deduplicate within chapter
  const seen = new Set<string>();
  const unique: typeof phrases = [];
  for (const p of phrases) {
    const lemma = p.lemma.trim();
    const translation = p.translation.trim();
    if (!lemma || !translation) continue;
    if (lemma.length < 1 || translation.length < 1) continue;
    const key = `${lemma.toLowerCase()}\0${translation.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ lemma, translation, notes: p.notes });
  }
  return unique;
}

function extractTitleFromSection(sectionHtml: string): { ru: string; lak: string | null } {
  const ths: string[] = [];
  const thRe = /<th\b[^>]*>([\s\S]*?)<\/th>/gi;
  let m: RegExpExecArray | null;
  while ((m = thRe.exec(sectionHtml)) && ths.length < 2) {
    const t = cleanText(m[1] ?? "");
    if (t) ths.push(t);
  }
  if (ths.length >= 1) {
    return { ru: ths[0], lak: ths[1] ?? null };
  }

  const h4 = sectionHtml.match(/<h4\b[^>]*>([\s\S]*?)<\/h4>/i);
  const h3 = sectionHtml.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i);
  const ru = h4 ? cleanText(h4[1]) : "";
  const lak = h3 ? cleanText(h3[1]) : null;
  return { ru: ru || "Без названия", lak };
}

function collectTableHtmls(sectionHtml: string): string[] {
  const tables: string[] = [];
  const re = /<table\b[^>]*>[\s\S]*?<\/table>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sectionHtml))) {
    tables.push(m[0]);
  }
  // Prefer leaf tables (with td pairs, without nested table) when nested layout exists
  const leaf = tables.filter((t) => !/<table\b/i.test(t.replace(/^<table\b[^>]*>/i, "")));
  if (leaf.length) return leaf;
  return tables;
}

/**
 * Разбирает HTML разговорника Дигиева на главы и пары RU|Лак.
 * Пропускает glava00 (предисловие).
 */
export function parseDigievHtml(html: string): DigievChapter[] {
  const chapters: DigievChapter[] = [];
  const parts = html.split(/<a\s+name="(glava\d+)"\s*>\s*<\/a>/i);

  for (let i = 1; i < parts.length; i += 2) {
    const anchor = parts[i] ?? "";
    const sectionHtml = parts[i + 1] ?? "";
    const numMatch = anchor.match(/glava(\d+)/i);
    if (!numMatch) continue;
    const chapter = Number.parseInt(numMatch[1], 10);
    if (!Number.isFinite(chapter) || chapter < 1) continue;

    const { ru, lak } = extractTitleFromSection(sectionHtml);
    const tableHtmls = collectTableHtmls(sectionHtml);
    const allRows: RawRow[] = [];
    for (const tableHtml of tableHtmls) {
      allRows.push(...extractRowsFromTableHtml(tableHtml));
    }

    const phrases = rowsToPhrases(allRows);
    if (!phrases.length) continue;

    chapters.push({
      chapter,
      slug: digievCollectionSlug(chapter, ru),
      titleRu: ru,
      titleLak: lak,
      phrases
    });
  }

  chapters.sort((a, b) => a.chapter - b.chapter);
  return chapters;
}

/** Плоский список записей для импорта в БД. */
export function chaptersToImportRecords(chapters: DigievChapter[]): DigievPhrase[] {
  const records: DigievPhrase[] = [];
  for (const ch of chapters) {
    const description = ch.titleLak
      ? `${ch.titleLak} · Дигиев, гл. ${ch.chapter}`
      : `Дигиев, гл. ${ch.chapter}`;

    for (const p of ch.phrases) {
      records.push({
        lemma: p.lemma,
        translation: p.translation,
        notes: p.notes,
        wordType: "phrase",
        translationPriority: 1,
        collectionSlug: ch.slug,
        collectionTitle: ch.titleRu,
        collectionTitleLak: ch.titleLak,
        collectionDescription: description,
        collectionSortOrder: ch.chapter,
        collectionKind: "topic",
        chapter: ch.chapter
      });
    }
  }
  return records;
}
