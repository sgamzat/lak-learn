import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "@/lib/server/auth";
import { withTransaction } from "@/lib/server/db";
import { setAccessCookie } from "@/lib/server/session";

type CreateWordBody = {
  lemma?: string;
  translation?: string;
  transcription?: string;
  partOfSpeech?: string;
  level?: string;
};

function normalizeOptional(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function POST(request: Request) {
  const auth = await getAuthContextFromRequest(request);

  if (!auth) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  if (auth.user.role !== "admin") {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  let body: CreateWordBody;

  try {
    body = (await request.json()) as CreateWordBody;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const lemma = normalizeOptional(body.lemma);
  const translation = normalizeOptional(body.translation);

  if (!lemma || !translation) {
    return NextResponse.json({ error: "lemma и translation обязательны" }, { status: 400 });
  }

  const created = await withTransaction(async (client) => {
    const wordResult = await client.query<{ id: number }>(
      `
        INSERT INTO words (lemma, translation, transcription, part_of_speech, level, created_by, updated_by)
        VALUES ($1, $2, $3, $4, $5, $6, $6)
        RETURNING id
      `,
      [
        lemma,
        translation,
        normalizeOptional(body.transcription),
        normalizeOptional(body.partOfSpeech),
        normalizeOptional(body.level),
        auth.user.id
      ]
    );

    const wordId = wordResult.rows[0].id;

    await client.query(
      `
        INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, payload)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [auth.user.id, "admin.word.create", "word", String(wordId), JSON.stringify({ lemma, translation })]
    );

    return wordId;
  });

  const response = NextResponse.json({ id: created, ok: true }, { status: 201 });

  if (auth.refreshedAccessToken) {
    setAccessCookie(response, auth.refreshedAccessToken);
  }

  return response;
}

