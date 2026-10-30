-- ============================================================
-- Миграция 017: лакская грамматика слова из словаря «Лакку дуниял»
--
--   words.lak_class  — теперь 1–4: в учебнике у нескольких слов указан класс IV
--                      («ка» — рука, «аьгъушиву» — масло);
--   words.lak_forms  — формы как в книге: у существительного — родительный
--                      падеж, множественное число, родительный множественного
--                      («тӀахӀунттул, тӀахӀунтту, тӀахӀунттал»), у глагола —
--                      деепричастие и повелительное («ливхьуну II, лирхьуну III; лиша»);
--   words.lak_plural — множественное число, если его удалось восстановить.
-- Заполняются сидом db/seeds/lakku_dunial.sql (npm run parse:lakku-dunial -- --seed).
-- ============================================================

ALTER TABLE words DROP CONSTRAINT IF EXISTS words_lak_class_check;
ALTER TABLE words ADD CONSTRAINT words_lak_class_check CHECK (lak_class BETWEEN 1 AND 4);

ALTER TABLE words
  ADD COLUMN IF NOT EXISTS lak_forms  TEXT,
  ADD COLUMN IF NOT EXISTS lak_plural TEXT;

COMMENT ON COLUMN words.lak_forms IS 'Формы слова как в учебнике «Лакку дуниял»: род. п., мн. ч., род. п. мн. ч. (сущ.) или деепричастие; повелительное (глаг.).';
COMMENT ON COLUMN words.lak_plural IS 'Множественное число лакского существительного.';
