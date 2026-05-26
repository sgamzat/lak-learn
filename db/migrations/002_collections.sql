ALTER TABLE words
ADD COLUMN IF NOT EXISTS popularity_score INTEGER;

CREATE INDEX IF NOT EXISTS idx_words_popularity_score ON words (popularity_score);

CREATE TABLE IF NOT EXISTS collections (
  id BIGSERIAL PRIMARY KEY,
  slug VARCHAR(128) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  level VARCHAR(16),
  cover_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  rule_tag_codes TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collection_words (
  collection_id BIGINT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  word_id BIGINT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  is_manual BOOLEAN NOT NULL DEFAULT FALSE,
  is_excluded BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection_id, word_id)
);

CREATE INDEX IF NOT EXISTS idx_collections_public_sort ON collections (is_public, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_collection_words_collection_id ON collection_words (collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_words_word_id ON collection_words (word_id);
