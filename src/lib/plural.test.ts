import { describe, expect, it } from "vitest";
import { countLabel, plural } from "./plural";

describe("plural", () => {
  const day: [string, string, string] = ["день", "дня", "дней"];
  it("0, 1, 2, 5, 11, 21, 22, 111", () => {
    expect([0, 1, 2, 5, 11, 12, 21, 22, 25, 111, 101].map((n) => plural(n, day))).toEqual([
      "дней", "день", "дня", "дней", "дней", "дней", "день", "дня", "дней", "дней", "день"
    ]);
  });
  it("countLabel", () => {
    expect(countLabel(0, day)).toBe("0 дней");
    expect(countLabel(3, ["фраза", "фразы", "фраз"])).toBe("3 фразы");
  });
});
