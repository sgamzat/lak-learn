import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { setAccessCookie } from "@/lib/server/session";
import { lexemeInCollectionSql } from "@/lib/server/membership";

type PublicCollectionRow = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  cover_url: string | null;
  sort_order: number;
  rule_tag_codes: string[];
  kind: string;
  word_count: number;
  dictionary_word_count: number;
  phrase_count: number;
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
        COALESCE(c.kind, 'topic') AS kind,
        COUNT(w.id) FILTER (WHERE w.is_primary)::int AS word_count,
        -- То, что откроется в словаре: основные слова (без синонимов и фраз)
        COUNT(w.id) FILTER (WHERE w.word_type = 'word' AND w.is_primary)::int AS dictionary_word_count,
        COUNT(w.id) FILTER (WHERE w.word_type = 'phrase' AND w.is_primary)::int AS phrase_count
      FROM collections c
      LEFT JOIN words w
        ON w.is_active = TRUE
        AND ${lexemeInCollectionSql("c.id")}
      WHERE c.is_active = TRUE
        AND c.is_public = TRUE
        -- Слова уроков открываются в самих уроках, а не среди тем
        AND COALESCE(c.kind, 'topic') <> 'lesson'
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
        kind: row.kind === "alphabet" ? "alphabet" : "topic",
        wordCount: row.word_count,
        dictionaryWordCount: row.dictionary_word_count,
        phraseCount: row.phrase_count
      }))
    },
    { status: 200 }
  );

  if (auth.refreshedAccessToken) {
    setAccessCookie(response, auth.refreshedAccessToken, request);
  }

  return response;
}

