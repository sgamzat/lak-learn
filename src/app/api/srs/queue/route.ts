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
import { lexemeInCollectionSql } from "@/lib/server/membership";

// ─── Тип строки из БД ────────────────────────────────────────────────────────

type QueueRow = {
  id: string;
  word: string;
  transcription: string | null;
  part_of_speech: string | null;
  gender: string | null;
  lak_class: number | null;
  lak_plural: string | null;
  verb_aspect: string | null;
  word_type: string;
  notes: string | null;
  translation: string;
  synonym_group_id: string | null;
  lexeme_id: string | null;
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

const selectCardFields = `
  w.id::text                                                        AS id,
  w.lemma                                                           AS word,
  w.transcription,
  w.part_of_speech,
  w.gender,
  w.lak_class,
  w.lak_plural,
  w.verb_aspect,
  w.word_type,
  w.notes,
  w.translation,
  w.synonym_group_id,
  w.lexeme_id::text                                                 AS lexeme_id,
  (
    SELECT we.sentence_src || COALESCE(' — ' || we.sentence_translation, '')
    FROM word_examples we
    WHERE we.word_id = w.id
    -- Сначала примеры, добавленные вручную; из автоматических — каждый раз другой,
    -- чтобы слово встречалось в разных контекстах
    ORDER BY we.is_auto ASC, random()
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
              AND w.is_primary
              AND ${lexemeInCollectionSql("c.id")}
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
            -- Новые карточки — по учебному плану (study_rank, миграция 013), а не по алфавиту
            w.study_rank ASC NULLS LAST,
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
              AND w.is_primary
              AND ${lexemeInCollectionSql("c.id")}
          ),
          selected_words AS (
            SELECT usw.word_id
            FROM user_study_words usw
            JOIN words w ON w.id = usw.word_id
            WHERE usw.user_id = $1
              AND w.is_active = TRUE
              AND w.is_primary
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
            cs.due_at ASC NULLS LAST,
            w.study_rank ASC NULLS LAST,
            w.id ASC
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
    if (auth.refreshedAccessToken) setAccessCookie(response, auth.refreshedAccessToken, request);
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

  // Другие значения и источник — только для карточек сессии (15), а не для всех
  // 200 кандидатов: иначе запрос очереди занимал ~2 с
  const extrasById = new Map<string, { other_meanings: string[] | null; source: string | null; spellings: string[] | null }>();
  if (sessionRows.length > 0) {
    const extrasResult = await query<{ id: string; other_meanings: string[] | null; source: string | null; spellings: string[] | null }>(
      `
        SELECT
          w.id::text AS id,
          -- Другие значения того же лакского слова: «ласун — брать; также: получать»
          (
            SELECT array_agg(x.translation ORDER BY x.rank)
            FROM (
              -- Сначала значения из разговорника, затем основные и короткие
              SELECT o.translation,
                     ROW_NUMBER() OVER (ORDER BY
                       EXISTS (
                         SELECT 1 FROM word_sources ows JOIN sources os ON os.id = ows.source_id
                         WHERE ows.word_id = o.id AND os.kind = 'phrasebook'
                       ) DESC,
                       o.translation_priority,
                       char_length(o.translation),
                       o.translation
                     ) AS rank
              FROM (
                SELECT DISTINCT ON (lower(o2.translation)) o2.*
                FROM words o2
                WHERE o2.lexeme_id = w.lexeme_id
                  AND o2.id <> w.id
                  AND o2.is_active
                  AND NOT o2.is_loanword
                  AND lower(o2.translation) <> lower(w.translation)
                ORDER BY lower(o2.translation), o2.translation_priority
              ) o
              ORDER BY rank
              LIMIT 4
            ) x
          ) AS other_meanings,
          -- Откуда слово: «Дигиев, гл. 95 · ЦВЕТА» (разговорник — первым)
          (
            SELECT s.author || ', ' || CASE WHEN s.kind = 'phrasebook' THEN 'разговорник' ELSE 'словарь ' || s.year END
                   || COALESCE(NULLIF(' · ' || ws.locator, ' · '), '')
            FROM word_sources ws
            JOIN sources s ON s.id = ws.source_id
            WHERE ws.word_id = w.id AND s.kind <> 'manual'
            ORDER BY (s.kind = 'phrasebook') DESC, ws.locator
            LIMIT 1
          ) AS source,
          -- Другие написания того же слова: «цӀву» для «цӀу — соль» (lexeme_variants)
          (
            SELECT array_agg(DISTINCT o.lemma)
            FROM words o
            WHERE o.lexeme_id = w.lexeme_id AND o.is_active AND o.word_type = w.word_type
              AND lak_search_key(o.lemma) <> lak_search_key(w.lemma)
          ) AS spellings
        FROM words w
        WHERE w.id = ANY($1::bigint[])
      `,
      [sessionRows.map((row) => row.id)]
    );
    for (const row of extrasResult.rows) extrasById.set(row.id, row);
  }

  const queue: FlashcardData[] = sessionRows.map((row) => ({
    id: row.id,
    word: row.word,
    transcription: row.transcription ?? "",
    partOfSpeech: row.part_of_speech ?? "",
    gender: (row.gender as FlashcardData["gender"]) ?? null,
    lakClass: row.lak_class ?? null,
    lakPlural: row.lak_plural ?? null,
    verbAspect: (row.verb_aspect as FlashcardData["verbAspect"]) ?? null,
    wordType: (row.word_type as FlashcardData["wordType"]) ?? "word",
    notes: row.notes ?? null,
    translation: row.translation,
    exampleSentence: row.example_sentence ?? "",
    otherMeanings: extrasById.get(row.id)?.other_meanings ?? [],
    source: extrasById.get(row.id)?.source ?? null,
    spellings: extrasById.get(row.id)?.spellings ?? [],
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
  if (auth.refreshedAccessToken) setAccessCookie(response, auth.refreshedAccessToken, request);
  return response;
}
