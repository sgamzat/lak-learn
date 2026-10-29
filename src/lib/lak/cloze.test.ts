import { describe, expect, it } from "vitest";
import { makeCloze, splitExample } from "@/lib/lak/cloze";
import { lakAnswerVariants } from "@/lib/lak/variants";

describe("makeCloze", () => {
  it("заменяет искомое слово пропуском", () => {
    expect(makeCloze("Ва ттул ппури — Это мой отец", ["ттул"])).toEqual({ lak: "Ва ___ ппури", translation: "Это мой отец" });
  });

  it("любой вариант палочки и знаки препинания у слова", () => {
    expect(makeCloze("Ттун цӀа ХӀасанни — Меня зовут Гасан", lakAnswerVariants("цIа")).lak).toBe("Ттун ___ ХӀасанни");
    expect(makeCloze("Барчаллагь, къачча — Спасибо, не хочу", ["барчаллагь"]).lak).toBe("___, къачча");
  });

  it("слово в другой форме — лакская часть скрывается, перевод остаётся", () => {
    expect(makeCloze("Ттуйн дяркъю щуну дур — Я простудился", ["дяркъю щун"])).toEqual({ lak: null, translation: "Я простудился" });
  });

  it("не путает слово с частью другого слова", () => {
    expect(makeCloze("Ттул уссу уссар — У меня есть брат", ["уссу"]).lak).toBe("Ттул ___ уссар");
  });

  it("splitExample без перевода", () => {
    expect(splitExample("Ва ттул ппури")).toEqual({ lak: "Ва ттул ппури", translation: null });
  });
});
