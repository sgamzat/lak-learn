import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { setAccessCookie } from "@/lib/server/session";
import type { DashboardData } from "@/types/dashboard";

type ProgressRow = {
  xp: number;
  streak_days: number;
  learned_words: number;
};

type LessonsRow = {
  lessons_completed: number;
};

type AccuracyRow = {
  total_reviews: number;
  success_reviews: number;
};

type SrsSummaryRow = {
  overdue: number;
  due_soon: number;
  next_review_at: string | null;
};

type LeaderboardRow = {
  id: string;
  email: string;
  xp: number;
  streak_days: number;
};

function deriveDisplayName(email: string): string {
  const [localPart] = email.split("@");
  const normalized = localPart?.trim();
  return normalized && normalized.length > 0 ? normalized : email;
}

function calculateLevel(learnedWords: number): string {
  if (learnedWords > 300) {
    return "B1";
  }

  if (learnedWords > 100) {
    return "A2";
  }

  return "A1";
}

export async function GET(request: Request) {
  const auth = await getAuthContextFromRequest(request);

  if (!auth) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const [progressResult, lessonsResult, accuracyResult, srsSummaryResult, leaderboardResult] = await Promise.all([
    query<ProgressRow>(
      `
        SELECT xp, streak_days, learned_words
        FROM user_progress
        WHERE user_id = $1
        LIMIT 1
      `,
      [auth.user.id]
    ),
    query<LessonsRow>(
      `
        SELECT COUNT(*)::int AS lessons_completed
        FROM review_history
        WHERE user_id = $1
      `,
      [auth.user.id]
    ),
    query<AccuracyRow>(
      `
        SELECT
          COUNT(*)::int AS total_reviews,
          COUNT(*) FILTER (WHERE rating IN ('good', 'easy'))::int AS success_reviews
        FROM review_history
        WHERE user_id = $1
      `,
      [auth.user.id]
    ),
    query<SrsSummaryRow>(
      `
        SELECT
          COUNT(*) FILTER (WHERE next_review_at IS NOT NULL AND next_review_at <= NOW())::int AS overdue,
          COUNT(*) FILTER (
            WHERE next_review_at IS NOT NULL
              AND next_review_at > NOW()
              AND next_review_at <= NOW() + INTERVAL '24 hours'
          )::int AS due_soon,
          MIN(next_review_at) FILTER (WHERE next_review_at > NOW()) AS next_review_at
        FROM review_history
        WHERE user_id = $1
      `,
      [auth.user.id]
    ),
    query<LeaderboardRow>(
      `
        SELECT
          u.id,
          u.email,
          COALESCE(up.xp, 0)::int AS xp,
          COALESCE(up.streak_days, 0)::int AS streak_days
        FROM users u
        LEFT JOIN user_progress up ON up.user_id = u.id
        WHERE u.is_blocked = FALSE
        ORDER BY COALESCE(up.xp, 0) DESC, COALESCE(up.streak_days, 0) DESC, u.created_at ASC
      `
    )
  ]);

  const progress = progressResult.rows[0] ?? { xp: 0, streak_days: 0, learned_words: 0 };
  const lessonsCompleted = lessonsResult.rows[0]?.lessons_completed ?? 0;
  const totalReviews = accuracyResult.rows[0]?.total_reviews ?? 0;
  const successReviews = accuracyResult.rows[0]?.success_reviews ?? 0;
  const accuracy = totalReviews > 0 ? Math.round((successReviews / totalReviews) * 100) : 0;
  const srsSummary = srsSummaryResult.rows[0] ?? { overdue: 0, due_soon: 0, next_review_at: null };

  const payload: DashboardData = {
    profile: {
      name: deriveDisplayName(auth.user.email),
      streak: progress.streak_days,
      xp: progress.xp,
      role: auth.user.role
    },
    progress: {
      lessonsCompleted,
      accuracy,
      currentLevel: calculateLevel(progress.learned_words)
    },
    srsSummary: {
      overdue: srsSummary.overdue,
      dueSoon: srsSummary.due_soon,
      nextReviewTime: srsSummary.next_review_at
    },
    leaderboard: leaderboardResult.rows.map((row) => ({
      id: row.id,
      name: deriveDisplayName(row.email),
      xp: row.xp,
      streak: row.streak_days
    }))
  };

  const response = NextResponse.json(payload, { status: 200 });

  if (auth.refreshedAccessToken) {
    setAccessCookie(response, auth.refreshedAccessToken);
  }

  return response;
}

