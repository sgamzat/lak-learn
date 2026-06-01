import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { setAccessCookie } from "@/lib/server/session";
import type { FlashcardData, IntervalState } from "@/types/srs";

type QueueRow = {
  id: string;
  word: string;
  transcription: string | null;
  part_of_speech: string | null;
  translation: string;
  example_sentence: string | null;
  due_at: string | null;
  interval_state: IntervalState;
  repetition: number;
};

export async function GET(request: Request) {
  const auth = await getAuthContextFromRequest(request);

  if (!auth) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const rowsResult = await query<QueueRow>(
    `
      WITH selected_collections_words AS (
        SELECT DISTINCT w.id AS word_id
        FROM user_study_collections usc
        JOIN collections c ON c.id = usc.collection_id
        JOIN words w ON w.is_active = TRUE
        WHERE usc.user_id = $1
          AND c.is_active = TRUE
          AND c.is_public = TRUE
          AND (
            EXISTS (
              SELECT 1
              FROM tags t
              JOIN word_tags wt ON wt.tag_id = t.id
              WHERE wt.word_id = w.id
                AND LOWER(t.code) = ANY (
                  SELECT LOWER(value)
                  FROM unnest(c.rule_tag_codes) AS value
                )
            )
            OR EXISTS (
              SELECT 1
              FROM collection_words cw
              WHERE cw.collection_id = c.id
                AND cw.word_id = w.id
                AND cw.is_manual = TRUE
                AND cw.is_excluded = FALSE
            )
          )
          AND NOT EXISTS (
            SELECT 1
            FROM collection_words cw
            WHERE cw.collection_id = c.id
              AND cw.word_id = w.id
              AND cw.is_excluded = TRUE
          )
      ),
      selected_words AS (
        SELECT usw.word_id
        FROM user_study_words usw
        JOIN words w ON w.id = usw.word_id
        WHERE usw.user_id = $1
          AND w.is_active = TRUE
        UNION
        SELECT word_id
        FROM selected_collections_words
      ),
      latest_review AS (
        SELECT DISTINCT ON (rh.word_id)
          rh.word_id,
          rh.next_review_at
        FROM review_history rh
        WHERE rh.user_id = $1
        ORDER BY rh.word_id, rh.reviewed_at DESC, rh.id DESC
      ),
      card_state AS (
        SELECT usc.word_id, usc.due_at, usc.repetition
        FROM user_srs_cards usc
        WHERE usc.user_id = $1
      )
      SELECT
        w.id::text AS id,
        w.lemma AS word,
        w.transcription,
        w.part_of_speech,
        w.translation,
        ex.sentence_src AS example_sentence,
        COALESCE(cs.due_at, lr.next_review_at)::text AS due_at,
        COALESCE(cs.repetition, 0) AS repetition,
        CASE
          WHEN COALESCE(cs.due_at, lr.next_review_at) IS NULL OR COALESCE(cs.due_at, lr.next_review_at) <= NOW() THEN 'overdue'
          WHEN COALESCE(cs.due_at, lr.next_review_at) <= NOW() + INTERVAL '24 hours' THEN 'dueSoon'
          ELSE 'scheduled'
        END AS interval_state
      FROM selected_words sw
      JOIN words w ON w.id = sw.word_id
      LEFT JOIN latest_review lr ON lr.word_id = w.id
      LEFT JOIN card_state cs ON cs.word_id = w.id
      LEFT JOIN LATERAL (
        SELECT sentence_src
        FROM word_examples we
        WHERE we.word_id = w.id
        ORDER BY we.id ASC
        LIMIT 1
      ) ex ON TRUE
      ORDER BY
        CASE
          WHEN COALESCE(cs.due_at, lr.next_review_at) IS NULL OR COALESCE(cs.due_at, lr.next_review_at) <= NOW() THEN 0
          WHEN COALESCE(cs.due_at, lr.next_review_at) <= NOW() + INTERVAL '24 hours' THEN 1
          ELSE 2
        END ASC,
        COALESCE(cs.due_at, lr.next_review_at, NOW()) ASC,
        w.id ASC
      LIMIT 200
    `,
    [auth.user.id]
  );

  const payload: FlashcardData[] = rowsResult.rows.map((row: QueueRow) => ({
    id: row.id,
    word: row.word,
    transcription: row.transcription ?? "",
    partOfSpeech: row.part_of_speech ?? "—",
    translation: row.translation,
    exampleSentence: row.example_sentence ?? "",
    intervalState: row.interval_state,
    nextReviewDate: row.due_at ?? new Date().toISOString(),
    repetition: row.repetition ?? 0,
  }));

  const response = NextResponse.json(payload, { status: 200 });

  if (auth.refreshedAccessToken) {
    setAccessCookie(response, auth.refreshedAccessToken);
  }

  return response;
}