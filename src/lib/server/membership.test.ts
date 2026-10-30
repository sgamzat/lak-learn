import { describe, expect, it } from "vitest";
import { lexemeInCollectionSql, primaryTranslationSql, wordInCollectionSql } from "@/lib/server/membership";

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

describe("lexemeInCollectionSql", () => {
  it("слово в коллекции, если в ней любое его значение (по лексеме)", () => {
    const sql = lexemeInCollectionSql("c.id", "ww");
    expect(sql).toContain("m_w.lexeme_id = ww.lexeme_id");
    expect(sql).toContain("m_cw.is_excluded = FALSE");
    expect(sql).not.toMatch(/is_manual/);
  });
});

describe("primaryTranslationSql", () => {
  it("оставляет только главное значение слова", () => {
    expect(primaryTranslationSql()).toBe("w.is_primary");
    expect(primaryTranslationSql("x")).toBe("x.is_primary");
  });
});
