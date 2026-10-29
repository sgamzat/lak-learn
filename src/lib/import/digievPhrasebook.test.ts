import { describe, expect, it } from "vitest";
import {
  chaptersToImportRecords,
  classifyWordType,
  collectProperNouns,
  digievCollectionSlug,
  normalizeWordCase,
  parseDigievHtml,
  splitMergedCell,
  splitNumberedSenses,
  stripTrailingHeading
} from "./digievPhrasebook";
import { extractLeafTables } from "./htmlTables";
import { buildDigievSeedSql } from "./digievSeed";

// Фрагменты реальной разметки parse/lak.html
const SAMPLE = `
<a href="#glava01">ОБРАЩЕНИЕ . . . . . . ЦIУХХАВУ</a>
<a href="#glava94">АНТОНИМЫ . . . . . . АНТОНИМРУ</a>
<a name="glava00"></a>
<p>Предисловие пропускается</p>
<a name="glava01"></a>
<table>
<tr bgcolor="#EFFFEF"><th>ОБРАЩЕНИЕ</th><th>ЦIУХХАВУ</th></tr>
<tr><td>Товарищ!<td>Гьалмахчу!</td></tr>
<tr><td>Тетя:<td></td></tr>
<tr><td align=right>по отцу<td>Бутталссу!</td></tr>
<tr><td align=right>по матери<td>Ниттилссу!</td></tr>
<tr><td>Познакомьтесь, это мой...<td>КIулши ва ттул...</td></tr>
<tr align=right><td>...друг<td>...дусри</td></tr>
<tr><td>Прости(те) я не виноват<td>Ялтту учIу (бучIи) ттуй аьй дакъар</td></tr>
<tr><td>...это не моя вина ...<td>...му ттуйсса аьй дакъар</td></tr>
<tr><td>Мне пора идти домой<td>Ттун шаппай ачин чIунни</td></tr>
<tr><td>(жен.)<td>Ттун шаппай ачин чIунни</td></tr>
<tr><td>Как это будет по-лакски?Лакку мазрай му цукун шайссар?</td></tr>
<tr><td>Воробей<td>ЧIелму, шярлу</td></tr>
</table>
<a name="glava92"></a>
<table><tr><td>
  <table class="st20"><col><col>
    <tr><td>аплодировать<td>хъат ришлан</td></tr>
    <tr><td>браться<td>1. ласун 2. дугьан</td></tr>
    <tr><td>мочь<td>1. бюхълан; 2. гуж, хIал</td></tr>
  </table>
</td><td>
  <table class="st20"><col><col>
    <tr><td>варить<td>шахьлан, шашан дуллан</td></tr>
  </table>
</td></tr></table>
<a name="glava94"></a>
<h3>* * *</h3>
<table><tr><td><table><tr><td>большой — маленький<td>хъунмасса — чIивисса</tr></table></td></tr></table>
<a name="glava98"></a>
<table><tr><td>1 один<td>ца</td></tr><tr><td>13 тринадцать...<td>ацIния шамма...</td></tr></table>
<a name="glava99"></a>
<table><tr><td>Абумуслим<td>АбутIалип<td>Анвар<td>Асадуллагь<td>АхIмад<td>АхIмади</td></tr></table>
`;

const chapters = parseDigievHtml(SAMPLE);
const byChapter = (n: number) => chapters.find((c) => c.chapter === n)!;
const find = (n: number, ru: string) => byChapter(n).phrases.find((p) => p.translation === ru);

describe("extractLeafTables", () => {
  it("находит обе колонки вложенной вёрстки и незакрытые <td>", () => {
    const tables = extractLeafTables(`<table><tr><td><table><tr><td>а<td>б</tr></table></td><td><table><tr><td>в<td>г</td></tr></table></td></tr></table>`);
    expect(tables.map((t) => t.rows.map((r) => r.cells.map((c) => c.text)))).toEqual([[["а", "б"]], [["в", "г"]]]);
  });
});

describe("parseDigievHtml", () => {
  it("пропускает предисловие и списки имён", () => {
    expect(chapters.map((c) => c.chapter)).toEqual([1, 92, 94, 98]);
  });

  it("берёт название из оглавления, если в главе его нет", () => {
    expect(byChapter(94).titleRu).toBe("АНТОНИМЫ");
    expect(byChapter(94).titleLak).toBe("АНТОНИМРУ");
  });

  it("не теряет левую колонку вложенных таблиц (раньше терялась половина словаря)", () => {
    expect(find(92, "аплодировать")?.lemma).toBe("хъат ришлан");
    expect(find(92, "варить")?.lemma).toBe("шахьлан, шашан дуллан");
  });

  it("заголовок без перевода + строки с отступом", () => {
    expect(find(1, "Тетя (по отцу)")?.lemma).toBe("Бутталссу!");
    expect(find(1, "Тетя (по матери)")?.lemma).toBe("Ниттилссу!");
  });

  it("основа с многоточием склеивается с продолжением с ОБЕИХ сторон", () => {
    expect(find(1, "Познакомьтесь, это мой друг")?.lemma).toBe("КӀулши ва ттул дусри");
    expect(byChapter(1).phrases.some((p) => p.lemma.startsWith("..."))).toBe(false);
  });

  it("продолжение после полной фразы — самостоятельная фраза без многоточий", () => {
    expect(find(1, "это не моя вина")?.lemma).toBe("му ттуйсса аьй дакъар");
    expect(find(1, "Прости(те) я не виноват")).toBeDefined();
  });

  it("вариант «(жен.)» получает русскую часть предыдущей фразы", () => {
    expect(find(1, "Мне пора идти домой (жен.)")).toBeDefined();
  });

  it("разделяет русский и лакский, слипшиеся в одной ячейке", () => {
    expect(find(1, "Как это будет по-лакски?")?.lemma).toBe("Лакку мазрай му цукун шайссар?");
  });

  it("многозначные слова «1. … 2. …» — основное значение и синоним", () => {
    const senses = byChapter(92).phrases.filter((p) => p.translation === "браться");
    expect(senses.map((p) => [p.lemma, p.translationPriority])).toEqual([["ласун", 1], ["дугьан", 2]]);
    expect(senses.every((p) => p.synonymGroupId === "браться")).toBe(true);
    expect(byChapter(92).phrases.filter((p) => p.translation === "мочь").map((p) => p.lemma)).toEqual(["бюхълан", "гуж, хӀал"]);
  });

  it("числительные: «1 один» → «один (1)», без многоточий", () => {
    expect(find(98, "один (1)")?.lemma).toBe("ца");
    expect(find(98, "тринадцать (13)")?.lemma).toBe("ацӀния шамма");
  });

  it("палочка приведена к Ӏ", () => {
    expect(chapters.flatMap((c) => c.phrases).some((p) => /[а-я]I/i.test(p.lemma))).toBe(false);
  });

  it("слова и фразы", () => {
    expect(find(1, "Воробей")?.wordType).toBe("word");
    expect(find(1, "Товарищ!")?.wordType).toBe("phrase");
    expect(byChapter(92).phrases.every((p) => p.wordType === "word")).toBe(true);
  });
});

describe("вспомогательные функции", () => {
  it("classifyWordType", () => {
    expect(classifyWordType(5, "Желаю вам (тебе) успехов", "Зун (вин) тӀайлабацӀу хьуннав")).toBe("phrase");
    expect(classifyWordType(88, "Головастик", "Магъду кӀичӀала")).toBe("word");
    expect(classifyWordType(7, "К сожалению, я не могу", "ХӀайп, ттуща къахьунссар")).toBe("phrase");
    expect(classifyWordType(88, "Воробей", "ЧӀелму, шярлу")).toBe("word");
  });

  it("имена собственные — по фразам, где слово с заглавной не в начале предложения", () => {
    const proper = collectProperNouns([
      { lemma: "На Гъумучиву ура" },
      { lemma: "Ттул шагьру Гъумучи бур" },
      { lemma: "Мяйжанни, Ттун ччай." }, // «Ттун» после запятой…
      { lemma: "Му ттун ххуй бизлай бур" }, // …но со строчной встречается чаще
      { lemma: "Цума ттун кумаг бувна?" }
    ]);
    expect(proper.has("гъумучи")).toBe(true);
    expect(proper.has("ттун")).toBe(false);
  });

  it("регистр слов тематических глав: обычные — со строчной, имена — как есть", () => {
    const proper = new Set(["гъумучи"]);
    expect(normalizeWordCase({ lemma: "Най", translation: "Пчела" }, proper)).toEqual({ lemma: "най", translation: "пчела" });
    expect(normalizeWordCase({ lemma: "Гъумучи", translation: "Кумух" }, proper)).toEqual({ lemma: "Гъумучи", translation: "Кумух" });
    expect(normalizeWordCase({ lemma: "Москав", translation: "СССР" }, proper).translation).toBe("СССР");
  });

  it("splitMergedCell не режет обычную русскую фразу", () => {
    expect(splitMergedCell("Как дела? Хорошо.")).toBeNull();
  });

  it("splitNumberedSenses не трогает обычный текст", () => {
    expect(splitNumberedSenses("лечлан, лечин")).toEqual(["лечлан, лечин"]);
  });

  it("stripTrailingHeading отрезает приклеенный заголовок раздела", () => {
    expect(stripTrailingHeading("НацIу мечI КРАТКИЙ РУССКО-ЛАКСКИЙ СЛОВАРЬ")).toBe("НацIу мечI");
    expect(stripTrailingHeading("ЦIУХХАВУ")).toBe("ЦIУХХАВУ");
  });

  it("слаги коллекций стабильны", () => {
    expect(digievCollectionSlug(77, "ДНИ НЕДЕЛИ")).toBe("digiev-77-dni-nedeli");
  });
});

describe("buildDigievSeedSql", () => {
  const sql = buildDigievSeedSql(chapters, chaptersToImportRecords(chapters));

  it("в транзакции и не перезаписывает существующие слова", () => {
    expect(sql).toMatch(/^[\s\S]*BEGIN;[\s\S]*COMMIT;\s*$/);
    expect(sql).toContain("ON CONFLICT (lemma, translation) DO NOTHING");
    expect(sql).not.toMatch(/SET word_type = 'phrase'/);
  });

  it("экранирует кавычки", () => {
    const tricky = buildDigievSeedSql(
      [{ chapter: 1, slug: "digiev-01-x", titleRu: "Д'Артаньян", titleLak: null, phrases: [] }],
      []
    );
    expect(tricky).toContain("'Д''Артаньян'");
  });
});
