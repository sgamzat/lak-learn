-- ============================================================
-- Миграция 016: уроки
--
-- Содержание уроков лежит в репозитории (content/lessons/*.json) — в базе
-- только то, что нужно для повторения и прогресса:
--   • источник «Лакку дуниял» (учебник С. Мусаева);
--   • коллекции lesson-NN (kind = 'lesson') со словами уроков — их наполняет
--     сид db/seeds/lessons.sql (npm run lessons:seed);
--   • words.lak_class — класс лакского существительного (1, 2, 3).
--     Столбец gender — это род русского перевода из словаря 1958 г., к лакским
--     классам он отношения не имеет;
--   • user_lesson_progress — где ученик остановился и что прошёл.
-- ============================================================

-- Тип источника «учебник»
ALTER TABLE sources DROP CONSTRAINT IF EXISTS sources_kind_check;
ALTER TABLE sources ADD CONSTRAINT sources_kind_check
  CHECK (kind IN ('phrasebook', 'dictionary', 'manual', 'textbook'));

INSERT INTO sources (code, title, author, year, url, kind) VALUES
  ('lakku_dunial', 'Лакку дуниял. Самоучитель лакского языка', 'С. Мусаев', 2012, NULL, 'textbook')
ON CONFLICT (code) DO NOTHING;

-- Коллекции уроков не показываются среди тем словаря и разговорника
ALTER TABLE collections DROP CONSTRAINT IF EXISTS chk_collection_kind;
ALTER TABLE collections ADD CONSTRAINT chk_collection_kind
  CHECK (kind IN ('topic', 'alphabet', 'lesson'));

ALTER TABLE words
  ADD COLUMN IF NOT EXISTS lak_class SMALLINT CHECK (lak_class BETWEEN 1 AND 3);

COMMENT ON COLUMN words.lak_class IS
  'Класс лакского существительного: 1 (ур), 2 (бур), 3 (дур). Источник — учебник «Лакку дуниял».';

CREATE TABLE IF NOT EXISTS user_lesson_progress (
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_number SMALLINT NOT NULL CHECK (lesson_number > 0),
  -- Шаг, на котором ученик остановился (с нуля)
  step          SMALLINT NOT NULL DEFAULT 0,
  -- Доля упражнений, решённых с первой попытки, в лучшем прохождении (0–100)
  best_score    SMALLINT,
  completed_at  TIMESTAMPTZ,
  times_completed INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, lesson_number)
);
