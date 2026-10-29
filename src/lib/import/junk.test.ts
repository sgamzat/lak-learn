import { describe, expect, it } from "vitest";
import { isJunkEntry } from "@/lib/import/junk";

describe("isJunkEntry", () => {
  it("помета вместо лакского слова", () => {
    expect(isJunkEntry({ lemma: "Союз", translation: "а" })).toBe(true);
    expect(isJunkEntry({ lemma: "несов", translation: "болтать" })).toBe(true);
    expect(isJunkEntry({ lemma: "2 несов", translation: "болеть" })).toBe(true);
    expect(isJunkEntry({ lemma: "1 прил", translation: "больной" })).toBe(true);
    expect(isJunkEntry({ lemma: "местоим", translation: "что-то" })).toBe(true);
  });

  it("русский глагол с пометой вида вместо лакского слова", () => {
    expect(isJunkEntry({ lemma: "разряжать несов", translation: "разрядить" })).toBe(true);
  });

  it("обрезок вместо перевода", () => {
    expect(isJunkEntry({ lemma: "урган", translation: "п" })).toBe(true);
  });

  it("настоящие записи не трогает", () => {
    expect(isJunkEntry({ lemma: "ийх", translation: "о" })).toBe(false); // предлог «о»
    expect(isJunkEntry({ lemma: "чIа", translation: "у" })).toBe(false);
    expect(isJunkEntry({ lemma: "бутылка", translation: "бутылка" })).toBe(false); // заимствование
    expect(isJunkEntry({ lemma: "дакI дакъа", translation: "нехотя" })).toBe(false);
    expect(isJunkEntry({ lemma: "1000 ват", translation: "киловатт" })).toBe(false);
  });
});
