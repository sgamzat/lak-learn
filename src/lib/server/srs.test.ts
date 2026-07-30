import { describe, expect, it } from "vitest";
import {
  clampEasinessFactor,
  getNextCardState,
  getXPByRating,
  isValidSRSRating,
  normalizeWordId,
  ratingToQuality,
  type ExistingCardRow
} from "@/lib/server/srs";

const baseCard = (overrides: Partial<ExistingCardRow> = {}): ExistingCardRow => ({
  easiness_factor: "2.50",
  repetition: 0,
  interval_days: 0,
  lapses: 0,
  total_reviews: 0,
  ...overrides
});

describe("SRS helpers", () => {
  it("normalizeWordId accepts positive integers", () => {
    expect(normalizeWordId(12)).toBe(12);
    expect(normalizeWordId("7")).toBe(7);
    expect(normalizeWordId(0)).toBeNull();
    expect(normalizeWordId(-1)).toBeNull();
    expect(normalizeWordId("abc")).toBeNull();
    expect(normalizeWordId(undefined)).toBeNull();
  });

  it("isValidSRSRating and ratingToQuality map ratings", () => {
    expect(isValidSRSRating("forgot")).toBe(true);
    expect(isValidSRSRating("maybe")).toBe(false);
    expect(ratingToQuality("forgot")).toBe(1);
    expect(ratingToQuality("unsure")).toBe(3);
    expect(ratingToQuality("know")).toBe(5);
  });

  it("clampEasinessFactor never goes below 1.3", () => {
    expect(clampEasinessFactor(1.0)).toBe(1.3);
    expect(clampEasinessFactor(2.555)).toBe(2.56);
  });

  it("getXPByRating awards points by rating", () => {
    expect(getXPByRating("know")).toBe(10);
    expect(getXPByRating("unsure")).toBe(5);
    expect(getXPByRating("forgot")).toBe(2);
  });
});

describe("SM-2 getNextCardState", () => {
  const now = new Date("2026-01-15T12:00:00.000Z");

  it("forgot resets repetition and schedules for 1 day", () => {
    const next = getNextCardState({
      rating: "forgot",
      existingCard: baseCard({ repetition: 4, interval_days: 20, lapses: 1, total_reviews: 5 }),
      now
    });

    expect(next.repetition).toBe(0);
    expect(next.intervalDays).toBe(1);
    expect(next.lapses).toBe(2);
    expect(next.totalReviews).toBe(6);
    expect(next.dueAt.toISOString()).toBe("2026-01-16T12:00:00.000Z");
    expect(next.easinessFactor).toBeLessThan(2.5);
  });

  it("first successful review sets interval to 1 day", () => {
    const next = getNextCardState({
      rating: "know",
      existingCard: null,
      now
    });

    expect(next.repetition).toBe(1);
    expect(next.intervalDays).toBe(1);
    expect(next.lapses).toBe(0);
    expect(next.easinessFactor).toBe(2.6);
  });

  it("second successful review sets interval to 6 days", () => {
    const next = getNextCardState({
      rating: "know",
      existingCard: baseCard({
        easiness_factor: "2.60",
        repetition: 1,
        interval_days: 1,
        total_reviews: 1
      }),
      now
    });

    expect(next.repetition).toBe(2);
    expect(next.intervalDays).toBe(6);
  });

  it("later successful reviews multiply interval by EF", () => {
    const next = getNextCardState({
      rating: "know",
      existingCard: baseCard({
        easiness_factor: "2.50",
        repetition: 2,
        interval_days: 6,
        total_reviews: 2
      }),
      now
    });

    expect(next.repetition).toBe(3);
    expect(next.intervalDays).toBe(Math.max(1, Math.round(6 * next.easinessFactor)));
  });

  it("unsure keeps learning path without lapse", () => {
    const next = getNextCardState({
      rating: "unsure",
      existingCard: baseCard({ repetition: 0, interval_days: 0 }),
      now
    });

    expect(next.repetition).toBe(1);
    expect(next.intervalDays).toBe(1);
    expect(next.lapses).toBe(0);
  });
});
