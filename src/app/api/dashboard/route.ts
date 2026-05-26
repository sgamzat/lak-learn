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
  rank: number;
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

export async function GET(request: Request) {
  const auth = await getAuthContextFromRequest(request);

  if (!auth) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const [progressResult, lessonsResult, accuracyResult, srsSummaryResult, leaderboardTopResult, myLeaderboardRowResult] =
    await Promise.all([
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
          COUNT(*) FILTER (WHERE rating IN ('know', 'unsure'))::int AS success_reviews
        FROM review_history
        WHERE user_id = $1
      `,
      [auth.user.id]
    ),
    query<SrsSummaryRow>(
      `
        WITH selected_collections_words AS (
          SELECT DISTINCT w.id AS word_id
          FROM user_study_collections usc
          JOIN collections c ON c.id = usc.collection_id
          JOIN words w ON w.is_active = TRUE
          WHERE usc.user_id = $1
            AND c.is_active = TRUE
            AND c.is_public = TRUE
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
        ),
        selected_words AS (
          SELECT usw.word_id
          FROM user_study_words usw
          JOIN words w ON w.id = usw.word_id
          WHERE usw.user_id = $1
            AND w.is_active = TRUE
          UNION
          SELECT word_id
          FROM selected_collections_words
        ),
        latest_review AS (
          SELECT DISTINCT ON (rh.word_id)
            rh.word_id,
            rh.next_review_at
          FROM review_history rh
          WHERE rh.user_id = $1
          ORDER BY rh.word_id, rh.reviewed_at DESC, rh.id DESC
        )
        SELECT
          COUNT(*) FILTER (WHERE lr.next_review_at IS NULL OR lr.next_review_at <= NOW())::int AS overdue,
          COUNT(*) FILTER (
            WHERE lr.next_review_at IS NOT NULL
              AND lr.next_review_at > NOW()
              AND lr.next_review_at <= NOW() + INTERVAL '24 hours'
          )::int AS due_soon,
          MIN(lr.next_review_at) FILTER (WHERE lr.next_review_at > NOW()) AS next_review_at
        FROM selected_words sw
        LEFT JOIN latest_review lr ON lr.word_id = sw.word_id
      `,
      [auth.user.id]
    ),
    query<LeaderboardRow>(
      `
        WITH ranked AS (
          SELECT
            ROW_NUMBER() OVER (
              ORDER BY COALESCE(up.xp, 0) DESC, COALESCE(up.streak_days, 0) DESC, u.created_at ASC
            )::int AS rank,
            u.id,
            u.email,
            COALESCE(up.xp, 0)::int AS xp,
            COALESCE(up.streak_days, 0)::int AS streak_days
          FROM users u
          LEFT JOIN user_progress up ON up.user_id = u.id
          WHERE u.is_blocked = FALSE
        )
        SELECT rank, id, email, xp, streak_days
        FROM ranked
        ORDER BY rank ASC
        LIMIT 10
      `
    ),
    query<LeaderboardRow>(
      `
        WITH ranked AS (
          SELECT
            ROW_NUMBER() OVER (
              ORDER BY COALESCE(up.xp, 0) DESC, COALESCE(up.streak_days, 0) DESC, u.created_at ASC
            )::int AS rank,
            u.id,
            u.email,
            COALESCE(up.xp, 0)::int AS xp,
            COALESCE(up.streak_days, 0)::int AS streak_days
          FROM users u
          LEFT JOIN user_progress up ON up.user_id = u.id
          WHERE u.is_blocked = FALSE
        )
        SELECT rank, id, email, xp, streak_days
        FROM ranked
        WHERE id = $1
        LIMIT 1
      `,
      [auth.user.id]
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
      accuracy
    },
    srsSummary: {
      overdue: srsSummary.overdue,
      dueSoon: srsSummary.due_soon,
      nextReviewTime: srsSummary.next_review_at
    },
    leaderboardTop: leaderboardTopResult.rows.map((row) => ({
      rank: row.rank,
      id: row.id,
      name: deriveDisplayName(row.email),
      xp: row.xp,
      streak: row.streak_days
    })),
    myLeaderboardRow: myLeaderboardRowResult.rows[0]
      ? {
          rank: myLeaderboardRowResult.rows[0].rank,
          id: myLeaderboardRowResult.rows[0].id,
          name: deriveDisplayName(myLeaderboardRowResult.rows[0].email),
          xp: myLeaderboardRowResult.rows[0].xp,
          streak: myLeaderboardRowResult.rows[0].streak_days
        }
      : null
  };

  const response = NextResponse.json(payload, { status: 200 });

  if (auth.refreshedAccessToken) {
    setAccessCookie(response, auth.refreshedAccessToken);
  }

  return response;
}
