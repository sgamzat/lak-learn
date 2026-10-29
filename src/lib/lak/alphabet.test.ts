import { describe, expect, it } from "vitest";
import {
  LAK_ALPHABET,
  compareLak,
  displayLetter,
  lakFirstLetter,
  lakLooseKey,
  lakSearchKey,
  lakSortKey,
  splitLakLetters,
  toLakCanonical
} from "@/lib/lak/alphabet";

// Эти же примеры дают те же результаты в SQL (миграция 011): сверено
// на всём словаре 1958 г. — 28 887 слов, 0 расхождений.

describe("toLakCanonical", () => {
  it("латинская I и цифра 1 после буквы — палочка Ӏ", () => {
    expect(toLakCanonical("кIула")).toBe("кӀула");
    expect(toLakCanonical("танмих1")).toBe("танмихӀ");
    expect(toLakCanonical("ХIакин")).toBe("ХӀакин");
    expect(toLakCanonical("цӏу")).toBe("цӀу"); // строчная ӏ → каноническая Ӏ
    expect(toLakCanonical("пiяй чIапiи")).toBe("пӀяй чӀапӀи"); // строчная латинская i (Дигиев)
  });

  it("отдельно стоящие числа не трогает", () => {
    expect(toLakCanonical("1000 ват")).toBe("1000 ват");
    expect(toLakCanonical("1 несов")).toBe("1 несов");
  });

  it("идемпотентна", () => {
    const once = toLakCanonical("хьхьичIун");
    expect(toLakCanonical(once)).toBe(once);
  });
});

describe("lakSearchKey", () => {
  it("любой вариант палочки и регистра даёт один ключ", () => {
    const key = lakSearchKey("кӀа");
    expect(lakSearchKey("КIа")).toBe(key);
    expect(lakSearchKey("к1а")).toBe(key);
    expect(lakSearchKey("кӏа")).toBe(key);
    expect(key).toBe("кӏа");
  });

  it("убирает ударения и лишние пробелы", () => {
    expect(lakSearchKey("  ду́с   ттул ")).toBe("дус ттул");
  });
});

describe("lakLooseKey (проверка ответа)", () => {
  it("палочка засчитывается в любом виде, даже отдельным символом", () => {
    expect(lakLooseKey("кIа")).toBe(lakLooseKey("кӀа"));
    expect(lakLooseKey("кiа")).toBe(lakLooseKey("кӀа")); // строчная i с телефона
    expect(lakLooseKey("l")).toBe(lakLooseKey("Ӏ"));
    expect(lakLooseKey("|")).toBe("ӏ");
  });
});

describe("алфавит", () => {
  it("диграфы — отдельные буквы, самое длинное совпадение первым", () => {
    expect(splitLakLetters("хьхьичIун")).toEqual(["хьхь", "и", "чӏ", "у", "н"]);
    expect(splitLakLetters("къатта")).toEqual(["къ", "а", "тт", "а"]);
    expect(splitLakLetters("аьрщи")).toEqual(["аь", "р", "щ", "и"]);
  });

  it("первая буква различает к / кк / къ / кь / кӏ", () => {
    expect(lakFirstLetter("кулпат")).toBe("к");
    expect(lakFirstLetter("ккаккан")).toBe("кк");
    expect(lakFirstLetter("къарпуз")).toBe("къ");
    expect(lakFirstLetter("кьали")).toBe("кь");
    expect(lakFirstLetter("кIула")).toBe("кӏ");
    expect(lakFirstLetter("1000 ват")).toBeNull();
  });

  it("сортировка по лакскому алфавиту, а не по Unicode", () => {
    const words = ["кӀула", "кулпат", "къатта", "ккаккан", "кьали", "ка"];
    expect([...words].sort(compareLak)).toEqual(["ка", "кулпат", "ккаккан", "къатта", "кьали", "кӀула"]);
    // слово раньше словосочетания, которое с него начинается
    expect(compareLak("дус", "дус ттул")).toBeLessThan(0);
  });

  it("ключ сортировки: пробел = 0, буквы = 1..N", () => {
    expect(lakSortKey("а б")).toEqual([1, 0, 3]);
  });

  it("порядок и состав алфавита сверены по словарю 1958 г.", () => {
    expect(LAK_ALPHABET).toContain("хьхь");
    expect(LAK_ALPHABET).not.toContain("гӏ");
    expect(LAK_ALPHABET).not.toContain("уь");
    expect(LAK_ALPHABET.indexOf("къ")).toBeLessThan(LAK_ALPHABET.indexOf("кь"));
    expect(new Set(LAK_ALPHABET).size).toBe(LAK_ALPHABET.length);
  });

  it("буква для показа", () => {
    expect(displayLetter("кӏ")).toBe("КӀ");
    expect(displayLetter("хьхь")).toBe("Хьхь");
  });
});
