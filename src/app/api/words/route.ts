import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { setAccessCookie } from "@/lib/server/session";

type WordRow = {
  id: number;
  lemma: string;
  translation: string;
  transcription: string | null;
  part_of_speech: string | null;
  level: string | null;
  popularity_score: number | null;
};

type DictionaryWord = {
  id: number;
  lemma: string;
  translation: string;
  transcription: string | null;
  partOfSpeech: string | null;
  level: string | null;
  popularityScore: number | null;
};

type QueryParts = {
  where: string[];
  params: unknown[];
};

function normalizeOptional(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeBoolean(value: string | null): boolean {
  return value === "1" || value === "true" || value === "yes";
}

function buildFilters(url: URL): QueryParts {
  const where: string[] = ["w.is_active = TRUE"];
  const params: unknown[] = [];

  const addParam = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  const partOfSpeech = normalizeOptional(url.searchParams.get("partOfSpeech"));
  if (partOfSpeech) {
    const ref = addParam(`%${partOfSpeech.toLowerCase()}%`);
    where.push(`LOWER(COALESCE(w.part_of_speech, '')) LIKE ${ref}`);
  }

  const level = normalizeOptional(url.searchParams.get("level"));
  if (level) {
    const ref = addParam(level.toUpperCase());
    where.push(`UPPER(COALESCE(w.level, '')) = ${ref}`);
  }

  const tag = normalizeOptional(url.searchParams.get("tag"));
  if (tag) {
    const ref = addParam(tag.toLowerCase());
    where.push(
      `EXISTS (SELECT 1 FROM word_tags wt JOIN tags t ON t.id = wt.tag_id WHERE wt.word_id = w.id AND LOWER(t.code) = ${ref})`
    );
  }

  const collectionIdRaw = normalizeOptional(url.searchParams.get("collectionId"));
  const collectionId = collectionIdRaw ? Number.parseInt(collectionIdRaw, 10) : Number.NaN;

  if (Number.isInteger(collectionId) && collectionId > 0) {
    const collectionRef = addParam(collectionId);

    where.push(
      `EXISTS (SELECT 1 FROM collections c WHERE c.id = ${collectionRef} AND c.is_active = TRUE AND c.is_public = TRUE)`
    );

    where.push(`(
      (
        EXISTS (
          SELECT 1
          FROM collections c
          JOIN tags t ON LOWER(t.code) = ANY (
            SELECT LOWER(value)
            FROM unnest(c.rule_tag_codes) AS value
          )
          JOIN word_tags wt ON wt.tag_id = t.id
          WHERE c.id = ${collectionRef}
            AND wt.word_id = w.id
        )
      )
      OR (
        EXISTS (
          SELECT 1
          FROM collection_words cw
          WHERE cw.collection_id = ${collectionRef}
            AND cw.word_id = w.id
            AND cw.is_manual = TRUE
            AND cw.is_excluded = FALSE
        )
      )
    )`);

    where.push(`NOT EXISTS (
      SELECT 1
      FROM collection_words cw
      WHERE cw.collection_id = ${collectionRef}
        AND cw.word_id = w.id
        AND cw.is_excluded = TRUE
    )`);
  }

  if (normalizeBoolean(url.searchParams.get("popularVerbs"))) {
    where.push("(LOWER(COALESCE(w.part_of_speech, '')) LIKE '%verb%' OR LOWER(COALESCE(w.part_of_speech, '')) LIKE '%глаг%')");
  }

  return { where, params };
}

export async function GET(request: Request) {
  const auth = await getAuthContextFromRequest(request);

  if (!auth) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const url = new URL(request.url);
  const filters = buildFilters(url);
  const limitRaw = normalizeOptional(url.searchParams.get("limit"));
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 500;
  const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 1000) : 500;

  const wordsResult = await query<WordRow>(
    `
      SELECT id, lemma, translation, transcription, part_of_speech, level, popularity_score
      FROM words w
      WHERE ${filters.where.join(" AND ")}
      ORDER BY
        CASE WHEN popularity_score IS NULL THEN 1 ELSE 0 END ASC,
        popularity_score ASC,
        id ASC
      LIMIT $${filters.params.length + 1}
    `,
    [...filters.params, safeLimit]
  );

  const payload: { words: DictionaryWord[] } = {
    words: wordsResult.rows.map((row) => ({
      id: row.id,
      lemma: row.lemma,
      translation: row.translation,
      transcription: row.transcription,
      partOfSpeech: row.part_of_speech,
      level: row.level,
      popularityScore: row.popularity_score
    }))
  };

  const response = NextResponse.json(payload, { status: 200 });

  if (auth.refreshedAccessToken) {
    setAccessCookie(response, auth.refreshedAccessToken);
  }

  return response;
}
