import { describe, expect, it } from "vitest";
import {
  digievCollectionSlug,
  parseDigievHtml,
  chaptersToImportRecords
} from "./digievPhrasebook";

const SAMPLE = `
<a name="glava01"></a>
<table>
<tr bgcolor="#EFFFEF"><th>ОБРАЩЕНИЕ</th><th>ЦIУХХАВУ</th></tr>
<tr><td>Товарищ!<td>Гьалмахчу!</td></tr>
<tr><td>Тетя:<td></td></tr>
<tr><td align=right>по отцу<td>Бутталссу!</td></tr>
<tr><td align=right>по матери<td>Ниттилссу!</td></tr>
<tr><td>Познакомьтесь, это мой...<td>КIулши ва ттул...</td></tr>
<tr align=right><td>...друг<td>...дусри</td></tr>
</table>
<a name="glava77"></a>
<table>
<tr bgcolor="#EFFFEF"><th>ДНИ НЕДЕЛИ</th><th>НЮЖМАР ДИЙССА КЬИНИРДУ</th></tr>
<tr><td>Понедельник<td>Итни</td></tr>
<tr><td>Вторник<td>Тталат</td></tr>
</table>
<a name="glava00"></a>
<p>Предисловие пропускается</p>
`;

describe("parseDigievHtml", () => {
  it("parses chapters and skips glava00", () => {
    const chapters = parseDigievHtml(SAMPLE);
    expect(chapters.map((c) => c.chapter)).toEqual([1, 77]);
    expect(chapters[0].titleRu).toBe("ОБРАЩЕНИЕ");
    expect(chapters[0].titleLak).toBe("ЦIУХХАВУ");
  });

  it("merges indented parent/child rows", () => {
    const ch = parseDigievHtml(SAMPLE).find((c) => c.chapter === 1)!;
    const texts = ch.phrases.map((p) => p.translation);
    expect(texts).toContain("Тетя (по отцу)");
    expect(texts).toContain("Тетя (по матери)");
    expect(ch.phrases.find((p) => p.translation === "Тетя (по отцу)")?.lemma).toBe(
      "Бутталссу!"
    );
  });

  it("builds import records with digiev slugs", () => {
    const chapters = parseDigievHtml(SAMPLE);
    const records = chaptersToImportRecords(chapters);
    expect(records.every((r) => r.wordType === "phrase")).toBe(true);
    expect(records.every((r) => r.collectionKind === "topic")).toBe(true);
    expect(digievCollectionSlug(77, "ДНИ НЕДЕЛИ")).toMatch(/^digiev-77-/);
  });
});
