import { query } from "@/lib/server/db";
import type { AuthUser } from "@/types/auth";
import type { CollectionProgress, DashboardData, TopicStatus } from "@/types/dashboard";

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
  due_words: number;
  due_phrases: number;
  new_available: number;
  has_study_selection: boolean;
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
  known_words: number;
  learning_words: number;
  weak_words: number;
  new_words: number;
  due_words: number;
  success_reviews: number;
  total_reviews: number;
  last_reviewed_at: string | null;
  in_study: boolean;
};

/** Membership: tag rules + manual includes − exclusions (как /api/collections). */
function collectionMembershipSql(collectionAlias: string, wordAlias: string): string {
  return `
    (
      EXISTS (
        SELECT 1
        FROM tags t
        JOIN word_tags wt ON wt.tag_id = t.id
        WHERE wt.word_id = ${wordAlias}.id
          AND LOWER(t.code) = ANY (
            SELECT LOWER(value) FROM unnest(${collectionAlias}.rule_tag_codes) AS value
          )
      )
      OR EXISTS (
        SELECT 1
        FROM collection_words cw
        WHERE cw.collection_id = ${collectionAlias}.id
          AND cw.word_id = ${wordAlias}.id
          AND cw.is_manual = TRUE
          AND cw.is_excluded = FALSE
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM collection_words cw
      WHERE cw.collection_id = ${collectionAlias}.id
        AND cw.word_id = ${wordAlias}.id
        AND cw.is_excluded = TRUE
    )
  `;
}

export function deriveTopicStatus(input: {
  totalWords: number;
  knownWords: number;
  newWords: number;
  dueWords: number;
  weakWords: number;
}): TopicStatus {
  if (input.totalWords <= 0) return "not_started";
  if (input.dueWords > 0) return "needs_review";
  if (input.newWords === input.totalWords) return "not_started";
  const mastery = input.knownWords / input.totalWords;
  if (mastery >= 0.8 && input.weakWords === 0) return "mastered";
  return "in_progress";
}

function statusSortRank(status: TopicStatus): number {
  switch (status) {
    case "needs_review":
      return 0;
    case "in_progress":
      return 1;
    case "not_started":
      return 2;
    case "mastered":
      return 3;
    default:
      return 4;
  }
}

export function deriveDisplayName(email: string, displayName: string | null): string {
  if (displayName && displayName.trim().length > 0) return displayName.trim();
  const [localPart] = email.split("@");
  const normalized = localPart?.trim();
  return normalized && normalized.length > 0 ? normalized : email;
}

function mapCollectionRow(row: CollectionRow): CollectionProgress {
  const totalWords = row.total_words;
  const knownWords = row.known_words;
  const learningWords = row.learning_words;
  const weakWords = row.weak_words;
  const newWords = row.new_words;
  const dueWords = row.due_words;
  const masteryPercent =
    totalWords > 0 ? Math.round((knownWords / totalWords) * 100) : 0;
  const accuracy =
    row.total_reviews > 0
      ? Math.round((row.success_reviews / row.total_reviews) * 100)
      : null;
  const status = deriveTopicStatus({
    totalWords,
    knownWords,
    newWords,
    dueWords,
    weakWords,
  });

  return {
    id: row.id,
    title: row.title,
    totalWords,
    knownWords,
    learningWords,
    weakWords,
    newWords,
    dueWords,
    masteryPercent,
    accuracy,
    lastReviewedAt: row.last_reviewed_at,
    status,
    inStudy: row.in_study,
  };
}

export async function getDashboardData(user: AuthUser): Promise<DashboardData> {
  const membership = collectionMembershipSql("c", "w");

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
      `
      WITH selected_collections_words AS (
        SELECT DISTINCT w.id AS word_id
        FROM user_study_collections usc
        JOIN collections c ON c.id = usc.collection_id
        JOIN words w ON w.is_active = TRUE
        WHERE usc.user_id = $1
          AND c.is_active = TRUE
          AND c.is_public = TRUE
          AND w.translation_priority = 1
          AND ${membership}
      ),
      selected_words AS (
        SELECT usw.word_id
        FROM user_study_words usw
        JOIN words w ON w.id = usw.word_id
        WHERE usw.user_id = $1
          AND w.is_active = TRUE
          AND w.translation_priority = 1
        UNION
        SELECT word_id FROM selected_collections_words
      ),
      study_flags AS (
        SELECT
          EXISTS (SELECT 1 FROM user_study_words WHERE user_id = $1) OR
          EXISTS (SELECT 1 FROM user_study_collections WHERE user_id = $1)
            AS has_study_selection
      ),
      card_rows AS (
        SELECT
          sw.word_id,
          COALESCE(w.word_type, 'word') AS word_type,
          cs.due_at
        FROM selected_words sw
        JOIN words w ON w.id = sw.word_id
        LEFT JOIN user_srs_cards cs
          ON cs.user_id = $1 AND cs.word_id = sw.word_id
      )
      SELECT
        COUNT(cr.word_id) FILTER (
          WHERE cr.due_at IS NOT NULL AND cr.due_at <= NOW()
        )::int AS overdue,
        COUNT(cr.word_id) FILTER (
          WHERE cr.due_at > NOW() AND cr.due_at <= NOW() + INTERVAL '1 day'
        )::int AS due_soon,
        MIN(cr.due_at) FILTER (WHERE cr.due_at > NOW()) AS next_review_at,
        COUNT(cr.word_id) FILTER (
          WHERE cr.word_type IS DISTINCT FROM 'phrase'
            AND cr.due_at IS NOT NULL
            AND cr.due_at <= NOW() + INTERVAL '1 day'
        )::int AS due_words,
        COUNT(cr.word_id) FILTER (
          WHERE cr.word_type = 'phrase'
            AND cr.due_at IS NOT NULL
            AND cr.due_at <= NOW() + INTERVAL '1 day'
        )::int AS due_phrases,
        COUNT(cr.word_id) FILTER (WHERE cr.due_at IS NULL)::int AS new_available,
        BOOL_OR(sf.has_study_selection) AS has_study_selection
      FROM study_flags sf
      LEFT JOIN card_rows cr ON TRUE
      `,
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
      `
      WITH study_topic_ids AS (
        SELECT usc.collection_id
        FROM user_study_collections usc
        JOIN collections c ON c.id = usc.collection_id
        WHERE usc.user_id = $1
          AND c.is_active = TRUE
          AND c.is_public = TRUE
          AND COALESCE(c.kind, 'topic') = 'topic'
      ),
      scoped_collections AS (
        SELECT c.id, c.title, c.sort_order, c.rule_tag_codes,
               TRUE AS in_study
        FROM collections c
        WHERE c.id IN (SELECT collection_id FROM study_topic_ids)
        UNION ALL
        SELECT c.id, c.title, c.sort_order, c.rule_tag_codes,
               FALSE AS in_study
        FROM collections c
        WHERE NOT EXISTS (SELECT 1 FROM study_topic_ids)
          AND c.is_active = TRUE
          AND c.is_public = TRUE
          AND COALESCE(c.kind, 'topic') = 'topic'
      ),
      collection_word_list AS (
        SELECT DISTINCT
          sc.id AS collection_id,
          sc.title,
          sc.sort_order,
          sc.in_study,
          w.id AS word_id
        FROM scoped_collections sc
        JOIN collections c ON c.id = sc.id
        JOIN words w ON w.is_active = TRUE
          AND ${membership}
      ),
      word_stage AS (
        SELECT
          cwl.collection_id,
          cwl.word_id,
          CASE
            WHEN s.word_id IS NULL OR COALESCE(s.total_reviews, 0) = 0 THEN 'new'
            WHEN s.lapses >= 2 OR s.easiness_factor < 1.80 THEN 'weak'
            WHEN s.interval_days >= 6 THEN 'known'
            ELSE 'learning'
          END AS stage,
          CASE
            WHEN s.due_at IS NOT NULL AND s.due_at <= NOW() THEN 1
            ELSE 0
          END AS is_due,
          s.last_reviewed_at
        FROM collection_word_list cwl
        LEFT JOIN user_srs_cards s
          ON s.user_id = $1 AND s.word_id = cwl.word_id
      ),
      topic_reviews AS (
        SELECT
          cwl.collection_id,
          COUNT(*)::int AS total_reviews,
          COUNT(*) FILTER (WHERE rh.rating IN ('know', 'unsure'))::int AS success_reviews,
          MAX(rh.reviewed_at) AS last_reviewed_at
        FROM collection_word_list cwl
        JOIN review_history rh
          ON rh.word_id = cwl.word_id AND rh.user_id = $1
        GROUP BY cwl.collection_id
      )
      SELECT
        cwl.collection_id AS id,
        cwl.title,
        COUNT(DISTINCT cwl.word_id)::int AS total_words,
        COUNT(*) FILTER (WHERE ws.stage = 'known')::int AS known_words,
        COUNT(*) FILTER (WHERE ws.stage = 'learning')::int AS learning_words,
        COUNT(*) FILTER (WHERE ws.stage = 'weak')::int AS weak_words,
        COUNT(*) FILTER (WHERE ws.stage = 'new')::int AS new_words,
        COALESCE(SUM(ws.is_due), 0)::int AS due_words,
        COALESCE(MAX(tr.success_reviews), 0)::int AS success_reviews,
        COALESCE(MAX(tr.total_reviews), 0)::int AS total_reviews,
        MAX(COALESCE(tr.last_reviewed_at, ws.last_reviewed_at)) AS last_reviewed_at,
        BOOL_OR(cwl.in_study) AS in_study
      FROM collection_word_list cwl
      JOIN word_stage ws
        ON ws.collection_id = cwl.collection_id AND ws.word_id = cwl.word_id
      LEFT JOIN topic_reviews tr ON tr.collection_id = cwl.collection_id
      GROUP BY cwl.collection_id, cwl.title, cwl.sort_order
      HAVING COUNT(DISTINCT cwl.word_id) > 0
      ORDER BY cwl.sort_order ASC, cwl.collection_id ASC
      `,
      [user.id]
    ),
  ]);

  const progress = progressResult.rows[0] ?? { xp: 0, streak_days: 0, learned_words: 0 };
  const lessonsCompleted = lessonsResult.rows[0]?.lessons_completed ?? 0;
  const totalReviews = accuracyResult.rows[0]?.total_reviews ?? 0;
  const successReviews = accuracyResult.rows[0]?.success_reviews ?? 0;
  const accuracy = totalReviews > 0 ? Math.round((successReviews / totalReviews) * 100) : 0;
  const srsSummary = srsSummaryResult.rows[0] ?? {
    overdue: 0,
    due_soon: 0,
    next_review_at: null,
    due_words: 0,
    due_phrases: 0,
    new_available: 0,
    has_study_selection: false,
  };
  const currentUserDisplayName = profileResult.rows[0]?.display_name ?? null;

  const collections = collectionsResult.rows
    .map(mapCollectionRow)
    .sort((a, b) => {
      const rankDiff = statusSortRank(a.status) - statusSortRank(b.status);
      if (rankDiff !== 0) return rankDiff;
      if (b.dueWords !== a.dueWords) return b.dueWords - a.dueWords;
      if (a.status === "in_progress" && b.status === "in_progress") {
        return a.masteryPercent - b.masteryPercent;
      }
      const aTime = a.lastReviewedAt ? Date.parse(a.lastReviewedAt) : 0;
      const bTime = b.lastReviewedAt ? Date.parse(b.lastReviewedAt) : 0;
      if (bTime !== aTime) return bTime - aTime;
      return a.id - b.id;
    })
    .slice(0, 12);

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
      dueWords: srsSummary.due_words,
      duePhrases: srsSummary.due_phrases,
      newAvailable: srsSummary.new_available,
      hasStudySelection: srsSummary.has_study_selection,
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
    collections,
  };
}
