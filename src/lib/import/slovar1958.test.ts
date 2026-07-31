import { describe, expect, it } from "vitest";
import { parseEntry, parseEntryLine } from "./slovar1958";

function byLemma(records: ReturnType<typeof parseEntry>) {
  return Object.fromEntries(records.map((r) => [r.lemma, r]));
}

describe("parseEntry — словарь 1958", () => {
  it("простое сущ. с синонимом", () => {
    const rows = parseEntryLine("абажу́р м. абажур, лампалул шар.");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      lemma: "абажур",
      translation: "абажур",
      gender: "м",
      partOfSpeech: "Сущ.",
      translationPriority: 1,
      synonymGroupId: "абажур",
      wordType: "word",
      collectionSlug: "slovar-1958-а"
    });
    expect(rows[1]).toMatchObject({
      lemma: "лампалул шар",
      translationPriority: 2,
      synonymGroupId: "абажур"
    });
  });

  it("несколько значений + идиома", () => {
    const rows = parseEntry({
      headword: "грязь",
      body: "ж. 1) кьяркьи, гьагъ, кьюнув; 2) чапалшиву, мурдалшиву; забросать грязью — кьяркьи рищун"
    });

    const words = rows.filter((r) => r.wordType === "word");
    const phrases = rows.filter((r) => r.wordType === "phrase");

    expect(words.filter((w) => w.synonymGroupId === "грязь#1").map((w) => w.lemma)).toEqual([
      "кьяркьи",
      "гьагъ",
      "кьюнув"
    ]);
    expect(words.filter((w) => w.synonymGroupId === "грязь#2").map((w) => w.lemma)).toEqual([
      "чапалшиву",
      "мурдалшиву"
    ]);
    expect(words.find((w) => w.lemma === "кьяркьи")?.translationPriority).toBe(1);
    expect(words.find((w) => w.lemma === "гьагъ")?.translationPriority).toBe(2);
    expect(phrases[0]).toMatchObject({
      lemma: "кьяркьи рищун",
      translation: "забросать грязью",
      wordType: "phrase"
    });
  });

  it("омонимы Коса 1 / Коса 2", () => {
    const a = parseEntry({ headword: "Коса 1", body: "ж. хIаллу (кIиз)" });
    const b = parseEntry({ headword: "Коса 2", body: "ж. чIиникI." });

    expect(a[0]).toMatchObject({
      lemma: "хIаллу",
      translation: "коса",
      gender: "ж",
      synonymGroupId: "коса#1"
    });
    expect(a[0].notes).toMatch(/кIиз/);
    expect(b[0]).toMatchObject({
      lemma: "чIиникI",
      synonymGroupId: "коса#2"
    });
  });

  it("глагол сов. + несов. в одной строке", () => {
    const rows = parseEntryLine("доба́вить сов., добавля́ть несов. ххи буллан, ххи бан.");
    expect(rows.map((r) => r.lemma)).toEqual(["ххи буллан", "ххи бан"]);
    expect(rows[0]).toMatchObject({
      translation: "добавить",
      partOfSpeech: "Глаг.",
      verbAspect: "сов.",
      translationPriority: 1
    });
    expect(rows[0].notes).toMatch(/добавлять/);
    expect(rows[0].notes).toMatch(/несов/);
  });

  it("бежать несов.", () => {
    const rows = parseEntryLine("бежа́ть несов. лихъан, лечан.");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      lemma: "лихъан",
      verbAspect: "несов.",
      partOfSpeech: "Глаг."
    });
  });

  it("предлог + обороты", () => {
    const rows = parseEntry({
      headword: "для",
      body: "предлог щин; ссан; для кого — щин; для тебя — вин; цепь для собаки — ккаччил щинзир."
    });
    const words = rows.filter((r) => r.wordType === "word");
    const phrases = rows.filter((r) => r.wordType === "phrase");

    expect(words.map((w) => w.lemma)).toEqual(["щин", "ссан"]);
    expect(words[0].partOfSpeech).toBe("Предл.");
    expect(phrases.map((p) => p.translation).sort()).toEqual(
      ["для кого", "для тебя", "цепь для собаки"].sort()
    );
  });

  it("переносное значение бахх.", () => {
    const rows = parseEntry({
      headword: "грязный",
      body: "прил. 1) чапалсса, цIинцIал бувцIусса; 2) бахх. мурдалсса, кьадарсса."
    });
    const g1 = rows.filter((r) => r.synonymGroupId === "грязный#1");
    const g2 = rows.filter((r) => r.synonymGroupId === "грязный#2");
    expect(g1.map((r) => r.lemma)).toEqual(["чапалсса", "цIинцIал бувцIусса"]);
    expect(g2[0].notes).toMatch(/перен/);
    expect(g2.map((r) => r.lemma)).toEqual(["мурдалсса", "кьадарсса"]);
  });

  it("заимствование + длинные дефиниции → notes, не lemma", () => {
    const rows = parseEntry({
      headword: "адрес",
      body: "м. адрес; 1) чагъарданул конвертрай, посылкалий дурсса чичру; 2) инсан ягу учреждения бусса кIану."
    });
    expect(rows.some((r) => r.lemma === "адрес")).toBe(true);
    expect(rows.every((r) => !r.lemma.includes("чагъарданул"))).toBe(true);
    expect(rows.every((r) => !r.lemma.includes("инсан ягу"))).toBe(true);
    const main = rows.find((r) => r.lemma === "адрес");
    expect(main?.notes ?? "").toMatch(/чагъарданул|инсан/);
  });

  it("дно: мн. в notes, lemma чIан", () => {
    const rows = parseEntry({
      headword: "дно",
      body: "мн. донья, ср. чIан (неххал, хьхьирил)."
    });
    const map = byLemma(rows);
    expect(map["чIан"]).toMatchObject({
      gender: "ср",
      partOfSpeech: "Сущ."
    });
    expect(map["чIан"].notes).toMatch(/мн\. донья/);
    expect(map["донья"]).toBeUndefined();
  });

  it("знать 1 / знать 2 — разные группы и POS", () => {
    const v = parseEntry({ headword: "знать 1", body: "несов. кIул хъанан, кIул хьун." });
    const n = parseEntry({
      headword: "знать 2",
      body: "мн. нет, собир. ж. хъуними, лавайми."
    });
    expect(v[0]).toMatchObject({
      partOfSpeech: "Глаг.",
      verbAspect: "несов.",
      synonymGroupId: "знать#1"
    });
    expect(n[0]).toMatchObject({
      partOfSpeech: "Сущ.",
      gender: "ж",
      synonymGroupId: "знать#2"
    });
    expect(n[0].notes).toMatch(/собир/);
    expect(n[0].notes).toMatch(/мн\. нет/);
  });

  it("красный + устойчивые сочетания", () => {
    const rows = parseEntry({
      headword: "красный",
      body: "прил. ятIулсса. Красная строка — байбишай хха; красная цена — хъинсса."
    });
    const words = rows.filter((r) => r.wordType === "word");
    const phrases = rows.filter((r) => r.wordType === "phrase");
    expect(words[0].lemma).toBe("ятIулсса");
    expect(phrases.map((p) => p.translation).sort()).toEqual(
      ["красная строка", "красная цена"].sort()
    );
  });

  it("OCR-точка между лакскими словами", () => {
    const rows = parseEntry({
      headword: "грязь",
      body: "ж. 1) кьяркьи. гьагъ; 2) чапалшиву."
    });
    expect(rows.filter((r) => r.wordType === "word").map((r) => r.lemma)).toEqual([
      "кьяркьи",
      "гьагъ",
      "чапалшиву"
    ]);
  });

  it("многословные лакские глоссы не режутся (барабанить)", () => {
    const rows = parseEntry({
      headword: "барабанить",
      body: "несов. 1) дачIу ришлан; 2) анаварну кьутI-кьутI тIун; 3) бахх. анаварну, букъавчIинну гьалгьа тIун."
    });
    const words = rows.filter((r) => r.wordType === "word");
    expect(words.map((w) => [w.synonymGroupId, w.lemma, w.translationPriority])).toEqual([
      ["барабанить#1", "дачIу ришлан", 1],
      ["барабанить#2", "анаварну кьутI-кьутI тIун", 1],
      ["барабанить#3", "анаварну", 1],
      ["барабанить#3", "букъавчIинну гьалгьа тIун", 2]
    ]);
    expect(words.find((w) => w.synonymGroupId === "барабанить#3")?.notes).toMatch(/перен/);
    // 3-словная глосса не должна уехать в notes первого смысла
    expect(words.find((w) => w.lemma === "дачIу ришлан")?.notes ?? "").not.toMatch(/кьутI/);
  });
});
