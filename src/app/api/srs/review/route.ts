import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "@/lib/server/auth";
import { setAccessCookie } from "@/lib/server/session";
import { isValidExerciseType, isValidSRSRating, normalizeTimeZone, normalizeWordId, submitSRSReview } from "@/lib/server/srs";
import type { SRSRating } from "@/types/srs";

type ReviewBody = {
  wordId?: string | number;
  rating?: SRSRating;
  /** Упражнение: вес ответа зависит от него (узнавание слабее воспроизведения) */
  exercise?: string;
  /** Ответ в упражнении на ввод засчитан с опечаткой */
  typo?: boolean;
  /** Часовой пояс браузера (Intl) — для серии дней */
  timeZone?: string;
};

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

  if (wordId === null || !isValidSRSRating(rating)) {
    return NextResponse.json({ error: "Некорректные параметры" }, { status: 400 });
  }

  const outcome = await submitSRSReview({
    userId: auth.user.id,
    wordId,
    rating,
    exercise: isValidExerciseType(body.exercise) ? body.exercise : null,
    typo: body.typo === true,
    timeZone: normalizeTimeZone(body.timeZone)
  });

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  const response = NextResponse.json(
    {
      ok: true,
      nextReviewAt: outcome.result.nextReviewAt,
      intervalDays: outcome.result.intervalDays,
      easinessFactor: outcome.result.easinessFactor,
      repetition: outcome.result.repetition
    },
    { status: 200 }
  );

  if (auth.refreshedAccessToken) {
    setAccessCookie(response, auth.refreshedAccessToken);
  }

  return response;
}
