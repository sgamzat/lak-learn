import type { UserRole } from "@/types/auth";

export interface UserProfile {
  name: string;
  streak: number;
  xp: number;
  role: UserRole;
}

export interface ProgressMetrics {
  lessonsCompleted: number;
  accuracy: number;
}

export interface SRSQueueSummary {
  overdue: number;
  dueSoon: number;
  nextReviewTime: string | null;
  /** overdue + dueSoon для word_type = word (и прочего не-phrase) */
  dueWords: number;
  /** overdue + dueSoon для word_type = phrase */
  duePhrases: number;
  /** Новые карточки в изучении (due_at IS NULL) */
  newAvailable: number;
  /** Есть ли что-то в user_study_* */
  hasStudySelection: boolean;
}

export interface LeaderboardUser {
  id: string;
  name: string;
  xp: number;
  streak: number;
}

export interface LeaderboardRankRow extends LeaderboardUser {
  rank: number;
}

/** Статус темы для бейджа и сортировки на дашборде */
export type TopicStatus = "needs_review" | "in_progress" | "mastered" | "not_started";

/**
 * Прогресс по тематической коллекции.
 * Стадии слова: new / learning / known / weak (из user_srs_cards).
 */
export interface CollectionProgress {
  id: number;
  title: string;
  totalWords: number;
  /** Слова со стадией known (интервал ≥ 6 дней и без «слабости») */
  knownWords: number;
  /** Слова в активном запоминании */
  learningWords: number;
  /** Слабые (частые lapses / низкий EF) */
  weakWords: number;
  /** Ещё не начинали */
  newWords: number;
  /** Карточки с due_at ≤ now */
  dueWords: number;
  /** knownWords / totalWords, 0–100 */
  masteryPercent: number;
  /** Доля know+unsure по теме; null если отзывов нет */
  accuracy: number | null;
  lastReviewedAt: string | null;
  status: TopicStatus;
  /** Тема в user_study_collections */
  inStudy: boolean;
}

export interface DashboardData {
  profile: UserProfile;
  progress: ProgressMetrics;
  srsSummary: SRSQueueSummary;
  leaderboardTop: LeaderboardRankRow[];
  myLeaderboardRow: LeaderboardRankRow | null;
  collections: CollectionProgress[];
}
