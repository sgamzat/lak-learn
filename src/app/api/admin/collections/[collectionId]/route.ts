import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "@/lib/server/auth";
import { withTransaction } from "@/lib/server/db";
import { setAccessCookie } from "@/lib/server/session";

type UpdateCollectionBody = {
  slug?: string;
  title?: string;
  description?: string;
  level?: string;
  coverUrl?: string;
  isPublic?: boolean;
  sortOrder?: number;
  ruleTagCodes?: string[];
  manualIncludeWordIds?: number[];
  manualExcludeWordIds?: number[];
};

type CollectionWordRow = {
  id: number;
  lemma: string;
  translation: string;
  transcription: string | null;
  part_of_speech: string | null;
  level: string | null;
  popularity_score: number | null;
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

function normalizeWordIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "number" ? item : Number.NaN))
        .filter((item) => Number.isInteger(item) && item > 0)
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

export async function GET(request: Request, { params }: { params: { collectionId: string } }) {
  const guard = await requireAdmin(request);

  if (!guard.auth || guard.response) {
    return guard.response;
  }

  const collectionId = Number.parseInt(params.collectionId, 10);

  if (!Number.isInteger(collectionId) || collectionId <= 0) {
    return NextResponse.json({ error: "Некорректный collectionId" }, { status: 400 });
  }

  const url = new URL(request.url);
  const searchQuery = normalizeOptional(url.searchParams.get("q"))?.toLowerCase() ?? null;
  const limitRaw = normalizeOptional(url.searchParams.get("limit"));
  const parsedLimit = limitRaw ? Number.parseInt(limitRaw, 10) : 100;
  const safeLimit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 200) : 100;

  const wordsResult = await withTransaction(async (client) => {
    const existsResult = await client.query<{ id: number }>(
      `
        SELECT id
        FROM collections
        WHERE id = $1
          AND is_active = TRUE
        LIMIT 1
      `,
      [collectionId]
    );

    if (!existsResult.rowCount) {
      return null;
    }

    const paramsList: unknown[] = [collectionId];
    const addParam = (value: unknown) => {
      paramsList.push(value);
      return `$${paramsList.length}`;
    };

    const whereParts = [
      "w.is_active = TRUE",
      `(
        (
          EXISTS (
            SELECT 1
            FROM collections c
            JOIN tags t ON LOWER(t.code) = ANY (
              SELECT LOWER(value)
              FROM unnest(c.rule_tag_codes) AS value
            )
            JOIN word_tags wt ON wt.tag_id = t.id
            WHERE c.id = $1
              AND wt.word_id = w.id
          )
        )
        OR (
          EXISTS (
            SELECT 1
            FROM collection_words cw
            WHERE cw.collection_id = $1
              AND cw.word_id = w.id
              AND cw.is_manual = TRUE
              AND cw.is_excluded = FALSE
          )
        )
      )`,
      `NOT EXISTS (
        SELECT 1
        FROM collection_words cw
        WHERE cw.collection_id = $1
          AND cw.word_id = w.id
          AND cw.is_excluded = TRUE
      )`
    ];

    let startsWithRef = "$1";

    if (searchQuery) {
      const containsRef = addParam(`%${searchQuery}%`);
      startsWithRef = addParam(`${searchQuery}%`);
      whereParts.push(`(LOWER(w.lemma) LIKE ${containsRef} OR LOWER(w.translation) LIKE ${containsRef})`);
    }

    const limitRef = addParam(safeLimit);

    return client.query<CollectionWordRow>(
      `
        SELECT id, lemma, translation, transcription, part_of_speech, level, popularity_score
        FROM words w
        WHERE ${whereParts.join(" AND ")}
        ORDER BY
          CASE WHEN LOWER(w.lemma) LIKE ${startsWithRef} THEN 0 ELSE 1 END ASC,
          CASE WHEN LOWER(w.translation) LIKE ${startsWithRef} THEN 0 ELSE 1 END ASC,
          CASE WHEN popularity_score IS NULL THEN 1 ELSE 0 END ASC,
          popularity_score ASC,
          id ASC
        LIMIT ${limitRef}
      `,
      paramsList
    );
  });

  if (!wordsResult) {
    return NextResponse.json({ error: "Набор не найден" }, { status: 404 });
  }

  const response = NextResponse.json(
    {
      words: wordsResult.rows.map((row) => ({
        id: row.id,
        lemma: row.lemma,
        translation: row.translation,
        transcription: row.transcription,
        partOfSpeech: row.part_of_speech,
        level: row.level,
        popularityScore: row.popularity_score
      }))
    },
    { status: 200 }
  );

  if (guard.auth.refreshedAccessToken) {
    setAccessCookie(response, guard.auth.refreshedAccessToken);
  }

  return response;
}

export async function PATCH(request: Request, { params }: { params: { collectionId: string } }) {
  const guard = await requireAdmin(request);

  if (!guard.auth || guard.response) {
    return guard.response;
  }

  const collectionId = Number.parseInt(params.collectionId, 10);

  if (!Number.isInteger(collectionId) || collectionId <= 0) {
    return NextResponse.json({ error: "Некорректный collectionId" }, { status: 400 });
  }

  let body: UpdateCollectionBody;

  try {
    body = (await request.json()) as UpdateCollectionBody;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const updated = await withTransaction(async (client) => {
    const existsResult = await client.query<{ id: number }>(
      `
        SELECT id
        FROM collections
        WHERE id = $1
          AND is_active = TRUE
        LIMIT 1
      `,
      [collectionId]
    );

    if (!existsResult.rowCount) {
      return null;
    }

    const slug = normalizeOptional(body.slug)?.toLowerCase();
    const title = normalizeOptional(body.title);
    const description = body.description === undefined ? undefined : normalizeOptional(body.description);
    const level = body.level === undefined ? undefined : normalizeOptional(body.level)?.toUpperCase() ?? null;
    const coverUrl = body.coverUrl === undefined ? undefined : normalizeOptional(body.coverUrl);
    const sortOrder = body.sortOrder;
    const ruleTagCodes = body.ruleTagCodes === undefined ? undefined : normalizeTagCodes(body.ruleTagCodes);

    await client.query(
      `
        UPDATE collections
        SET
          slug = COALESCE($2, slug),
          title = COALESCE($3, title),
          description = COALESCE($4, description),
          level = COALESCE($5, level),
          cover_url = COALESCE($6, cover_url),
          is_public = COALESCE($7, is_public),
          sort_order = COALESCE($8, sort_order),
          rule_tag_codes = COALESCE($9::text[], rule_tag_codes),
          updated_by = $10,
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        collectionId,
        slug,
        title,
        description,
        level,
        coverUrl,
        typeof body.isPublic === "boolean" ? body.isPublic : null,
        Number.isInteger(sortOrder) ? Number(sortOrder) : null,
        ruleTagCodes ?? null,
        guard.auth.user.id
      ]
    );

    const manualIncludeWordIds = normalizeWordIds(body.manualIncludeWordIds);
    for (const wordId of manualIncludeWordIds) {
      await client.query(
        `
          INSERT INTO collection_words (collection_id, word_id, is_manual, is_excluded, updated_at)
          VALUES ($1, $2, TRUE, FALSE, NOW())
          ON CONFLICT (collection_id, word_id)
          DO UPDATE SET is_manual = TRUE, is_excluded = FALSE, updated_at = NOW()
        `,
        [collectionId, wordId]
      );
    }

    const manualExcludeWordIds = normalizeWordIds(body.manualExcludeWordIds);
    for (const wordId of manualExcludeWordIds) {
      await client.query(
        `
          INSERT INTO collection_words (collection_id, word_id, is_manual, is_excluded, updated_at)
          VALUES ($1, $2, FALSE, TRUE, NOW())
          ON CONFLICT (collection_id, word_id)
          DO UPDATE SET is_excluded = TRUE, updated_at = NOW()
        `,
        [collectionId, wordId]
      );
    }

    await client.query(
      `
        INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, payload)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        guard.auth.user.id,
        "admin.collection.update",
        "collection",
        String(collectionId),
        JSON.stringify({
          slug,
          title,
          manualIncludeWordIds,
          manualExcludeWordIds,
          changedRuleTagCodes: ruleTagCodes ?? null
        })
      ]
    );

    return { id: collectionId };
  });

  if (!updated) {
    return NextResponse.json({ error: "Набор не найден" }, { status: 404 });
  }

  const response = NextResponse.json({ ok: true, collection: updated }, { status: 200 });

  if (guard.auth.refreshedAccessToken) {
    setAccessCookie(response, guard.auth.refreshedAccessToken);
  }

  return response;
}

export async function DELETE(request: Request, { params }: { params: { collectionId: string } }) {
  const guard = await requireAdmin(request);

  if (!guard.auth || guard.response) {
    return guard.response;
  }

  const collectionId = Number.parseInt(params.collectionId, 10);

  if (!Number.isInteger(collectionId) || collectionId <= 0) {
    return NextResponse.json({ error: "Некорректный collectionId" }, { status: 400 });
  }

  const deleted = await withTransaction(async (client) => {
    const result = await client.query<{ id: number }>(
      `
        UPDATE collections
        SET is_active = FALSE, updated_by = $2, updated_at = NOW()
        WHERE id = $1
          AND is_active = TRUE
        RETURNING id
      `,
      [collectionId, guard.auth.user.id]
    );

    if (!result.rowCount) {
      return null;
    }

    await client.query(
      `
        INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, payload)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [guard.auth.user.id, "admin.collection.delete", "collection", String(collectionId), JSON.stringify({ softDelete: true })]
    );

    return { id: collectionId };
  });

  if (!deleted) {
    return NextResponse.json({ error: "Набор не найден" }, { status: 404 });
  }

  const response = NextResponse.json({ ok: true, collection: deleted }, { status: 200 });

  if (guard.auth.refreshedAccessToken) {
    setAccessCookie(response, guard.auth.refreshedAccessToken);
  }

  return response;
}
