import { query, withTransaction } from "@/lib/server/db";
import { lessonSlug } from "@/lib/lessons";
import type { LessonProgress } from "@/lib/lessons/types";

type ProgressRow = {
  lesson_number: number;
  step: number;
  best_score: number | null;
  completed_at: string | null;
};

export async function getLessonProgressMap(userId: string): Promise<Map<number, LessonProgress>> {
  const result = await query<ProgressRow>(
    `SELECT lesson_number, step, best_score, completed_at
     FROM user_lesson_progress WHERE user_id = $1`,
    [userId]
  );
  return new Map(
    result.rows.map((r) => [
      r.lesson_number,
      { step: r.step, bestScore: r.best_score, completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null }
    ])
  );
}

export async function getLessonProgress(userId: string, lessonNumber: number): Promise<LessonProgress | null> {
  return (await getLessonProgressMap(userId)).get(lessonNumber) ?? null;
}

/** Запомнить шаг, на котором ученик остановился */
export async function saveLessonStep(userId: string, lessonNumber: number, step: number): Promise<void> {
  await query(
    `INSERT INTO user_lesson_progress (user_id, lesson_number, step)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, lesson_number) DO UPDATE SET step = EXCLUDED.step, updated_at = NOW()`,
    [userId, lessonNumber, step]
  );
}

/**
 * Урок пройден: прогресс сохраняется, слова урока добавляются в изучаемые,
 * а тем, которых ещё нет в повторении, создаются карточки «к повторению сейчас».
 * Слова только что встретились в уроке — первое повторение должно быть в тот же
 * день, иначе они окажутся в очереди новых слов позади тысяч других.
 */
export async function completeLesson(
  userId: string,
  lessonNumber: number,
  score: number | null
): Promise<{ wordsAdded: number; wordsTotal: number }> {
  return withTransaction(async (client) => {
    await client.query(
      `INSERT INTO user_lesson_progress (user_id, lesson_number, step, best_score, completed_at, times_completed)
       VALUES ($1, $2, 0, $3, NOW(), 1)
       ON CONFLICT (user_id, lesson_number) DO UPDATE SET
         step = 0,
         best_score = GREATEST(user_lesson_progress.best_score, EXCLUDED.best_score),
         completed_at = COALESCE(user_lesson_progress.completed_at, NOW()),
         times_completed = user_lesson_progress.times_completed + 1,
         updated_at = NOW()`,
      [userId, lessonNumber, score]
    );

    const words = await client.query<{ id: number }>(
      `SELECT w.id
       FROM collections c
       JOIN collection_words cw ON cw.collection_id = c.id AND NOT cw.is_excluded
       JOIN words w ON w.id = cw.word_id AND w.is_active AND w.translation_priority = 1
       WHERE c.slug = $1`,
      [lessonSlug(lessonNumber)]
    );
    const ids = words.rows.map((r) => r.id);
    if (ids.length === 0) return { wordsAdded: 0, wordsTotal: 0 };

    await client.query(
      `INSERT INTO user_study_words (user_id, word_id)
       SELECT $1, unnest($2::bigint[])
       ON CONFLICT DO NOTHING`,
      [userId, ids]
    );

    const cards = await client.query(
      `INSERT INTO user_srs_cards (user_id, word_id, easiness_factor, repetition, interval_days, due_at)
       SELECT $1, unnest($2::bigint[]), 2.5, 0, 0, NOW()
       ON CONFLICT (user_id, word_id) DO NOTHING`,
      [userId, ids]
    );

    return { wordsAdded: cards.rowCount ?? 0, wordsTotal: ids.length };
  });
}
