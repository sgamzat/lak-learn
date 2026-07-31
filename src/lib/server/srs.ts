import { query, withTransaction } from "@/lib/server/db";
import type { SRSRating } from "@/types/srs";

export type ExistingCardRow = {
  easiness_factor: string;
  repetition: number;
  interval_days: number;
  lapses: number;
  total_reviews: number;
};

export type NextCardState = {
  easinessFactor: number;
  repetition: number;
  intervalDays: number;
  dueAt: Date;
  lapses: number;
  totalReviews: number;
};

export type ReviewResult = {
  nextReviewAt: string;
  intervalDays: number;
  easinessFactor: number;
  repetition: number;
};

export function normalizeWordId(value: string | number | undefined): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

export function isValidSRSRating(value: unknown): value is SRSRating {
  return value === "forgot" || value === "unsure" || value === "know";
}

export function ratingToQuality(rating: SRSRating): 1 | 3 | 5 {
  if (rating === "forgot") return 1;
  if (rating === "unsure") return 3;
  return 5;
}

export function clampEasinessFactor(value: number): number {
  return Math.max(1.3, Number(value.toFixed(2)));
}

export function getNextCardState(params: {
  rating: SRSRating;
  existingCard: ExistingCardRow | null;
  now?: Date;
}): NextCardState {
  const quality = ratingToQuality(params.rating);
  const currentEf = params.existingCard ? Number.parseFloat(params.existingCard.easiness_factor) : 2.5;
  const currentRepetition = params.existingCard?.repetition ?? 0;
  const currentIntervalDays = params.existingCard?.interval_days ?? 0;
  const currentLapses = params.existingCard?.lapses ?? 0;
  const currentTotalReviews = params.existingCard?.total_reviews ?? 0;

  const efDelta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  const nextEf = clampEasinessFactor(currentEf + efDelta);

  let repetition = currentRepetition;
  let intervalDays = currentIntervalDays;
  let lapses = currentLapses;

  if (quality < 3) {
    repetition = 0;
    intervalDays = 1;
    lapses += 1;
  } else if (repetition === 0) {
    repetition = 1;
    intervalDays = 1;
  } else if (repetition === 1) {
    repetition = 2;
    intervalDays = 6;
  } else {
    repetition += 1;
    intervalDays = Math.max(1, Math.round(currentIntervalDays * nextEf));
  }

  const now = params.now ?? new Date();
  const dueAt = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

  return {
    easinessFactor: nextEf,
    repetition,
    intervalDays,
    dueAt,
    lapses,
    totalReviews: currentTotalReviews + 1
  };
}

export function getXPByRating(rating: SRSRating): number {
  if (rating === "know") return 10;
  if (rating === "unsure") return 5;
  return 2;
}

/** Календарная дата YYYY-MM-DD в UTC — для стабильного streak без TZ-сюрпризов. */
export function toUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Streak: +1 если вчера была активность, без изменений если уже сегодня,
 * иначе сброс в 1. Первый review → 1.
 */
export function computeNextStreakDays(params: {
  currentStreak: number;
  lastReviewedAt: Date | null;
  now?: Date;
}): number {
  const now = params.now ?? new Date();
  const today = toUtcDateKey(now);
  if (!params.lastReviewedAt) return 1;

  const last = toUtcDateKey(params.lastReviewedAt);
  if (last === today) return Math.max(1, params.currentStreak);

  const yesterdayDate = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - 1
  ));
  const yesterday = toUtcDateKey(yesterdayDate);
  if (last === yesterday) return Math.max(1, params.currentStreak) + 1;
  return 1;
}

/** Короткий урок: как Duo ~15 упражнений, new-cap как Anki-friendly. */
export const SRS_SESSION_LIMIT = 15;
export const SRS_NEW_PER_SESSION = 10;
/** Пул кандидатов для подсчёта remaining (не вся БД). */
export const SRS_CANDIDATE_FETCH_LIMIT = 200;

/**
 * Reviews (due_at != null) first, then new up to NEW_PER_SESSION,
 * total capped at SESSION_LIMIT.
 */
export function buildSessionQueue<T extends { due_at: string | null }>(
  candidates: T[]
): { session: T[]; remaining: number; totalAvailable: number } {
  const reviews = candidates.filter((c) => c.due_at !== null);
  const news = candidates.filter((c) => c.due_at === null);

  const sessionReviews = reviews.slice(0, SRS_SESSION_LIMIT);
  const newSlots = Math.min(
    SRS_NEW_PER_SESSION,
    SRS_SESSION_LIMIT - sessionReviews.length
  );
  const sessionNews = news.slice(0, newSlots);
  const session = [...sessionReviews, ...sessionNews];
  const totalAvailable = candidates.length;
  const remaining = Math.max(0, totalAvailable - session.length);

  return { session, remaining, totalAvailable };
}

export async function submitSRSReview(params: {
  userId: string;
  wordId: number;
  rating: SRSRating;
  now?: Date;
}): Promise<{ ok: true; result: ReviewResult } | { ok: false; error: string; status: number }> {
  const now = params.now ?? new Date();
  const existsWord = await query<{ id: number }>(
    `
      SELECT id
      FROM words
      WHERE id = $1
        AND is_active = TRUE
      LIMIT 1
    `,
    [params.wordId]
  );

  if (!existsWord.rowCount) {
    return { ok: false, error: "Слово не найдено", status: 404 };
  }

  const existingCardResult = await query<ExistingCardRow>(
    `
      SELECT easiness_factor::text, repetition, interval_days, lapses, total_reviews
      FROM user_srs_cards
      WHERE user_id = $1
        AND word_id = $2
      LIMIT 1
    `,
    [params.userId, params.wordId]
  );

  const nextCardState = getNextCardState({
    rating: params.rating,
    existingCard: existingCardResult.rows[0] ?? null,
    now,
  });

  await withTransaction(async (client) => {
    const streakState = await client.query<{
      last_reviewed_at: Date | string | null;
      streak_days: number | null;
    }>(
      `
        SELECT
          (SELECT MAX(rh.reviewed_at) FROM review_history rh WHERE rh.user_id = $1) AS last_reviewed_at,
          (SELECT up.streak_days FROM user_progress up WHERE up.user_id = $1 LIMIT 1) AS streak_days
      `,
      [params.userId]
    );

    const lastRaw = streakState.rows[0]?.last_reviewed_at ?? null;
    const lastReviewedAt =
      lastRaw == null ? null : lastRaw instanceof Date ? lastRaw : new Date(lastRaw);
    const nextStreak = computeNextStreakDays({
      currentStreak: streakState.rows[0]?.streak_days ?? 0,
      lastReviewedAt,
      now,
    });

    await client.query(
      `
        INSERT INTO user_srs_cards (
          user_id,
          word_id,
          easiness_factor,
          repetition,
          interval_days,
          due_at,
          last_reviewed_at,
          lapses,
          total_reviews,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, NOW())
        ON CONFLICT (user_id, word_id)
        DO UPDATE SET
          easiness_factor = EXCLUDED.easiness_factor,
          repetition = EXCLUDED.repetition,
          interval_days = EXCLUDED.interval_days,
          due_at = EXCLUDED.due_at,
          last_reviewed_at = NOW(),
          lapses = EXCLUDED.lapses,
          total_reviews = EXCLUDED.total_reviews,
          updated_at = NOW()
      `,
      [
        params.userId,
        params.wordId,
        nextCardState.easinessFactor,
        nextCardState.repetition,
        nextCardState.intervalDays,
        nextCardState.dueAt,
        nextCardState.lapses,
        nextCardState.totalReviews
      ]
    );

    await client.query(
      `
        INSERT INTO review_history (user_id, word_id, rating, reviewed_at, next_review_at)
        VALUES ($1, $2, $3, NOW(), $4)
      `,
      [params.userId, params.wordId, params.rating, nextCardState.dueAt]
    );

    await client.query(
      `
        INSERT INTO user_progress (user_id, xp, streak_days, learned_words, updated_at)
        VALUES ($1, $2, $3, 0, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
          xp = user_progress.xp + EXCLUDED.xp,
          streak_days = EXCLUDED.streak_days,
          updated_at = NOW()
      `,
      [params.userId, getXPByRating(params.rating), nextStreak]
    );
  });

  return {
    ok: true,
    result: {
      nextReviewAt: nextCardState.dueAt.toISOString(),
      intervalDays: nextCardState.intervalDays,
      easinessFactor: nextCardState.easinessFactor,
      repetition: nextCardState.repetition
    }
  };
}
