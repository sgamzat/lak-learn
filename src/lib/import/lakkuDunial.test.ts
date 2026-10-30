import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { joinEntryLines, parseEntry, parseLakkuDunialDictionary, pluralFromForms, splitSenses } from "./lakkuDunial.ts";
import { buildLakkuDunialSeedSql, lakkuDunialRows } from "./lakkuDunialSeed.ts";

describe("словарь «Лакку дуниял» — статья", () => {
  it("существительное: класс, формы, мн. число", () => {
    expect(parseEntry("тIахIни III (тIахIунттул, тIахIунтту, тIахIунттал) – посуда")).toMatchObject({
      lemma: "тӀахӀни",
      senses: ["посуда"],
      lakClass: 3,
      plural: "тӀахӀунтту",
      partOfSpeech: "noun"
    });
  });

  it("необязательное окончание и формы через дефис", () => {
    expect(parseEntry("ажар(и) II (-ттул, -тту, -ттал) – петух")).toMatchObject({ lemma: "ажар(и)", lakClass: 2, plural: "ажартту" });
  });

  it("неправильное мн. число полной формой", () => {
    expect(parseEntry("адимина I (адиминал, арамтал, арамтурал) – мужчина")).toMatchObject({ lakClass: 1, plural: "арамтал" });
  });

  it("транскрипция и родительный падеж без мн. числа", () => {
    expect(parseEntry("агьалий [ăгьа:ли:] (-нал) – народ, население")).toMatchObject({
      lemma: "агьалий",
      transcription: "ăгьа:ли:",
      plural: null,
      partOfSpeech: "noun"
    });
  });

  it("глагол: классы внутри форм — не класс слова", () => {
    expect(parseEntry("лишин (ливхьуну II, лирхьуну III; лиша) – вытереть, протереть")).toMatchObject({
      lemma: "лишин",
      lakClass: null,
      partOfSpeech: "verb",
      forms: "ливхьуну II, лирхьуну III; лиша"
    });
  });

  it("связки и прилагательные с классом — без класса", () => {
    expect(parseEntry("бур II – ест, имеется, находится")?.lakClass).toBeNull();
    expect(parseEntry("бювчIусса II – гладкий, -ая, -ое, -ие")?.lakClass).toBeNull();
  });

  it("два класса — класс не указываем", () => {
    expect(parseEntry("оьрчI I,II (ал, -ру, -ал) – мальчик, юноша")).toMatchObject({ lakClass: null, plural: "оьрчӀру" });
  });

  it("нумерованные значения — отдельно", () => {
    expect(splitSenses("1) пелерина; 2) воротник для шубы")).toEqual(["пелерина", "воротник для шубы"]);
    expect(splitSenses("книга – 16")).toEqual(["книга"]);
  });

  it("без перевода и названия в кавычках — пропускаются", () => {
    expect(parseEntry("агитация II (-лул, ртту, -рттал)")).toBeNull();
    expect(parseEntry("«Азаллий ца хьхьу» – [сказка] «Тысяча одна ночь»")).toBeNull();
  });

  it("мн. число: «ртту» без дефиса — опечатка, не форма", () => {
    expect(pluralFromForms("агитация", "-лул, ртту, -рттал")).toBeNull();
  });

  it("перенос строки внутри скобок склеивается", () => {
    const joined = joinEntryLines("айишин (айивхьура, байбивхьура,\nбайбивхьуссар) I – начать\nав II (-лул, -рду, -рдал) – горный тур");
    expect(joined).toHaveLength(2);
    expect(joined[0].text).toContain("байбивхьуссар) I – начать");
  });

  it("строка со скобкой в начале после полной статьи — отдельная статья", () => {
    const joined = joinEntryLines("бакI II (-рал, -ру, -урдил) – голова\n(щицIун-бунугу) бакI бахIин – связать судьбу");
    expect(joined).toHaveLength(2);
  });
});

describe("словарь «Лакку дуниял» — целиком", () => {
  const text = readFileSync(new URL("../../../parse/lakku_dunial_dictionary.txt", import.meta.url), "utf8");
  const entries = parseLakkuDunialDictionary(text);

  it("разобрано больше 2000 статей, у сотен — класс и мн. число", () => {
    expect(entries.length).toBeGreaterThan(2000);
    expect(entries.filter((e) => e.lakClass).length).toBeGreaterThan(600);
    expect(entries.filter((e) => e.plural).length).toBeGreaterThan(350);
  });

  it("сид db/seeds/lakku_dunial.sql собран из текущего парсера (npm run parse:lakku-dunial -- --seed)", () => {
    const seed = readFileSync(new URL("../../../db/seeds/lakku_dunial.sql", import.meta.url), "utf8");
    expect(seed === buildLakkuDunialSeedSql(lakkuDunialRows(entries))).toBe(true);
  });
});
