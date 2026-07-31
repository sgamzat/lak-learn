import { describe, expect, it } from "vitest";
import { deriveTopicStatus } from "@/lib/server/dashboard";

describe("deriveTopicStatus", () => {
  it("marks empty or untouched topics as not_started", () => {
    expect(
      deriveTopicStatus({
        totalWords: 0,
        knownWords: 0,
        newWords: 0,
        dueWords: 0,
        weakWords: 0,
      })
    ).toBe("not_started");
    expect(
      deriveTopicStatus({
        totalWords: 10,
        knownWords: 0,
        newWords: 10,
        dueWords: 0,
        weakWords: 0,
      })
    ).toBe("not_started");
  });

  it("prioritizes due cards as needs_review", () => {
    expect(
      deriveTopicStatus({
        totalWords: 20,
        knownWords: 18,
        newWords: 0,
        dueWords: 2,
        weakWords: 0,
      })
    ).toBe("needs_review");
  });

  it("marks high mastery without weak/due as mastered", () => {
    expect(
      deriveTopicStatus({
        totalWords: 20,
        knownWords: 16,
        newWords: 2,
        dueWords: 0,
        weakWords: 0,
      })
    ).toBe("mastered");
  });

  it("keeps weak topics in progress even at high known share", () => {
    expect(
      deriveTopicStatus({
        totalWords: 20,
        knownWords: 17,
        newWords: 0,
        dueWords: 0,
        weakWords: 2,
      })
    ).toBe("in_progress");
  });
});
