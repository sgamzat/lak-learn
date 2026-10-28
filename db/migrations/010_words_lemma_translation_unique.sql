-- ============================================================
-- Миграция 010: уникальность пары (lemma, translation)
--
-- Импортёр словаря 1958 (parse/run_slovar_1958.ts) использует
-- ON CONFLICT (lemma, translation), а админка ловит ошибку
-- words_lemma_translation_unique. Самого индекса в миграциях не было:
-- на чистой базе импорт падал с "no unique or exclusion constraint".
--
-- Если индекс уже создан вручную — миграция ничего не делает.
-- Если в таблице есть дубликаты — миграция останавливается с понятной
-- ошибкой, а не удаляет данные молча (на дубликаты могут ссылаться
-- карточки SRS пользователей). Найти дубликаты:
--
--   SELECT lemma, translation, array_agg(id ORDER BY id)
--   FROM words GROUP BY lemma, translation HAVING COUNT(*) > 1;
-- ============================================================

DO $$
DECLARE
  dup_count INT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'words' AND indexname = 'words_lemma_translation_unique'
  ) THEN
    RAISE NOTICE 'words_lemma_translation_unique уже существует — пропускаем';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO dup_count FROM (
    SELECT 1 FROM words GROUP BY lemma, translation HAVING COUNT(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION 'В words найдено % пар-дубликатов (lemma, translation). Объедините их вручную (запрос в шапке миграции) и перезапустите миграции.', dup_count;
  END IF;

  CREATE UNIQUE INDEX words_lemma_translation_unique ON words (lemma, translation);
END $$;
