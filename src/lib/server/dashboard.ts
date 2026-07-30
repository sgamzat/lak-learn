import { query } from "@/lib/server/db";
import type { AuthUser } from "@/types/auth";
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
  display_name: string | null;
  xp: number;
  streak_days: number;
};

type CollectionRow = {
  id: number;
  title: string;
  total_words: number;
  learned_words: number;
};

export function deriveDisplayName(email: string, displayName: string | null): string {
  if (displayName && displayName.trim().length > 0) return displayName.trim();
  const [localPart] = email.split("@");
  const normalized = localPart?.trim();
  return normalized && normalized.length > 0 ? normalized : email;
}

export async function getDashboardData(user: AuthUser): Promise<DashboardData> {
  const [
    progressResult,
    lessonsResult,
    accuracyResult,
    srsSummaryResult,
    leaderboardTopResult,
    myLeaderboardRowResult,
    profileResult,
    collectionsResult,
  ] = await Promise.all([
    query<ProgressRow>(
      `SELECT xp, streak_days, learned_words
       FROM user_progress WHERE user_id = $1 LIMIT 1`,
      [user.id]
    ),

    query<LessonsRow>(
      `SELECT COUNT(*)::int AS lessons_completed
       FROM review_history WHERE user_id = $1`,
      [user.id]
    ),

    query<AccuracyRow>(
      `SELECT
         COUNT(*)::int AS total_reviews,
         COUNT(*) FILTER (WHERE rating IN ('know', 'unsure'))::int AS success_reviews
       FROM review_history WHERE user_id = $1`,
      [user.id]
    ),

    query<SrsSummaryRow>(
      `WITH selected_words AS (
         SELECT DISTINCT w.id AS word_id
         FROM words w
         WHERE w.is_active = TRUE
         LIMIT 200
       ),
       latest_review AS (
         SELECT DISTINCT ON (rh.word_id)
           rh.word_id, rh.next_review_at
         FROM review_history rh
         WHERE rh.user_id = $1
         ORDER BY rh.word_id, rh.reviewed_at DESC
       )
       SELECT
         COUNT(*) FILTER (WHERE lr.next_review_at IS NULL OR lr.next_review_at <= NOW())::int AS overdue,
         COUNT(*) FILTER (WHERE lr.next_review_at > NOW() AND lr.next_review_at <= NOW() + INTERVAL '24 hours')::int AS due_soon,
         MIN(lr.next_review_at) FILTER (WHERE lr.next_review_at > NOW()) AS next_review_at
       FROM selected_words sw
       LEFT JOIN latest_review lr ON lr.word_id = sw.word_id`,
      [user.id]
    ),

    query<LeaderboardRow>(
      `WITH ranked AS (
         SELECT
           ROW_NUMBER() OVER (
             ORDER BY COALESCE(up.xp,0) DESC, COALESCE(up.streak_days,0) DESC, u.created_at ASC
           )::int AS rank,
           u.id, u.email, u.display_name,
           COALESCE(up.xp,0)::int AS xp,
           COALESCE(up.streak_days,0)::int AS streak_days
         FROM users u
         LEFT JOIN user_progress up ON up.user_id = u.id
         WHERE u.is_blocked = FALSE
       )
       SELECT rank, id, email, display_name, xp, streak_days
       FROM ranked ORDER BY rank ASC LIMIT 10`
    ),

    query<LeaderboardRow>(
      `WITH ranked AS (
         SELECT
           ROW_NUMBER() OVER (
             ORDER BY COALESCE(up.xp,0) DESC, COALESCE(up.streak_days,0) DESC, u.created_at ASC
           )::int AS rank,
           u.id, u.email, u.display_name,
           COALESCE(up.xp,0)::int AS xp,
           COALESCE(up.streak_days,0)::int AS streak_days
         FROM users u
         LEFT JOIN user_progress up ON up.user_id = u.id
         WHERE u.is_blocked = FALSE
       )
       SELECT rank, id, email, display_name, xp, streak_days
       FROM ranked WHERE id = $1 LIMIT 1`,
      [user.id]
    ),

    query<{ display_name: string | null }>(
      `SELECT display_name FROM users WHERE id = $1 LIMIT 1`,
      [user.id]
    ),

    query<CollectionRow>(
      `WITH collection_word_list AS (
         SELECT
           c.id AS collection_id,
           c.title,
           w.id AS word_id
         FROM collections c
         JOIN collection_words cw ON cw.collection_id = c.id AND cw.is_excluded = FALSE
         JOIN words w ON w.id = cw.word_id AND w.is_active = TRUE
         WHERE c.is_active = TRUE AND c.is_public = TRUE AND c.kind = 'topic'
       ),
       user_reviewed AS (
         SELECT DISTINCT word_id
         FROM review_history
         WHERE user_id = $1
       )
       SELECT
         cwl.collection_id AS id,
         cwl.title,
         COUNT(DISTINCT cwl.word_id)::int AS total_words,
         COUNT(DISTINCT ur.word_id)::int AS learned_words
       FROM collection_word_list cwl
       LEFT JOIN user_reviewed ur ON ur.word_id = cwl.word_id
       GROUP BY cwl.collection_id, cwl.title
       HAVING COUNT(DISTINCT cwl.word_id) > 0
       ORDER BY cwl.collection_id ASC
       LIMIT 12`,
      [user.id]
    ),
  ]);

  const progress = progressResult.rows[0] ?? { xp: 0, streak_days: 0, learned_words: 0 };
  const lessonsCompleted = lessonsResult.rows[0]?.lessons_completed ?? 0;
  const totalReviews = accuracyResult.rows[0]?.total_reviews ?? 0;
  const successReviews = accuracyResult.rows[0]?.success_reviews ?? 0;
  const accuracy = totalReviews > 0 ? Math.round((successReviews / totalReviews) * 100) : 0;
  const srsSummary = srsSummaryResult.rows[0] ?? { overdue: 0, due_soon: 0, next_review_at: null };
  const currentUserDisplayName = profileResult.rows[0]?.display_name ?? null;

  return {
    profile: {
      name: deriveDisplayName(user.email, currentUserDisplayName),
      streak: progress.streak_days,
      xp: progress.xp,
      role: user.role,
    },
    progress: { lessonsCompleted, accuracy },
    srsSummary: {
      overdue: srsSummary.overdue,
      dueSoon: srsSummary.due_soon,
      nextReviewTime: srsSummary.next_review_at,
    },
    leaderboardTop: leaderboardTopResult.rows.map((row) => ({
      rank: row.rank,
      id: row.id,
      name: deriveDisplayName(row.email, row.display_name),
      xp: row.xp,
      streak: row.streak_days,
    })),
    myLeaderboardRow: myLeaderboardRowResult.rows[0]
      ? {
          rank: myLeaderboardRowResult.rows[0].rank,
          id: myLeaderboardRowResult.rows[0].id,
          name: deriveDisplayName(
            myLeaderboardRowResult.rows[0].email,
            myLeaderboardRowResult.rows[0].display_name
          ),
          xp: myLeaderboardRowResult.rows[0].xp,
          streak: myLeaderboardRowResult.rows[0].streak_days,
        }
      : null,
    collections: collectionsResult.rows.map((row) => ({
      id: row.id,
      title: row.title,
      totalWords: row.total_words,
      learnedWords: row.learned_words,
    })),
  };
}
