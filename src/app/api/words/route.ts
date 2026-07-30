// src/app/api/words/route.ts
import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { setAccessCookie } from "@/lib/server/session";
import type { DictionaryWord } from "@/types/word";

// ─── Тип строки из БД ────────────────────────────────────────────────────────

type WordRow = {
  id:                   number;
  lemma:                string;
  translation:          string;
  transcription:        string | null;
  part_of_speech:       string | null;
  gender:               string | null;
  verb_aspect:          string | null;
  word_type:            string;
  notes:                string | null;
  image_url:            string | null;
  translation_priority: number;
  synonym_group_id:     string | null;
  popularity_score:     number | null;
};

// ─── Утилиты ─────────────────────────────────────────────────────────────────

function normalizeOptional(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = value.trim();
  return t.length ? t : null;
}

function normalizeBoolean(value: string | null): boolean {
  return value === "1" || value === "true";
}

// ─── Построение WHERE-фильтров ───────────────────────────────────────────────

function buildFilters(url: URL) {
  const where:  string[]  = ["w.is_active = TRUE"];
  const params: unknown[] = [];

  const addParam = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  // Фильтр по коллекции
  const collectionIdRaw = normalizeOptional(url.searchParams.get("collectionId"));
  const collectionId    = collectionIdRaw ? Number.parseInt(collectionIdRaw, 10) : Number.NaN;

  if (Number.isInteger(collectionId) && collectionId > 0) {
    const colRef = addParam(collectionId);
    where.push(
      `EXISTS (SELECT 1 FROM collections c WHERE c.id = ${colRef} AND c.is_active = TRUE AND c.is_public = TRUE)`
    );
    where.push(`(
      EXISTS (
        SELECT 1
        FROM collections c
        JOIN tags t ON LOWER(t.code) = ANY (
          SELECT LOWER(value) FROM unnest(c.rule_tag_codes) AS value
        )
        JOIN word_tags wt ON wt.tag_id = t.id
        WHERE c.id = ${colRef} AND wt.word_id = w.id
      )
      OR EXISTS (
        SELECT 1 FROM collection_words cw
        WHERE cw.collection_id = ${colRef}
          AND cw.word_id = w.id
          AND cw.is_excluded = FALSE
      )
    )`);
    where.push(`NOT EXISTS (
      SELECT 1 FROM collection_words cw
      WHERE cw.collection_id = ${colRef} AND cw.word_id = w.id AND cw.is_excluded = TRUE
    )`);
  }

  // Поиск по лемме / переводу
  const searchQuery = normalizeOptional(url.searchParams.get("q"));
  if (searchQuery) {
    const pattern = addParam(`%${searchQuery.toLowerCase()}%`);
    where.push(`(LOWER(w.lemma) LIKE ${pattern} OR LOWER(w.translation) LIKE ${pattern})`);
  }

  // Навигация по первой букве (лакский/русский индекс)
  const startsWith = normalizeOptional(url.searchParams.get("startsWith"));
  if (startsWith) {
    const prefix = addParam(`${startsWith.toLowerCase()}%`);
    where.push(`LOWER(w.lemma) LIKE ${prefix}`);
  }

  // Явный список id (режим «Моё»)
  const idsRaw = normalizeOptional(url.searchParams.get("ids"));
  if (idsRaw) {
    const ids = idsRaw
      .split(",")
      .map((item) => Number.parseInt(item.trim(), 10))
      .filter((item) => Number.isInteger(item) && item > 0)
      .slice(0, 500);

    if (ids.length > 0) {
      const refs = ids.map((id) => addParam(id));
      where.push(`w.id IN (${refs.join(", ")})`);
    } else {
      where.push("FALSE");
    }
  }

  // Фильтр по типу записи: word | phrase
  const wordType = normalizeOptional(url.searchParams.get("wordType"));
  if (wordType === "word" || wordType === "phrase") {
    where.push(`w.word_type = ${addParam(wordType)}`);
  }

  // Фильтр по части речи
  const pos = normalizeOptional(url.searchParams.get("partOfSpeech"));
  if (pos) {
    where.push(`w.part_of_speech = ${addParam(pos)}`);
  }

  // Фильтр по роду
  const gender = normalizeOptional(url.searchParams.get("gender"));
  if (gender === "м" || gender === "ж" || gender === "ср") {
    where.push(`w.gender = ${addParam(gender)}`);
  }

  // Только основные слова (для SRS и словаря по умолчанию)
  if (normalizeBoolean(url.searchParams.get("primaryOnly"))) {
    where.push("w.translation_priority = 1");
  }

  // Только глаголы (для фильтра упражнений)
  if (normalizeBoolean(url.searchParams.get("popularVerbs"))) {
    where.push(
      "(LOWER(COALESCE(w.part_of_speech, '')) LIKE '%verb%' OR LOWER(COALESCE(w.part_of_speech, '')) LIKE '%глаг%')"
    );
  }

  return { where, params };
}

// ─── GET /api/words ───────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const auth = await getAuthContextFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const url     = new URL(request.url);
  const filters = buildFilters(url);

  const limitRaw  = url.searchParams.get("limit");
  const limit     = limitRaw ? Number.parseInt(limitRaw, 10) : 500;
  const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 30000) : 500;

  const result = await query<WordRow>(
    `
      SELECT
        w.id,
        w.lemma,
        w.translation,
        w.transcription,
        w.part_of_speech,
        w.gender,
        w.verb_aspect,
        w.word_type,
        w.notes,
        w.image_url,
        w.translation_priority,
        w.synonym_group_id,
        w.popularity_score
      FROM words w
      WHERE ${filters.where.join(" AND ")}
      ORDER BY
        CASE WHEN w.popularity_score IS NULL THEN 1 ELSE 0 END ASC,
        w.popularity_score ASC,
        w.translation_priority ASC,
        w.id ASC
      LIMIT $${filters.params.length + 1}
    `,
    [...filters.params, safeLimit]
  );

  const words: DictionaryWord[] = result.rows.map((row) => ({
    id:                  row.id,
    lemma:               row.lemma,
    translation:         row.translation,
    transcription:       row.transcription,
    partOfSpeech:        row.part_of_speech,
    gender:              (row.gender as DictionaryWord["gender"]) ?? null,
    verbAspect:          (row.verb_aspect as DictionaryWord["verbAspect"]) ?? null,
    wordType:            (row.word_type as DictionaryWord["wordType"]) ?? "word",
    notes:               row.notes,
    imageUrl:            row.image_url,
    translationPriority: row.translation_priority,
    synonymGroupId:      row.synonym_group_id,
    popularityScore:     row.popularity_score,
  }));

  const response = NextResponse.json({ words }, { status: 200 });
  if (auth.refreshedAccessToken) {
    setAccessCookie(response, auth.refreshedAccessToken);
  }
  return response;
}