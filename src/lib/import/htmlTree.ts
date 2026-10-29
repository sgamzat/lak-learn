/**
 * Минимальное DOM-дерево для разбора сохранённых страниц словарей.
 * Заменяет cheerio там, где нужна навигация по соседним узлам:
 *   <b>дом</b> <i>мн.</i> <b>дома</b>, <i>м.</i> къатта, къатри.
 *
 * Поддерживает то, что встречается на страницах narod.ru: вложенные inline-теги,
 * пустые элементы (<br>, <img>…), неявно закрывающиеся <p>/<td>/<tr>/<li>,
 * незакрытые и лишние закрывающие теги.
 */

import { decodeEntities } from "./htmlTables.ts";

export type TextNode = { type: "text"; data: string; parent: ElementNode | null; prev: Node | null; next: Node | null };
export type ElementNode = {
  type: "tag";
  name: string;
  attrs: string;
  children: Node[];
  parent: ElementNode | null;
  prev: Node | null;
  next: Node | null;
};
export type Node = TextNode | ElementNode;

const VOID = new Set(["br", "img", "hr", "col", "meta", "link", "input", "wbr", "area", "base", "source"]);
// Открытие этих тегов закрывает незакрытый одноимённый (или родственный) предыдущий
const IMPLICIT_CLOSE: Record<string, string[]> = {
  p: ["p"],
  li: ["li"],
  tr: ["tr", "td", "th"],
  td: ["td", "th"],
  th: ["td", "th"]
};
const BLOCK = new Set(["p", "div", "table", "tr", "td", "th", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6", "body", "html"]);

const TAG_RE = /<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;

function append(parent: ElementNode, node: Node): void {
  const last = parent.children[parent.children.length - 1] ?? null;
  node.prev = last;
  if (last) last.next = node;
  node.parent = parent;
  parent.children.push(node);
}

export function parseHtmlTree(html: string): ElementNode {
  const root: ElementNode = { type: "tag", name: "#root", attrs: "", children: [], parent: null, prev: null, next: null };
  const stack: ElementNode[] = [root];
  const top = () => stack[stack.length - 1];

  const addText = (raw: string) => {
    if (!raw) return;
    const data = decodeEntities(raw);
    const parent = top();
    const last = parent.children[parent.children.length - 1];
    if (last && last.type === "text") last.data += data;
    else append(parent, { type: "text", data, parent: null, prev: null, next: null });
  };

  let last = 0;
  TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_RE.exec(html))) {
    addText(html.slice(last, m.index));
    last = TAG_RE.lastIndex;
    if (!m[3]) continue; // комментарий или script/style

    const closing = m[2] === "/";
    const name = m[3].toLowerCase();

    if (!closing) {
      const closes = IMPLICIT_CLOSE[name];
      if (closes) {
        // Закрываем до ближайшего блочного предка, который не входит в список
        for (let i = stack.length - 1; i > 0; i -= 1) {
          if (closes.includes(stack[i].name)) {
            stack.length = i;
            break;
          }
          if (BLOCK.has(stack[i].name) && !closes.includes(stack[i].name)) break;
        }
      }
      const el: ElementNode = { type: "tag", name, attrs: m[4] ?? "", children: [], parent: null, prev: null, next: null };
      append(top(), el);
      if (!VOID.has(name) && !/\/\s*$/.test(m[4] ?? "")) stack.push(el);
      continue;
    }

    // Закрывающий тег: снимаем стек до соответствующего открытого, лишние — игнорируем
    for (let i = stack.length - 1; i > 0; i -= 1) {
      if (stack[i].name === name) {
        stack.length = i;
        break;
      }
      // Не выходим за границу блока ради закрытия inline-тега (</b> внутри другого <p>)
      if (BLOCK.has(stack[i].name) && !BLOCK.has(name)) break;
    }
  }
  addText(html.slice(last));
  return root;
}

export function textOf(node: Node): string {
  if (node.type === "text") return node.data;
  return node.children.map(textOf).join("");
}

export function hasAncestor(node: Node, names: string[]): boolean {
  for (let p = node.parent; p; p = p.parent) if (names.includes(p.name)) return true;
  return false;
}

export function findAll(root: ElementNode, names: string[]): ElementNode[] {
  const out: ElementNode[] = [];
  const walk = (el: ElementNode) => {
    for (const child of el.children) {
      if (child.type !== "tag") continue;
      if (names.includes(child.name)) out.push(child);
      walk(child);
    }
  };
  walk(root);
  return out;
}

export function isTag(node: Node | null | undefined, ...names: string[]): node is ElementNode {
  return Boolean(node && node.type === "tag" && (names.length === 0 || names.includes(node.name)));
}
