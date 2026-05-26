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

export interface DashboardData {
  profile: UserProfile;
  progress: ProgressMetrics;
  srsSummary: SRSQueueSummary;
  leaderboardTop: LeaderboardRankRow[];
  myLeaderboardRow: LeaderboardRankRow | null;
}
