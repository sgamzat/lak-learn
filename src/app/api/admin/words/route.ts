import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "@/lib/server/auth";
import { withTransaction } from "@/lib/server/db";
import { setAccessCookie } from "@/lib/server/session";

type CreateWordBody = {
  lemma?: string;
  translation?: string;
  transcription?: string;
  partOfSpeech?: string;
};

type ImportWordsBody = {
  format?: "json" | "yaml" | "csv";
  mode?: "flat" | "backup";
  content?: string;
};

type WordRow = {
  id: number;
  lemma: string;
  translation: string;
  transcription: string | null;
  part_of_speech: string | null;
};

type ExportWordRow = WordRow & {
  collection_slug: string | null;
  collection_title: string | null;
  collection_description: string | null;
  collection_level: string | null;
  collection_is_public: boolean | null;
  collection_sort_order: number | null;
  collection_rule_tag_codes: string[] | null;
  is_manual: boolean;
  is_excluded: boolean;
};

type ParsedWord = {
  lemma: string | null;
  translation: string | null;
  transcription: string | null;
  partOfSpeech: string | null;
  collectionSlug: string | null;
  collectionTitle: string | null;
  collectionDescription: string | null;
  collectionLevel: string | null;
  collectionIsPublic: string | null;
  collectionSortOrder: string | null;
  collectionRuleTagCodes: string | null;
  isManual: string | null;
  isExcluded: string | null;
};

type ImportParseResult = {
  words: ParsedWord[];
};

type TransferMode = "flat" | "backup";

type ExistingWordRow = {
  id: number;
  lemma: string;
  translation: string;
  transcription: string | null;
  part_of_speech: string | null;
};

type ExistingCollectionRow = {
  id: number;
  slug: string;
};

type ExistingLinkRow = {
  id: number;
};

function normalizeOptional(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function makeWordKey(lemma: string, translation: string): string {
  return `${lemma}\u0000${translation}`;
}

function normalizeOptionalFlexible(value: unknown): string | null {
  if (typeof value === "string") {
    return normalizeOptional(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function normalizeSlug(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return value.trim().toLowerCase().replaceAll(/\s+/g, "-");
}

function parseBooleanOptional(value: string | null): boolean | null {
  if (!value) {
    return null;
  }

  const lowered = value.toLowerCase();

  if (["1", "true", "yes", "y", "да"].includes(lowered)) {
    return true;
  }

  if (["0", "false", "no", "n", "нет"].includes(lowered)) {
    return false;
  }

  return null;
}

function parseIntegerOptional(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseTagCodes(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length > 0)
    )
  );
}

function csvBoolean(value: boolean | null): string {
  if (value === null) {
    return "";
  }

  return value ? "true" : "false";
}

function csvInteger(value: number | null): string {
  if (value === null) {
    return "";
  }

  return String(value);
}

function escapeCsvCell(value: string | null): string {
  if (value === null) {
    return "";
  }

  const escaped = value.replaceAll('"', '""');
  if (escaped.includes(",") || escaped.includes("\n") || escaped.includes("\r") || escaped.includes('"')) {
    return `"${escaped}"`;
  }

  return escaped;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        const next = line[i + 1];
        if (next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function yamlString(value: string | null): string {
  if (value === null) {
    return "null";
  }

  return JSON.stringify(value);
}

function parseYamlScalar(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed || trimmed === "null") {
    return null;
  }

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed) as string;
    } catch {
      return trimmed.slice(1, -1);
    }
  }

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }

  return trimmed;
}

function parseYamlWords(content: string): ParsedWord[] {
  const lines = content.split(/\r?\n/);
  const words: ParsedWord[] = [];
  let current: ParsedWord | null = null;

  const applyEntry = (source: string, target: ParsedWord) => {
    const separatorIndex = source.indexOf(":");
    if (separatorIndex === -1) {
      return;
    }

    const key = source.slice(0, separatorIndex).trim();
    const rawValue = source.slice(separatorIndex + 1);
    const parsed = parseYamlScalar(rawValue);

    if (key === "lemma") {
      target.lemma = parsed;
    } else if (key === "translation") {
      target.translation = parsed;
    } else if (key === "transcription") {
      target.transcription = parsed;
    } else if (key === "partOfSpeech") {
      target.partOfSpeech = parsed;
    } else if (key === "collectionSlug") {
      target.collectionSlug = parsed;
    } else if (key === "collectionTitle") {
      target.collectionTitle = parsed;
    } else if (key === "collectionDescription") {
      target.collectionDescription = parsed;
    } else if (key === "collectionLevel") {
      target.collectionLevel = parsed;
    } else if (key === "collectionIsPublic") {
      target.collectionIsPublic = parsed;
    } else if (key === "collectionSortOrder") {
      target.collectionSortOrder = parsed;
    } else if (key === "collectionRuleTagCodes") {
      target.collectionRuleTagCodes = parsed;
    } else if (key === "isManual") {
      target.isManual = parsed;
    } else if (key === "isExcluded") {
      target.isExcluded = parsed;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    if (line.startsWith("- ")) {
      if (current) {
        words.push(current);
      }

      current = {
        lemma: null,
        translation: null,
        transcription: null,
        partOfSpeech: null,
        collectionSlug: null,
        collectionTitle: null,
        collectionDescription: null,
        collectionLevel: null,
        collectionIsPublic: null,
        collectionSortOrder: null,
        collectionRuleTagCodes: null,
        isManual: null,
        isExcluded: null
      };
      const inline = line.slice(2).trim();
      if (inline) {
        applyEntry(inline, current);
      }
      continue;
    }

    if (!current) {
      continue;
    }

    applyEntry(line, current);
  }

  if (current) {
    words.push(current);
  }

  return words;
}

function parseImportContent(format: "json" | "yaml" | "csv", content: string): ImportParseResult {
  if (format === "json") {
    const parsed = JSON.parse(content) as unknown;
    const array = Array.isArray(parsed)
      ? parsed
      : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { words?: unknown[] }).words)
        ? ((parsed as { words: unknown[] }).words ?? [])
        : [];

    if (!Array.isArray(array)) {
      return { words: [] };
    }

    return {
      words: array.map((entry) => {
        const item = (entry ?? {}) as Record<string, unknown>;
        return {
          lemma: normalizeOptionalFlexible(item.lemma),
          translation: normalizeOptionalFlexible(item.translation),
          transcription: normalizeOptionalFlexible(item.transcription),
          partOfSpeech: normalizeOptionalFlexible(item.partOfSpeech),
          collectionSlug: normalizeOptionalFlexible(item.collectionSlug),
          collectionTitle: normalizeOptionalFlexible(item.collectionTitle),
          collectionDescription: normalizeOptionalFlexible(item.collectionDescription),
          collectionLevel: normalizeOptionalFlexible(item.collectionLevel),
          collectionIsPublic: normalizeOptionalFlexible(item.collectionIsPublic),
          collectionSortOrder: normalizeOptionalFlexible(item.collectionSortOrder),
          collectionRuleTagCodes: Array.isArray(item.collectionRuleTagCodes)
            ? (item.collectionRuleTagCodes as unknown[])
                .map((entryValue) => normalizeOptionalFlexible(entryValue))
                .filter((entryValue): entryValue is string => Boolean(entryValue))
                .join(",")
            : normalizeOptionalFlexible(item.collectionRuleTagCodes),
          isManual: normalizeOptionalFlexible(item.isManual),
          isExcluded: normalizeOptionalFlexible(item.isExcluded)
        };
      })
    };
  }

  if (format === "yaml") {
    return {
      words: parseYamlWords(content).map((entry) => ({
        lemma: normalizeOptional(entry.lemma),
        translation: normalizeOptional(entry.translation),
        transcription: normalizeOptional(entry.transcription),
        partOfSpeech: normalizeOptional(entry.partOfSpeech),
        collectionSlug: normalizeOptional(entry.collectionSlug),
        collectionTitle: normalizeOptional(entry.collectionTitle),
        collectionDescription: normalizeOptional(entry.collectionDescription),
        collectionLevel: normalizeOptional(entry.collectionLevel),
        collectionIsPublic: normalizeOptional(entry.collectionIsPublic),
        collectionSortOrder: normalizeOptional(entry.collectionSortOrder),
        collectionRuleTagCodes: normalizeOptional(entry.collectionRuleTagCodes),
        isManual: normalizeOptional(entry.isManual),
        isExcluded: normalizeOptional(entry.isExcluded)
      }))
    };
  }

  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (!lines.length) {
    return { words: [] };
  }

  const header = parseCsvLine(lines[0]).map((column) => column.trim());
  const lemmaIndex = header.indexOf("lemma");
  const translationIndex = header.indexOf("translation");
  const transcriptionIndex = header.indexOf("transcription");
  const partOfSpeechIndex = header.indexOf("partOfSpeech");
  const collectionSlugIndex = header.indexOf("collectionSlug");
  const collectionTitleIndex = header.indexOf("collectionTitle");
  const collectionDescriptionIndex = header.indexOf("collectionDescription");
  const collectionLevelIndex = header.indexOf("collectionLevel");
  const collectionIsPublicIndex = header.indexOf("collectionIsPublic");
  const collectionSortOrderIndex = header.indexOf("collectionSortOrder");
  const collectionRuleTagCodesIndex = header.indexOf("collectionRuleTagCodes");
  const isManualIndex = header.indexOf("isManual");
  const isExcludedIndex = header.indexOf("isExcluded");

  const words = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return {
      lemma: normalizeOptional(lemmaIndex >= 0 ? cells[lemmaIndex] : null),
      translation: normalizeOptional(translationIndex >= 0 ? cells[translationIndex] : null),
      transcription: normalizeOptional(transcriptionIndex >= 0 ? cells[transcriptionIndex] : null),
      partOfSpeech: normalizeOptional(partOfSpeechIndex >= 0 ? cells[partOfSpeechIndex] : null),
      collectionSlug: normalizeOptional(collectionSlugIndex >= 0 ? cells[collectionSlugIndex] : null),
      collectionTitle: normalizeOptional(collectionTitleIndex >= 0 ? cells[collectionTitleIndex] : null),
      collectionDescription: normalizeOptional(collectionDescriptionIndex >= 0 ? cells[collectionDescriptionIndex] : null),
      collectionLevel: normalizeOptional(collectionLevelIndex >= 0 ? cells[collectionLevelIndex] : null),
      collectionIsPublic: normalizeOptional(collectionIsPublicIndex >= 0 ? cells[collectionIsPublicIndex] : null),
      collectionSortOrder: normalizeOptional(collectionSortOrderIndex >= 0 ? cells[collectionSortOrderIndex] : null),
      collectionRuleTagCodes: normalizeOptional(
        collectionRuleTagCodesIndex >= 0 ? cells[collectionRuleTagCodesIndex] : null
      ),
      isManual: normalizeOptional(isManualIndex >= 0 ? cells[isManualIndex] : null),
      isExcluded: normalizeOptional(isExcludedIndex >= 0 ? cells[isExcludedIndex] : null)
    };
  });

  return { words };
}

function parseExportFormat(value: string | null): "json" | "yaml" | "csv" | null {
  if (value === "json" || value === "yaml" || value === "csv") {
    return value;
  }

  return null;
}

function parseTransferMode(value: string | null | undefined): TransferMode {
  if (value === "backup") {
    return "backup";
  }

  return "flat";
}

function serializeWords(format: "json" | "yaml" | "csv", mode: TransferMode, words: ExportWordRow[]): string {
  if (format === "json") {
    const payload = words.map((row) => ({
        lemma: row.lemma,
        translation: row.translation,
        transcription: row.transcription,
        partOfSpeech: row.part_of_speech,
        collectionSlug: row.collection_slug,
        ...(mode === "backup"
          ? {
              collectionTitle: row.collection_title,
              collectionDescription: row.collection_description,
              collectionLevel: row.collection_level,
              collectionIsPublic: row.collection_is_public,
              collectionSortOrder: row.collection_sort_order,
              collectionRuleTagCodes: row.collection_rule_tag_codes ?? [],
              isManual: row.is_manual,
              isExcluded: row.is_excluded
            }
          : {})
      }));

    return JSON.stringify(payload, null, 2);
  }

  if (format === "yaml") {
    return words
      .map(
        (row) =>
          `- lemma: ${yamlString(row.lemma)}\n  translation: ${yamlString(row.translation)}\n  transcription: ${yamlString(
            row.transcription
          )}\n  partOfSpeech: ${yamlString(row.part_of_speech)}\n  collectionSlug: ${yamlString(row.collection_slug)}${
            mode === "backup"
              ? `\n  collectionTitle: ${yamlString(row.collection_title)}\n  collectionDescription: ${yamlString(
                  row.collection_description
                )}\n  collectionLevel: ${yamlString(row.collection_level)}\n  collectionIsPublic: ${yamlString(
                  row.collection_is_public === null ? null : row.collection_is_public ? "true" : "false"
                )}\n  collectionSortOrder: ${yamlString(
                  row.collection_sort_order === null ? null : String(row.collection_sort_order)
                )}\n  collectionRuleTagCodes: ${yamlString((row.collection_rule_tag_codes ?? []).join(","))}\n  isManual: ${yamlString(
                  row.is_manual ? "true" : "false"
                )}\n  isExcluded: ${yamlString(row.is_excluded ? "true" : "false")}`
              : ""
          }`
      )
      .join("\n");
  }

  const baseHeader = ["lemma", "translation", "transcription", "partOfSpeech", "collectionSlug"];
  const backupHeader = [
    "collectionTitle",
    "collectionDescription",
    "collectionLevel",
    "collectionIsPublic",
    "collectionSortOrder",
    "collectionRuleTagCodes",
    "isManual",
    "isExcluded"
  ];
  const header = [...baseHeader, ...(mode === "backup" ? backupHeader : [])].join(",");
  const body = words
    .map((row) => {
      const baseCells = [
        escapeCsvCell(row.lemma),
        escapeCsvCell(row.translation),
        escapeCsvCell(row.transcription),
        escapeCsvCell(row.part_of_speech),
        escapeCsvCell(row.collection_slug)
      ];

      const backupCells = [
        escapeCsvCell(row.collection_title),
        escapeCsvCell(row.collection_description),
        escapeCsvCell(row.collection_level),
        escapeCsvCell(csvBoolean(row.collection_is_public)),
        escapeCsvCell(csvInteger(row.collection_sort_order)),
        escapeCsvCell((row.collection_rule_tag_codes ?? []).join(",")),
        escapeCsvCell(csvBoolean(row.is_manual)),
        escapeCsvCell(csvBoolean(row.is_excluded))
      ];

      const cells = [...baseCells, ...(mode === "backup" ? backupCells : [])];
      return cells.join(",");
    })
    .join("\n");

  return `${header}${body ? `\n${body}` : ""}`;
}

function contentTypeByFormat(format: "json" | "yaml" | "csv"): string {
  if (format === "json") {
    return "application/json; charset=utf-8";
  }

  if (format === "yaml") {
    return "application/x-yaml; charset=utf-8";
  }

  return "text/csv; charset=utf-8";
}

async function requireAdmin(request: Request) {
  const auth = await getAuthContextFromRequest(request);

  if (!auth) {
    return { auth: null, response: NextResponse.json({ error: "Не авторизован" }, { status: 401 }) };
  }

  if (auth.user.role !== "admin") {
    return { auth: null, response: NextResponse.json({ error: "Недостаточно прав" }, { status: 403 }) };
  }

  return { auth, response: null };
}

export async function GET(request: Request) {
  const guard = await requireAdmin(request);

  if (!guard.auth || guard.response) {
    return guard.response;
  }

  const url = new URL(request.url);
  const searchQuery = normalizeOptional(url.searchParams.get("q"));

  if (searchQuery) {
    const limitRaw = normalizeOptional(url.searchParams.get("limit"));
    const parsedLimit = limitRaw ? Number.parseInt(limitRaw, 10) : 10;
    const safeLimit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 10) : 10;
    const loweredSearch = searchQuery.toLowerCase();
    const containsPattern = `%${loweredSearch}%`;
    const startsWithPattern = `${loweredSearch}%`;

    const wordsResult = await withTransaction(async (client) => {
      const result = await client.query<WordRow>(
        `
          SELECT id, lemma, translation, transcription, part_of_speech
          FROM words w
          WHERE w.is_active = TRUE
            AND (
              LOWER(w.lemma) LIKE $1
              OR LOWER(w.translation) LIKE $1
            )
          ORDER BY
            CASE WHEN LOWER(w.lemma) LIKE $2 THEN 0 ELSE 1 END ASC,
            CASE WHEN LOWER(w.translation) LIKE $2 THEN 0 ELSE 1 END ASC,
            w.id ASC
          LIMIT $3
        `,
        [containsPattern, startsWithPattern, safeLimit]
      );

      return result.rows;
    });

    const response = NextResponse.json(
      {
        words: wordsResult.map((row) => ({
          id: row.id,
          lemma: row.lemma,
          translation: row.translation,
          transcription: row.transcription,
          partOfSpeech: row.part_of_speech
        }))
      },
      { status: 200 }
    );

    if (guard.auth.refreshedAccessToken) {
      setAccessCookie(response, guard.auth.refreshedAccessToken);
    }

    return response;
  }

  const format = parseExportFormat(url.searchParams.get("format"));
  const mode = parseTransferMode(url.searchParams.get("mode"));

  if (!format) {
    return NextResponse.json({ error: "Параметр format должен быть json, yaml или csv" }, { status: 400 });
  }

  const rowsResult = await withTransaction(async (client) => {
    const wordsResult = await client.query<ExportWordRow>(
      `
        SELECT
          w.id,
          w.lemma,
          w.translation,
          w.transcription,
          w.part_of_speech,
          c.slug AS collection_slug,
          c.title AS collection_title,
          c.description AS collection_description,
          c.level AS collection_level,
          c.is_public AS collection_is_public,
          c.sort_order AS collection_sort_order,
          c.rule_tag_codes AS collection_rule_tag_codes,
          COALESCE(cw.is_manual, FALSE) AS is_manual,
          COALESCE(cw.is_excluded, FALSE) AS is_excluded
        FROM words w
        LEFT JOIN collection_words cw ON cw.word_id = w.id
        LEFT JOIN collections c ON c.id = cw.collection_id AND c.is_active = TRUE
        WHERE w.is_active = TRUE
        ORDER BY w.id ASC, c.id ASC NULLS LAST
      `
    );

    await client.query(
      `
        INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, payload)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        guard.auth.user.id,
        "admin.word.export",
        "word",
        "bulk",
        JSON.stringify({ format, mode, count: wordsResult.rowCount ?? wordsResult.rows.length })
      ]
    );

    return wordsResult.rows;
  });

  const content = serializeWords(format, mode, rowsResult);
  const response = new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": contentTypeByFormat(format),
      "Content-Disposition": `attachment; filename="words-${mode}-export.${format}"`
    }
  });

  if (guard.auth.refreshedAccessToken) {
    setAccessCookie(response, guard.auth.refreshedAccessToken);
  }

  return response;
}

export async function PUT(request: Request) {
  const guard = await requireAdmin(request);

  if (!guard.auth || guard.response) {
    return guard.response;
  }

  let body: ImportWordsBody;

  try {
    body = (await request.json()) as ImportWordsBody;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const format = parseExportFormat(body.format ?? null);
  const mode = parseTransferMode(body.mode ?? null);
  const content = typeof body.content === "string" ? body.content : "";

  if (!format) {
    return NextResponse.json({ error: "format должен быть json, yaml или csv" }, { status: 400 });
  }

  if (!content.trim()) {
    return NextResponse.json({ error: "Пустой файл импорта" }, { status: 400 });
  }

  let parsed: ImportParseResult;

  try {
    parsed = parseImportContent(format, content);
  } catch {
    return NextResponse.json({ error: "Не удалось распарсить файл. Проверьте формат и содержимое" }, { status: 400 });
  }

  const summary = await withTransaction(async (client) => {
    const existingRows = await client.query<ExistingWordRow>(
      `
        SELECT id, lemma, translation, transcription, part_of_speech
        FROM words
        WHERE is_active = TRUE
      `
    );

    const existingCollectionsResult = await client.query<ExistingCollectionRow>(
      `
        SELECT id, slug
        FROM collections
        WHERE is_active = TRUE
      `
    );

    const existingCollectionsBySlug = new Map(
      existingCollectionsResult.rows.map((row) => [row.slug.toLowerCase(), row.id] as const)
    );

    const existingWords = new Map(existingRows.rows.map((row) => [makeWordKey(row.lemma, row.translation), row] as const));

    let added = 0;
    let updated = 0;
    let skipped = 0;
    let invalid = 0;
    let collectionsCreated = 0;
    let linksAdded = 0;
    let linksUpdated = 0;
    let linksSkipped = 0;
    const invalidItems: Array<{ index: number; reason: string }> = [];

    for (let index = 0; index < parsed.words.length; index += 1) {
      const item = parsed.words[index];
      const lemma = normalizeOptional(item.lemma);
      const translation = normalizeOptional(item.translation);
      const collectionSlug = normalizeSlug(normalizeOptional(item.collectionSlug));

      if (!lemma || !translation) {
        invalid += 1;
        if (invalidItems.length < 50) {
          invalidItems.push({ index: index + 1, reason: "lemma и translation обязательны" });
        }
        continue;
      }

      if (!collectionSlug) {
        invalid += 1;
        if (invalidItems.length < 50) {
          invalidItems.push({ index: index + 1, reason: "collectionSlug обязателен" });
        }
        continue;
      }

      const key = makeWordKey(lemma, translation);
      const incomingTranscription = normalizeOptional(item.transcription);
      const incomingPartOfSpeech = normalizeOptional(item.partOfSpeech);

      let wordId: number;
      const existingWord = existingWords.get(key);

      if (!existingWord) {
        const insertResult = await client.query<{ id: number }>(
          `
            INSERT INTO words (lemma, translation, transcription, part_of_speech, created_by, updated_by)
            VALUES ($1, $2, $3, $4, $5, $5)
            RETURNING id
          `,
          [lemma, translation, incomingTranscription, incomingPartOfSpeech, guard.auth.user.id]
        );

        wordId = insertResult.rows[0].id;
        existingWords.set(key, {
          id: wordId,
          lemma,
          translation,
          transcription: incomingTranscription,
          part_of_speech: incomingPartOfSpeech
        });
        added += 1;
      } else {
        wordId = existingWord.id;

        const nextTranscription = mode === "backup" ? incomingTranscription : existingWord.transcription;
        const nextPartOfSpeech = mode === "backup" ? incomingPartOfSpeech : existingWord.part_of_speech;

        const shouldUpdateWord =
          mode === "backup" &&
          (nextTranscription !== existingWord.transcription || nextPartOfSpeech !== existingWord.part_of_speech);

        if (shouldUpdateWord) {
          await client.query(
            `
              UPDATE words
              SET transcription = $2, part_of_speech = $3, updated_by = $4, updated_at = NOW()
              WHERE id = $1
            `,
            [wordId, nextTranscription, nextPartOfSpeech, guard.auth.user.id]
          );

          existingWords.set(key, {
            ...existingWord,
            transcription: nextTranscription,
            part_of_speech: nextPartOfSpeech
          });
          updated += 1;
        } else {
          skipped += 1;
        }
      }

      let collectionId = existingCollectionsBySlug.get(collectionSlug);
      if (!collectionId) {
        const createdCollection = await client.query<{ id: number }>(
          `
            INSERT INTO collections (
              slug,
              title,
              description,
              level,
              cover_url,
              is_public,
              sort_order,
              rule_tag_codes,
              created_by,
              updated_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[], $9, $9)
            RETURNING id
          `,
          [
            collectionSlug,
            normalizeOptional(item.collectionTitle) ?? collectionSlug,
            normalizeOptional(item.collectionDescription),
            normalizeOptional(item.collectionLevel)?.toUpperCase() ?? null,
            null,
            parseBooleanOptional(normalizeOptional(item.collectionIsPublic)) ?? false,
            parseIntegerOptional(normalizeOptional(item.collectionSortOrder)) ?? 0,
            parseTagCodes(normalizeOptional(item.collectionRuleTagCodes)),
            guard.auth.user.id
          ]
        );

        collectionId = createdCollection.rows[0].id;
        existingCollectionsBySlug.set(collectionSlug, collectionId);
        collectionsCreated += 1;
      }

      const isManual = mode === "backup" ? (parseBooleanOptional(normalizeOptional(item.isManual)) ?? true) : true;
      const isExcluded = mode === "backup" ? (parseBooleanOptional(normalizeOptional(item.isExcluded)) ?? false) : false;

      const insertedLinkResult = await client.query<ExistingLinkRow>(
        `
          INSERT INTO collection_words (collection_id, word_id, is_manual, is_excluded, updated_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (collection_id, word_id)
          DO NOTHING
          RETURNING word_id AS id
        `,
        [collectionId, wordId, isManual, isExcluded]
      );

      if (insertedLinkResult.rowCount) {
        linksAdded += 1;
        continue;
      }

      const updatedLinkResult = await client.query<ExistingLinkRow>(
        `
          UPDATE collection_words
          SET is_manual = $3, is_excluded = $4, updated_at = NOW()
          WHERE collection_id = $1
            AND word_id = $2
            AND (is_manual IS DISTINCT FROM $3 OR is_excluded IS DISTINCT FROM $4)
          RETURNING word_id AS id
        `,
        [collectionId, wordId, isManual, isExcluded]
      );

      if (updatedLinkResult.rowCount) {
        linksUpdated += 1;
      } else {
        linksSkipped += 1;
      }
    }

    await client.query(
      `
        INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, payload)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        guard.auth.user.id,
        "admin.word.import",
        "word",
        "bulk",
        JSON.stringify({
          format,
          mode,
          total: parsed.words.length,
          added,
          updated,
          skipped,
          invalid,
          collectionsCreated,
          linksAdded,
          linksUpdated,
          linksSkipped
        })
      ]
    );

    return {
      total: parsed.words.length,
      added,
      updated,
      skipped,
      invalid,
      collectionsCreated,
      linksAdded,
      linksUpdated,
      linksSkipped,
      invalidItems
    };
  });

  const response = NextResponse.json(
    {
      ok: true,
      summary
    },
    { status: 200 }
  );

  if (guard.auth.refreshedAccessToken) {
    setAccessCookie(response, guard.auth.refreshedAccessToken);
  }

  return response;
}

export async function POST(request: Request) {
  const guard = await requireAdmin(request);

  if (!guard.auth || guard.response) {
    return guard.response;
  }

  let body: CreateWordBody;

  try {
    body = (await request.json()) as CreateWordBody;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const lemma = normalizeOptional(body.lemma);
  const translation = normalizeOptional(body.translation);

  if (!lemma || !translation) {
    return NextResponse.json({ error: "lemma и translation обязательны" }, { status: 400 });
  }

  const created = await withTransaction(async (client) => {
    const wordResult = await client.query<{ id: number }>(
      `
        INSERT INTO words (lemma, translation, transcription, part_of_speech, created_by, updated_by)
        VALUES ($1, $2, $3, $4, $5, $5)
        RETURNING id
      `,
        [
          lemma,
          translation,
          normalizeOptional(body.transcription),
          normalizeOptional(body.partOfSpeech),
          guard.auth.user.id
        ]
      );

    const wordId = wordResult.rows[0].id;

    await client.query(
      `
        INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, payload)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [guard.auth.user.id, "admin.word.create", "word", String(wordId), JSON.stringify({ lemma, translation })]
    );

    return wordId;
  });

  const response = NextResponse.json({ id: created, ok: true }, { status: 201 });

  if (guard.auth.refreshedAccessToken) {
    setAccessCookie(response, guard.auth.refreshedAccessToken);
  }

  return response;
}
