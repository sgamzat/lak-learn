CREATE TABLE IF NOT EXISTS user_study_words (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_id BIGINT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, word_id)
);

CREATE TABLE IF NOT EXISTS user_study_collections (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection_id BIGINT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, collection_id)
);

CREATE INDEX IF NOT EXISTS idx_user_study_words_user_id ON user_study_words (user_id);
CREATE INDEX IF NOT EXISTS idx_user_study_words_word_id ON user_study_words (word_id);

CREATE INDEX IF NOT EXISTS idx_user_study_collections_user_id ON user_study_collections (user_id);
CREATE INDEX IF NOT EXISTS idx_user_study_collections_collection_id ON user_study_collections (collection_id);

