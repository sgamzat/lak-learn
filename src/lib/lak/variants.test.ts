import { describe, expect, it } from "vitest";
import { lakAnswerKey, lakAnswerVariants } from "@/lib/lak/variants";

describe("lakAnswerVariants", () => {
  it("варианты через запятую у слов", () => {
    expect(lakAnswerVariants("лечлан, лечин", { translation: "бегать, бежать" })).toEqual(["лечлан, лечин", "лечлан", "лечин"]);
    expect(lakAnswerVariants("чӀелму, шярлу", { translation: "воробей" })).toContain("шярлу");
  });

  it("реплика с запятой — не варианты", () => {
    expect(lakAnswerVariants("юх, барчаллагь", { translation: "нет, спасибо" })).toEqual(["юх, барчаллагь"]);
    expect(lakAnswerVariants("Юх, барчаллагь", { wordType: "phrase", translation: "Нет, спасибо" })).toEqual(["Юх, барчаллагь"]);
  });

  it("форма в скобках заменяет слово перед ней", () => {
    expect(lakAnswerVariants("инжит уллан (буллан)")).toEqual(["инжит уллан", "инжит буллан"]);
    expect(lakAnswerVariants("вил (зул) дакӀнин щун бан", { wordType: "phrase" })).toEqual([
      "вил дакӀнин щун бан",
      "зул дакӀнин щун бан"
    ]);
    expect(lakAnswerVariants("Къаоьвчинна (занг къаданна)", { wordType: "phrase" })).toEqual(["Къаоьвчинна", "занг къаданна"]);
  });

  it("необязательное окончание: ба(ра)", () => {
    expect(lakAnswerVariants("изму була(ра)")).toEqual(["изму була", "изму булара"]);
  });

  it("пометы в скобках убираются", () => {
    expect(lakAnswerVariants("Хъинну бикӀи (множ. чис.)", { wordType: "phrase" })).toEqual(["Хъинну бикӀи"]);
  });

  it("непарные скобки и запятые внутри скобок не ломают разбор", () => {
    expect(lakAnswerVariants("микӀ (бичайсса").some((v) => /[()]/.test(v))).toBe(false);
    expect(lakAnswerVariants("ур (бур, дур), ххуй").some((v) => /[()]/.test(v))).toBe(false);
  });
});

describe("lakAnswerKey", () => {
  it("без знаков препинания, регистра и с любой палочкой", () => {
    expect(lakAnswerKey("Цукун ура?")).toBe(lakAnswerKey("цукун ура"));
    expect(lakAnswerKey("КӀула!")).toBe(lakAnswerKey("кIула"));
  });
});
