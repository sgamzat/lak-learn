// src/app/api/srs/queue/route.ts
import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { setAccessCookie } from "@/lib/server/session";
import {
  buildSessionQueue,
  SRS_CANDIDATE_FETCH_LIMIT,
  SRS_SESSION_LIMIT,
} from "@/lib/server/srs";
import type { FlashcardData, IntervalState } from "@/types/srs";

// ─── Тип строки из БД ────────────────────────────────────────────────────────

type QueueRow = {
  id: string;
  word: string;
  transcription: string | null;
  part_of_speech: string | null;
  gender: string | null;
  verb_aspect: string | null;
  word_type: string;
  notes: string | null;
  translation: string;
  synonym_group_id: string | null;
  example_sentence: string | null;
  due_at: string | null;
  interval_state: IntervalState;
  repetition: number;
};

type SynonymRow = {
  word_id: number;
  lemma: string;
  synonym_group_id: string;
};

type CollectionMetaRow = {
  id: number;
  title: string;
};

function collectionMembershipSql(colRef: string): string {
  return `
    (
      EXISTS (
        SELECT 1
        FROM tags t
        JOIN word_tags wt ON wt.tag_id = t.id
        WHERE wt.word_id = w.id
          AND LOWER(t.code) = ANY (
            SELECT LOWER(value) FROM unnest(c.rule_tag_codes) AS value
          )
      )
      OR EXISTS (
        SELECT 1 FROM collection_words cw
        WHERE cw.collection_id = c.id
          AND cw.word_id = w.id
          AND cw.is_excluded = FALSE
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM collection_words cw
      WHERE cw.collection_id = c.id
        AND cw.word_id = w.id
        AND cw.is_excluded = TRUE
    )
  `;
}

const selectCardFields = `
  w.id::text                                                        AS id,
  w.lemma                                                           AS word,
  w.transcription,
  w.part_of_speech,
  w.gender,
  w.verb_aspect,
  w.word_type,
  w.notes,
  w.translation,
  w.synonym_group_id,
  (
    SELECT we.sentence_src || COALESCE(' — ' || we.sentence_translation, '')
    FROM word_examples we
    WHERE we.word_id = w.id
    LIMIT 1
  )                                                                 AS example_sentence,
  cs.due_at,
  CASE
    WHEN cs.due_at IS NULL                    THEN 'scheduled'
    WHEN cs.due_at <= NOW()                   THEN 'overdue'
    WHEN cs.due_at <= NOW() + INTERVAL '1 day' THEN 'dueSoon'
    ELSE                                           'scheduled'
  END::text                                                         AS interval_state,
  COALESCE(cs.repetition, 0)                                        AS repetition
`;

// ─── GET /api/srs/queue ───────────────────────────────────────────────────────

export async function GET(request: Request) {
  const auth = await getAuthContextFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const url = new URL(request.url);
  const collectionIdRaw = url.searchParams.get("collectionId");
  const collectionId = collectionIdRaw ? Number.parseInt(collectionIdRaw, 10) : Number.NaN;
  const scoped = Number.isInteger(collectionId) && collectionId > 0;

  let collectionTitle: string | null = null;
  if (scoped) {
    const meta = await query<CollectionMetaRow>(
      `
        SELECT id, title
        FROM collections
        WHERE id = $1 AND is_active = TRUE AND is_public = TRUE
        LIMIT 1
      `,
      [collectionId]
    );
    if (!meta.rows[0]) {
      return NextResponse.json({ error: "Тема не найдена" }, { status: 404 });
    }
    collectionTitle = meta.rows[0].title;
  }

  // Кандидаты: overdue + dueSoon + новые. Синонимы (priority > 1) не в очереди.
  const rowsResult = scoped
    ? await query<QueueRow>(
        `
          WITH scoped_words AS (
            SELECT DISTINCT w.id AS word_id
            FROM collections c
            JOIN words w ON w.is_active = TRUE
            WHERE c.id = $2
              AND c.is_active = TRUE
              AND c.is_public = TRUE
              AND w.translation_priority = 1
              AND ${collectionMembershipSql("c")}
          ),
          card_state AS (
            SELECT usc.word_id, usc.due_at, usc.repetition
            FROM user_srs_cards usc
            WHERE usc.user_id = $1
          )
          SELECT ${selectCardFields}
          FROM scoped_words sw
          JOIN words w ON w.id = sw.word_id
          LEFT JOIN card_state cs ON cs.word_id = w.id
          WHERE (cs.due_at IS NULL OR cs.due_at <= NOW() + INTERVAL '1 day')
          ORDER BY
            CASE
              WHEN cs.due_at IS NULL    THEN 2
              WHEN cs.due_at <= NOW()   THEN 0
              ELSE                           1
            END ASC,
            cs.due_at ASC NULLS LAST,
            w.id ASC
          LIMIT $3
        `,
        [auth.user.id, collectionId, SRS_CANDIDATE_FETCH_LIMIT]
      )
    : await query<QueueRow>(
        `
          WITH selected_collections_words AS (
            SELECT DISTINCT w.id AS word_id
            FROM user_study_collections usc
            JOIN collections c ON c.id = usc.collection_id
            JOIN words w ON w.is_active = TRUE
            WHERE usc.user_id = $1
              AND c.is_active = TRUE
              AND c.is_public = TRUE
              AND w.translation_priority = 1
              AND ${collectionMembershipSql("c")}
          ),
          selected_words AS (
            SELECT usw.word_id
            FROM user_study_words usw
            JOIN words w ON w.id = usw.word_id
            WHERE usw.user_id = $1
              AND w.is_active = TRUE
              AND w.translation_priority = 1
            UNION
            SELECT word_id FROM selected_collections_words
          ),
          card_state AS (
            SELECT usc.word_id, usc.due_at, usc.repetition
            FROM user_srs_cards usc
            WHERE usc.user_id = $1
          )
          SELECT ${selectCardFields}
          FROM selected_words sw
          JOIN words w ON w.id = sw.word_id
          LEFT JOIN card_state cs ON cs.word_id = w.id
          WHERE (cs.due_at IS NULL OR cs.due_at <= NOW() + INTERVAL '1 day')
          ORDER BY
            CASE
              WHEN cs.due_at IS NULL    THEN 2
              WHEN cs.due_at <= NOW()   THEN 0
              ELSE                           1
            END ASC,
            cs.due_at ASC NULLS LAST
          LIMIT $2
        `,
        [auth.user.id, SRS_CANDIDATE_FETCH_LIMIT]
      );

  const emptyBody = {
    queue: [] as FlashcardData[],
    remaining: 0,
    totalAvailable: 0,
    sessionLimit: SRS_SESSION_LIMIT,
    ...(scoped ? { collectionId, collectionTitle } : {}),
  };

  if (rowsResult.rows.length === 0) {
    const response = NextResponse.json(emptyBody, { status: 200 });
    if (auth.refreshedAccessToken) setAccessCookie(response, auth.refreshedAccessToken);
    return response;
  }

  const { session: sessionRows, remaining, totalAvailable } = buildSessionQueue(
    rowsResult.rows
  );

  const groupIds = [
    ...new Set(
      sessionRows
        .map((r) => r.synonym_group_id)
        .filter((g): g is string => g !== null)
    ),
  ];

  const synonymMap = new Map<string, { id: number; lemma: string }[]>();

  if (groupIds.length > 0) {
    const synResult = await query<SynonymRow>(
      `SELECT id AS word_id, lemma, synonym_group_id
       FROM words
       WHERE synonym_group_id = ANY($1)
         AND translation_priority > 1
         AND is_active = TRUE
       ORDER BY translation_priority ASC`,
      [groupIds]
    );

    for (const row of synResult.rows) {
      const list = synonymMap.get(row.synonym_group_id) ?? [];
      list.push({ id: row.word_id, lemma: row.lemma });
      synonymMap.set(row.synonym_group_id, list);
    }
  }

  const queue: FlashcardData[] = sessionRows.map((row) => ({
    id: row.id,
    word: row.word,
    transcription: row.transcription ?? "",
    partOfSpeech: row.part_of_speech ?? "",
    gender: (row.gender as FlashcardData["gender"]) ?? null,
    verbAspect: (row.verb_aspect as FlashcardData["verbAspect"]) ?? null,
    wordType: (row.word_type as FlashcardData["wordType"]) ?? "word",
    notes: row.notes ?? null,
    translation: row.translation,
    exampleSentence: row.example_sentence ?? "",
    synonyms: row.synonym_group_id
      ? (synonymMap.get(row.synonym_group_id) ?? [])
      : [],
    intervalState: row.interval_state as IntervalState,
    nextReviewDate: row.due_at ?? new Date().toISOString(),
    repetition: row.repetition,
  }));

  const body = {
    queue,
    remaining,
    totalAvailable,
    sessionLimit: SRS_SESSION_LIMIT,
    ...(scoped ? { collectionId, collectionTitle } : {}),
  };

  const response = NextResponse.json(body, { status: 200 });
  if (auth.refreshedAccessToken) setAccessCookie(response, auth.refreshedAccessToken);
  return response;
}
