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

/**
 * Повторный ответ на ту же карточку в течение этого окна считается дублем
 * (двойной клик, повтор запроса при плохой сети) и не применяется второй раз.
 * Внутри одной сессии карточка не показывается снова быстрее, чем за пару секунд.
 */
export const SRS_DUPLICATE_WINDOW_MS = 3_000;

// Пространство имён для pg_advisory_xact_lock(int, int): «SRS-ответы пользователя»
const SRS_LOCK_NAMESPACE = 7301;

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

  const result = await withTransaction(async (client): Promise<ReviewResult> => {
    // Сериализуем ответы одного пользователя. Раньше карточка читалась ВНЕ
    // транзакции: два одновременных запроса (двойной клик) читали одно и то же
    // состояние и оба записывали результат; streak и XP тоже считались дважды.
    // FOR UPDATE не помогает для новой карточки (строки ещё нет), поэтому
    // advisory-lock на пользователя; снимается автоматически по COMMIT/ROLLBACK.
    await client.query("SELECT pg_advisory_xact_lock($1, hashtext($2))", [
      SRS_LOCK_NAMESPACE,
      params.userId
    ]);

    const existingCardResult = await client.query<
      ExistingCardRow & { last_reviewed_at: Date | string | null; due_at: Date | string | null }
    >(
      `
        SELECT easiness_factor::text, repetition, interval_days, lapses, total_reviews,
               last_reviewed_at, due_at
        FROM user_srs_cards
        WHERE user_id = $1
          AND word_id = $2
        LIMIT 1
      `,
      [params.userId, params.wordId]
    );

    const existingCard = existingCardResult.rows[0] ?? null;

    // Дубль ответа: возвращаем текущее состояние, ничего не меняя
    if (existingCard?.last_reviewed_at && existingCard.due_at) {
      const lastReviewedMs = new Date(existingCard.last_reviewed_at).getTime();
      if (now.getTime() - lastReviewedMs < SRS_DUPLICATE_WINDOW_MS) {
        return {
          nextReviewAt: new Date(existingCard.due_at).toISOString(),
          intervalDays: existingCard.interval_days,
          easinessFactor: Number(existingCard.easiness_factor),
          repetition: existingCard.repetition
        };
      }
    }

    const nextCardState = getNextCardState({
      rating: params.rating,
      existingCard,
      now,
    });

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

    // Время ответа берём из now (а не NOW() базы): по нему же проверяется дубль
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
        VALUES ($1, $2, $3, $4, $5, $6, $9, $7, $8, NOW())
        ON CONFLICT (user_id, word_id)
        DO UPDATE SET
          easiness_factor = EXCLUDED.easiness_factor,
          repetition = EXCLUDED.repetition,
          interval_days = EXCLUDED.interval_days,
          due_at = EXCLUDED.due_at,
          last_reviewed_at = EXCLUDED.last_reviewed_at,
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
        nextCardState.totalReviews,
        now
      ]
    );

    await client.query(
      `
        INSERT INTO review_history (user_id, word_id, rating, reviewed_at, next_review_at)
        VALUES ($1, $2, $3, $5, $4)
      `,
      [params.userId, params.wordId, params.rating, nextCardState.dueAt, now]
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

    return {
      nextReviewAt: nextCardState.dueAt.toISOString(),
      intervalDays: nextCardState.intervalDays,
      easinessFactor: nextCardState.easinessFactor,
      repetition: nextCardState.repetition
    };
  });

  return { ok: true, result };
}
