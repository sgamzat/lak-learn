CREATE TABLE IF NOT EXISTS user_srs_cards (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_id BIGINT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  easiness_factor NUMERIC(4, 2) NOT NULL DEFAULT 2.50,
  repetition INTEGER NOT NULL DEFAULT 0,
  interval_days INTEGER NOT NULL DEFAULT 0,
  due_at TIMESTAMPTZ,
  last_reviewed_at TIMESTAMPTZ,
  lapses INTEGER NOT NULL DEFAULT 0,
  total_reviews INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, word_id),
  CHECK (easiness_factor >= 1.30),
  CHECK (repetition >= 0),
  CHECK (interval_days >= 0),
  CHECK (lapses >= 0),
  CHECK (total_reviews >= 0)
);

CREATE INDEX IF NOT EXISTS idx_user_srs_cards_user_due ON user_srs_cards (user_id, due_at);
CREATE INDEX IF NOT EXISTS idx_user_srs_cards_word_id ON user_srs_cards (word_id);

WITH latest_reviews AS (
  SELECT DISTINCT ON (rh.user_id, rh.word_id)
    rh.user_id,
    rh.word_id,
    rh.reviewed_at,
    rh.next_review_at
  FROM review_history rh
  ORDER BY rh.user_id, rh.word_id, rh.reviewed_at DESC, rh.id DESC
),
review_stats AS (
  SELECT
    rh.user_id,
    rh.word_id,
    COUNT(*)::int AS total_reviews,
    COUNT(*) FILTER (WHERE rh.rating = 'forgot')::int AS lapses
  FROM review_history rh
  GROUP BY rh.user_id, rh.word_id
)
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
  created_at,
  updated_at
)
SELECT
  lr.user_id,
  lr.word_id,
  2.50,
  0,
  CASE
    WHEN lr.next_review_at IS NULL THEN 0
    ELSE GREATEST(
      0,
      ROUND(EXTRACT(EPOCH FROM (lr.next_review_at - lr.reviewed_at)) / 86400.0)::int
    )
  END AS interval_days,
  lr.next_review_at,
  lr.reviewed_at,
  rs.lapses,
  rs.total_reviews,
  NOW(),
  NOW()
FROM latest_reviews lr
JOIN review_stats rs
  ON rs.user_id = lr.user_id
 AND rs.word_id = lr.word_id
ON CONFLICT (user_id, word_id) DO NOTHING;
