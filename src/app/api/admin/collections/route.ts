import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "@/lib/server/auth";
import { query, withTransaction } from "@/lib/server/db";
import { setAccessCookie } from "@/lib/server/session";

type CreateCollectionBody = {
  slug?: string;
  title?: string;
  description?: string;
  level?: string;
  coverUrl?: string;
  isPublic?: boolean;
  sortOrder?: number;
  ruleTagCodes?: string[];
};

type CollectionRow = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  cover_url: string | null;
  is_public: boolean;
  sort_order: number;
  rule_tag_codes: string[];
  is_active: boolean;
  word_count: number;
};

function normalizeOptional(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeTagCodes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
        .filter((item) => item.length > 0)
    )
  );
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

  const rowsResult = await query<CollectionRow>(
    `
      SELECT
        c.id,
        c.slug,
        c.title,
        c.description,
        c.level,
        c.cover_url,
        c.is_public,
        c.sort_order,
        c.rule_tag_codes,
        c.is_active,
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
        isPublic: row.is_public,
        sortOrder: row.sort_order,
        ruleTagCodes: row.rule_tag_codes ?? [],
        isActive: row.is_active,
        wordCount: row.word_count
      }))
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

  let body: CreateCollectionBody;

  try {
    body = (await request.json()) as CreateCollectionBody;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const slug = normalizeOptional(body.slug)?.toLowerCase();
  const title = normalizeOptional(body.title);

  if (!slug || !title) {
    return NextResponse.json({ error: "slug и title обязательны" }, { status: 400 });
  }

  const created = await withTransaction(async (client) => {
    const insertResult = await client.query<{ id: number }>(
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
        slug,
        title,
        normalizeOptional(body.description),
        normalizeOptional(body.level)?.toUpperCase() ?? null,
        normalizeOptional(body.coverUrl),
        Boolean(body.isPublic),
        Number.isInteger(body.sortOrder) ? Number(body.sortOrder) : 0,
        normalizeTagCodes(body.ruleTagCodes),
        guard.auth.user.id
      ]
    );

    const collectionId = insertResult.rows[0].id;

    await client.query(
      `
        INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, payload)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        guard.auth.user.id,
        "admin.collection.create",
        "collection",
        String(collectionId),
        JSON.stringify({ slug, title })
      ]
    );

    return collectionId;
  });

  const response = NextResponse.json({ ok: true, id: created }, { status: 201 });

  if (guard.auth.refreshedAccessToken) {
    setAccessCookie(response, guard.auth.refreshedAccessToken);
  }

  return response;
}

