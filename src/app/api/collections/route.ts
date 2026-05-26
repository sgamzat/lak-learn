import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { setAccessCookie } from "@/lib/server/session";

type PublicCollectionRow = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  cover_url: string | null;
  sort_order: number;
  rule_tag_codes: string[];
  word_count: number;
};

export async function GET(request: Request) {
  const auth = await getAuthContextFromRequest(request);

  if (!auth) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const rowsResult = await query<PublicCollectionRow>(
    `
      SELECT
        c.id,
        c.slug,
        c.title,
        c.description,
        c.level,
        c.cover_url,
        c.sort_order,
        c.rule_tag_codes,
        COUNT(w.id)::int AS word_count
      FROM collections c
      LEFT JOIN words w
        ON w.is_active = TRUE
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
      WHERE c.is_active = TRUE
        AND c.is_public = TRUE
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.id ASC
    `
  );

  const response = NextResponse.json(
    {
      collections: rowsResult.rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        level: row.level,
        coverUrl: row.cover_url,
        sortOrder: row.sort_order,
        ruleTagCodes: row.rule_tag_codes ?? [],
        wordCount: row.word_count
      }))
    },
    { status: 200 }
  );

  if (auth.refreshedAccessToken) {
    setAccessCookie(response, auth.refreshedAccessToken);
  }

  return response;
}

