import { describe, expect, it } from "vitest";
import { primaryTranslationSql, wordInCollectionSql } from "@/lib/server/membership";

describe("wordInCollectionSql", () => {
  it("не требует is_manual: связи импорта (is_manual = FALSE) тоже считаются", () => {
    // Регрессия: из-за is_manual = TRUE у наборов slovar-1958-* было 0 слов
    expect(wordInCollectionSql("c.id")).not.toMatch(/is_manual/);
  });

  it("учитывает теги, связи и исключения для переданной коллекции", () => {
    const sql = wordInCollectionSql("$1");
    expect(sql).toContain("rule_tag_codes");
    expect(sql).toContain("m_cw.collection_id = $1");
    expect(sql).toContain("m_cw.is_excluded = FALSE");
    expect(sql).toContain("m_cw.is_excluded = TRUE");
    expect(sql).toContain("NOT EXISTS");
  });

  it("использует переданный алиас слова", () => {
    const sql = wordInCollectionSql("c.id", "ww");
    expect(sql).toContain("m_wt.word_id = ww.id");
    expect(sql).not.toMatch(/\bw\.id\b/);
  });
});

describe("primaryTranslationSql", () => {
  it("оставляет только основное слово из группы синонимов", () => {
    expect(primaryTranslationSql()).toBe("w.translation_priority = 1");
    expect(primaryTranslationSql("x")).toBe("x.translation_priority = 1");
  });
});
