import { describe, expect, it } from "vitest";
import { parseSlovar1958Html } from "./slovar1958Html";
import { parseHtmlTree, textOf, findAll } from "./htmlTree";
import { buildSlovar1958SeedSql } from "./slovar1958Seed";

// Фрагменты реальной разметки parse/slovar_1958.html
const PAGE = `
<p>Предисловие: <b>пример</b> не статья.</p>
<h2>ОЬРУС АЛФАВИТ</h2>
<p><b>дом</b> <i>мн.</i> <b>дома</b>, <i>м.</i> къатта, къатри.</p>
<p><b>день</b> <i>мн.</i> <b>дни</b>, <i>м.</i> 1) кьини; 2) дяхтта. <i><b>День-деньской</b></i> — щалла кьини.</p>
<p><b>год</b> <i>мн.</i> <b>го&#769;ды</b> и <b>года&#769;</b>, <i>м.</i> шин, шинну.</p>
<p><b>бык</b> <i>м.</i> ниц.</p>
<p><b>загора&#769;ть</b> <i>несов.</i>, <b>загоре&#769;ть</b> <i>сов.</i> лухIилаган.</p>
`;

describe("htmlTree", () => {
  it("сохраняет соседей, незакрытые <p> и сущности", () => {
    const root = parseHtmlTree("<p><b>а&#769;</b> <i>мн.</i> текст<p>второй");
    const ps = findAll(root, ["p"]);
    expect(ps).toHaveLength(2);
    expect(textOf(ps[0])).toBe("а́ мн. текст");
    expect(textOf(ps[1])).toBe("второй");
  });
});

describe("parseSlovar1958Html", () => {
  const records = parseSlovar1958Html(PAGE);
  const lemmas = (ru: string) => records.filter((r) => r.translation === ru).map((r) => r.lemma);

  it("форма мн. ч. не становится отдельной статьёй (раньше пропадали «дом», «день»)", () => {
    expect(lemmas("дом")).toEqual(["къатта", "къатри"]);
    expect(lemmas("дома")).toEqual([]);
    expect(lemmas("день")).toEqual(["кьини", "дяхтта"]);
    expect(lemmas("дни")).toEqual([]);
  });

  it("несколько форм через «и»: «годы и года»", () => {
    expect(lemmas("год")).toEqual(["шин", "шинну"]);
    expect(records.find((r) => r.translation === "год")?.notes).toContain("годы/года");
  });

  it("помета рода не попадает в лакское слово", () => {
    expect(lemmas("бык")).toEqual(["ниц"]);
  });

  it("видовая пара — одна статья", () => {
    expect(records.some((r) => r.translation.startsWith("загоре"))).toBe(false);
    expect(lemmas("загорать")).toContain("лухIилаган");
  });

  it("предисловие до «ОЬРУС АЛФАВИТ» пропускается", () => {
    expect(records.some((r) => r.translation === "пример")).toBe(false);
  });

  it("прежнее поведение доступно для сравнения", () => {
    const old = parseSlovar1958Html(PAGE, { grammaticalForms: false });
    expect(old.some((r) => r.translation === "дома")).toBe(true);
  });
});

describe("buildSlovar1958SeedSql", () => {
  const sql = buildSlovar1958SeedSql(parseSlovar1958Html(PAGE));
  it("в транзакции, не перезаписывает существующие слова, канонизирует палочку", () => {
    expect(sql).toMatch(/BEGIN;[\s\S]*COMMIT;\s*$/);
    expect(sql).toContain("ON CONFLICT (lemma, translation) DO NOTHING");
    expect(sql).toContain("lak_canonical(lemma)");
  });
  it("не скрывает слова, которые пользователь добавил в изучение", () => {
    expect(sql).toContain("user_study_words");
  });
});
