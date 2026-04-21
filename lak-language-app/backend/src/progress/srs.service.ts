import { Injectable } from '@nestjs/common';

/**
 * Spaced Repetition System (SRS) based on SM-2 algorithm
 * Used for scheduling word and sentence reviews
 */
@Injectable()
export class SrsService {
  /**
   * Calculate the next review interval based on user performance
   * @param currentInterval - Current interval in days
   * @param easeFactor - Current ease factor (default 2.5)
   * @param correct - Whether the answer was correct
   * @returns Object with new interval and ease factor
   */
  calculateNextReview(
    currentInterval: number,
    easeFactor: number = 2.5,
    correct: boolean,
  ): { interval: number; easeFactor: number } {
    if (correct) {
      // Increase interval and ease factor for correct answers
      let newEaseFactor = easeFactor + 0.1;
      if (newEaseFactor > 3.0) newEaseFactor = 3.0;

      let newInterval: number;
      if (currentInterval === 0) {
        newInterval = 1; // First review after 1 day
      } else if (currentInterval === 1) {
        newInterval = 3; // Second review after 3 days
      } else {
        newInterval = Math.round(currentInterval * newEaseFactor);
      }

      return { interval: newInterval, easeFactor: newEaseFactor };
    } else {
      // Reset interval for incorrect answers
      const newEaseFactor = Math.max(1.3, easeFactor - 0.2);
      return { interval: 0, easeFactor: newEaseFactor };
    }
  }

  /**
   * Calculate next review date
   * @param interval - Days until next review
   * @returns Date object for next review
   */
  getNextReviewDate(interval: number): Date {
    const now = new Date();
    const nextReview = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);
    
    // If interval is 0, schedule for now (immediate review)
    if (interval === 0) {
      return now;
    }
    
    return nextReview;
  }

  /**
   * Calculate XP reward based on performance
   * @param correct - Whether the answer was correct
   * @param difficulty - Word/sentence difficulty (1-5)
   * @param streak - Current streak for this item
   * @returns XP points to award
   */
  calculateXpReward(correct: boolean, difficulty: number = 1, streak: number = 0): number {
    if (!correct) return 0;

    const baseXp = 5;
    const difficultyMultiplier = 0.5 + (difficulty * 0.2); // 0.7 to 1.5
    const streakBonus = Math.min(streak * 0.1, 0.5); // Up to 50% bonus

    return Math.round(baseXp * difficultyMultiplier * (1 + streakBonus));
  }
}
