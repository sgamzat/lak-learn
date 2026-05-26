import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "@/lib/server/auth";
import { query, withTransaction } from "@/lib/server/db";
import { setAccessCookie } from "@/lib/server/session";
import type { SRSRating } from "@/types/srs";

type ReviewBody = {
  wordId?: string | number;
  rating?: SRSRating;
};

type ExistsWordRow = {
  id: number;
};

function normalizeWordId(value: string | number | undefined): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function getNextReviewDate(rating: SRSRating): Date {
  const now = Date.now();

  if (rating === "forgot") {
    return new Date(now + 30 * 60 * 1000);
  }

  if (rating === "unsure") {
    return new Date(now + 24 * 60 * 60 * 1000);
  }

  return new Date(now + 3 * 24 * 60 * 60 * 1000);
}

function getXPByRating(rating: SRSRating): number {
  if (rating === "know") return 10;
  if (rating === "unsure") return 5;
  return 2;
}

export async function POST(request: Request) {
  const auth = await getAuthContextFromRequest(request);

  if (!auth) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  let body: ReviewBody;

  try {
    body = (await request.json()) as ReviewBody;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const wordId = normalizeWordId(body.wordId);
  const rating = body.rating;

  if (wordId === null || (rating !== "forgot" && rating !== "unsure" && rating !== "know")) {
    return NextResponse.json({ error: "Некорректные параметры" }, { status: 400 });
  }

  const existsWord = await query<ExistsWordRow>(
    `
      SELECT id
      FROM words
      WHERE id = $1
        AND is_active = TRUE
      LIMIT 1
    `,
    [wordId]
  );

  if (!existsWord.rowCount) {
    return NextResponse.json({ error: "Слово не найдено" }, { status: 404 });
  }

  const nextReviewAt = getNextReviewDate(rating);

  await withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO review_history (user_id, word_id, rating, reviewed_at, next_review_at)
        VALUES ($1, $2, $3, NOW(), $4)
      `,
      [auth.user.id, wordId, rating, nextReviewAt]
    );

    await client.query(
      `
        INSERT INTO user_progress (user_id, xp, streak_days, learned_words, updated_at)
        VALUES ($1, $2, 0, 0, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET xp = user_progress.xp + EXCLUDED.xp, updated_at = NOW()
      `,
      [auth.user.id, getXPByRating(rating)]
    );
  });

  const response = NextResponse.json({ ok: true, nextReviewAt: nextReviewAt.toISOString() }, { status: 200 });

  if (auth.refreshedAccessToken) {
    setAccessCookie(response, auth.refreshedAccessToken);
  }

  return response;
}

