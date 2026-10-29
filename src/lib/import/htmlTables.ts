/**
 * Минимальный разбор HTML-таблиц без зависимостей.
 *
 * Учитывает то, на чём ломались регулярные выражения вида <table>…?</table>:
 *   - вложенные таблицы (вёрстка «в две колонки»: внешняя таблица, в каждой
 *     ячейке — своя таблица);
 *   - незакрытые <td>/<tr> (`<td>слово<td>перевод</td>`), как в HTML 4.
 *
 * Возвращает только «листовые» таблицы — без вложенных — в порядке документа.
 */

export type HtmlCell = { text: string; alignRight: boolean; isHeader: boolean };
export type HtmlRow = { cells: HtmlCell[]; alignRight: boolean };
export type HtmlTable = { rows: HtmlRow[] };

type TableState = { rows: HtmlRow[]; row: HtmlRow | null; cell: HtmlCell | null; hasNested: boolean };

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|<!--[\s\S]*?-->/g;

const ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", laquo: "«", raquo: "»",
  mdash: "—", ndash: "–", hellip: "…", copy: "©"
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function isAlignRight(attrs: string): boolean {
  return /\balign\s*=\s*["']?right/i.test(attrs);
}

function normalizeCellText(raw: string): string {
  return decodeEntities(raw)
    .replace(/ /g, " ")
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function extractLeafTables(html: string): HtmlTable[] {
  const stack: TableState[] = [];
  const leaves: HtmlTable[] = [];

  const closeCell = (t: TableState) => {
    if (t.cell) t.cell.text = normalizeCellText(t.cell.text);
    t.cell = null;
  };
  const closeRow = (t: TableState) => {
    closeCell(t);
    t.row = null;
  };

  let last = 0;
  TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;

  const appendText = (text: string) => {
    const t = stack[stack.length - 1];
    if (t?.cell) t.cell.text += text;
  };

  while ((m = TAG_RE.exec(html))) {
    appendText(html.slice(last, m.index));
    last = TAG_RE.lastIndex;
    if (!m[2]) continue; // комментарий

    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    const attrs = m[3] ?? "";
    const top = stack[stack.length - 1];

    if (tag === "table") {
      if (!closing) {
        if (top) top.hasNested = true;
        stack.push({ rows: [], row: null, cell: null, hasNested: false });
      } else if (top) {
        closeRow(top);
        stack.pop();
        if (!top.hasNested) leaves.push({ rows: top.rows.filter((r) => r.cells.length > 0) });
      }
      continue;
    }

    if (!top) continue;

    if (tag === "tr") {
      closeRow(top);
      if (!closing) {
        top.row = { cells: [], alignRight: isAlignRight(attrs) };
        top.rows.push(top.row);
      }
    } else if (tag === "td" || tag === "th") {
      closeCell(top);
      if (!closing) {
        if (!top.row) {
          top.row = { cells: [], alignRight: false };
          top.rows.push(top.row);
        }
        top.cell = { text: "", alignRight: isAlignRight(attrs), isHeader: tag === "th" };
        top.row.cells.push(top.cell);
      }
    } else if (tag === "br" || tag === "p" || tag === "div") {
      appendText("\n");
    }
  }

  return leaves;
}
