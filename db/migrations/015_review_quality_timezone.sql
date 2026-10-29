-- ============================================================
-- Миграция 015: вес ответа по типу упражнения и часовой пояс
--
--   users.timezone              — часовой пояс из браузера (серия дней считается
--                                 по полуночи пользователя, а не по UTC/03:00 МСК)
--   review_history.exercise_type — flashcard | choice | choice-reverse | recall
--   review_history.quality       — оценка SM-2 (1, 3, 4, 5), с которой посчитан интервал.
--                                 Нужна для будущего перехода на FSRS: по истории
--                                 ответов подбираются параметры памяти.
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(64);

ALTER TABLE review_history
  ADD COLUMN IF NOT EXISTS exercise_type VARCHAR(16),
  ADD COLUMN IF NOT EXISTS quality SMALLINT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_review_history_exercise_type') THEN
    ALTER TABLE review_history ADD CONSTRAINT chk_review_history_exercise_type
      CHECK (exercise_type IS NULL OR exercise_type IN ('flashcard', 'choice', 'choice-reverse', 'recall'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_review_history_quality') THEN
    ALTER TABLE review_history ADD CONSTRAINT chk_review_history_quality
      CHECK (quality IS NULL OR quality BETWEEN 0 AND 5);
  END IF;
END $$;

-- Аудитория — в основном Дагестан и диаспора в России
UPDATE users SET timezone = 'Europe/Moscow' WHERE timezone IS NULL;
