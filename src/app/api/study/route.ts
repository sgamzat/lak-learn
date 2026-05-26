import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { setAccessCookie } from "@/lib/server/session";

type StudySelectionBody = {
  type?: "word" | "collection";
  id?: number | string;
  selected?: boolean;
};

type StudyWordRow = {
  word_id: number;
};

type StudyCollectionRow = {
  collection_id: number;
};

type ExistsRow = {
  id: number;
};

function normalizeInteger(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

async function getStudySelection(userId: string) {
  const [wordsResult, collectionsResult] = await Promise.all([
    query<StudyWordRow>(
      `
        SELECT word_id
        FROM user_study_words
        WHERE user_id = $1
        ORDER BY word_id ASC
      `,
      [userId]
    ),
    query<StudyCollectionRow>(
      `
        SELECT collection_id
        FROM user_study_collections
        WHERE user_id = $1
        ORDER BY collection_id ASC
      `,
      [userId]
    )
  ]);

  return {
    wordIds: wordsResult.rows.map((row) => row.word_id),
    collectionIds: collectionsResult.rows.map((row) => row.collection_id)
  };
}

export async function GET(request: Request) {
  const auth = await getAuthContextFromRequest(request);

  if (!auth) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const selection = await getStudySelection(auth.user.id);
  const response = NextResponse.json(selection, { status: 200 });

  if (auth.refreshedAccessToken) {
    setAccessCookie(response, auth.refreshedAccessToken);
  }

  return response;
}

export async function POST(request: Request) {
  const auth = await getAuthContextFromRequest(request);

  if (!auth) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  let body: StudySelectionBody;

  try {
    body = (await request.json()) as StudySelectionBody;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const type = body.type;
  const selected = body.selected;
  const id = normalizeInteger(body.id);

  if ((type !== "word" && type !== "collection") || typeof selected !== "boolean" || id === null) {
    return NextResponse.json({ error: "Некорректные параметры" }, { status: 400 });
  }

  if (type === "word") {
    const existsResult = await query<ExistsRow>(
      `
        SELECT id
        FROM words
        WHERE id = $1
          AND is_active = TRUE
        LIMIT 1
      `,
      [id]
    );

    if (!existsResult.rowCount) {
      return NextResponse.json({ error: "Слово не найдено" }, { status: 404 });
    }

    if (selected) {
      await query(
        `
          INSERT INTO user_study_words (user_id, word_id)
          VALUES ($1, $2)
          ON CONFLICT (user_id, word_id) DO NOTHING
        `,
        [auth.user.id, id]
      );
    } else {
      await query(
        `
          DELETE FROM user_study_words
          WHERE user_id = $1
            AND word_id = $2
        `,
        [auth.user.id, id]
      );
    }
  }

  if (type === "collection") {
    const existsResult = await query<ExistsRow>(
      `
        SELECT id
        FROM collections
        WHERE id = $1
          AND is_active = TRUE
          AND is_public = TRUE
        LIMIT 1
      `,
      [id]
    );

    if (!existsResult.rowCount) {
      return NextResponse.json({ error: "Коллекция не найдена" }, { status: 404 });
    }

    if (selected) {
      await query(
        `
          INSERT INTO user_study_collections (user_id, collection_id)
          VALUES ($1, $2)
          ON CONFLICT (user_id, collection_id) DO NOTHING
        `,
        [auth.user.id, id]
      );
    } else {
      await query(
        `
          DELETE FROM user_study_collections
          WHERE user_id = $1
            AND collection_id = $2
        `,
        [auth.user.id, id]
      );
    }
  }

  const selection = await getStudySelection(auth.user.id);
  const response = NextResponse.json({ ok: true, ...selection }, { status: 200 });

  if (auth.refreshedAccessToken) {
    setAccessCookie(response, auth.refreshedAccessToken);
  }

  return response;
}
