/**
 * Извлечение статей из HTML «Русско-лакского школьного словаря» 1958 г.
 * (parse/slovar_1958.html) → записи для импорта. Разбор самой статьи — slovar1958.ts.
 *
 * Статья на странице: <b>русское слово</b> <i>пометы</i> лакский перевод …
 * Каждый <b> вне <i> — кандидат в заголовок статьи, кроме:
 *   - inline-идиом <b><i>для кого</i></b> — …;
 *   - второй формы видовой пары «<b>добавить</b> <i>сов.</i>, <b>добавлять</b> <i>несов.</i>»;
 *   - грамматической формы после пометы: «<b>дом</b> <i>мн.</i> <b>дома</b>» —
 *     «дома» не отдельная статья, а форма мн. ч. статьи «дом».
 *     (Раньше «дома» становилась заголовком, а «дом» оставался без перевода:
 *     так из словаря пропадали «дом», «день», «пчела», «огонь»…)
 */

import { parseEntry, type ImportWordRecord } from "./slovar1958.ts";
import { findAll, hasAncestor, isTag, parseHtmlTree, textOf, type ElementNode, type Node } from "./htmlTree.ts";

export type Slovar1958ParseOptions = {
  /** Исправление форм «мн./ед.» (по умолчанию включено; false — прежнее поведение для сравнения) */
  grammaticalForms?: boolean;
};

const ASPECT_RE = /сов|несов|однокр/i;
// Пометы, после которых жирным идёт форма того же слова, а не новая статья
const FORM_MARK_RE = /^(?:[мжс]р?\.\s*)?(?:мн|ед)\.(?:\s*ч\.)?$/i;

// Не type guard: «false» значит «не <b>», а не «не элемент»
function isBold(node: Node | null | undefined): boolean {
  return isTag(node, "b", "strong");
}
function isItalic(node: Node | null | undefined): boolean {
  return isTag(node, "i", "em");
}
function isBlankText(node: Node): boolean {
  return node.type === "text" && !node.data.trim();
}

/** <b><i>для кого</i></b> перед тире — оборот внутри статьи, не заголовок. */
function isInlineIdiomBold(el: ElementNode): boolean {
  const onlyItalic =
    el.children.every((c) => (c.type === "text" ? !c.data.trim() : isItalic(c))) &&
    el.children.some((c) => isItalic(c) || (c.type === "tag" && findAll(c, ["i", "em"]).length > 0));
  if (!onlyItalic) return false;

  let node = el.next;
  for (let guard = 0; node && guard < 4; guard += 1, node = node.next) {
    if (node.type === "text") {
      if (/[—–−]/.test(node.data) || /\s-\s/.test(node.data)) return true;
      if (node.data.trim()) return false;
    } else {
      return false;
    }
  }
  return false;
}

/** Если после <b> идёт помета вида — это продолжение той же статьи. */
function peekAspectAfterBold(boldEl: ElementNode): { aspect: string; resumeAfter: Node | null } | null {
  let node = boldEl.next;
  for (let guard = 0; node && guard < 6; guard += 1, node = node.next) {
    if (node.type === "text") {
      if (node.data.trim() && !/^[,\s]+$/.test(node.data)) return null;
    } else if (isItalic(node)) {
      const t = textOf(node).trim();
      return ASPECT_RE.test(t) ? { aspect: t, resumeAfter: node.next } : null;
    } else {
      return null;
    }
  }
  return null;
}

/** Вторая лемма в паре сов./несов. в одном абзаце. */
function isSecondaryAspectHeadword(el: ElementNode): boolean {
  if (!peekAspectAfterBold(el)) return false;
  let node = el.prev;
  for (let guard = 0; node && guard < 12; guard += 1, node = node.prev) {
    if (node.type === "text") {
      if (node.data.trim() && !/^[,\s]+$/.test(node.data)) return false;
    } else if (isItalic(node)) {
      if (!ASPECT_RE.test(textOf(node))) return false;
    } else if (isBold(node)) {
      return true;
    } else {
      return false;
    }
  }
  return false;
}

/** «<b>дом</b> <i>мн.</i> <b>дома</b>» — для <b>дома</b>: помета формы перед ним и заголовок перед пометой */
function isGrammaticalFormBold(el: ElementNode, depth = 0): boolean {
  let node = el.prev;
  while (node && isBlankText(node)) node = node.prev;
  // «<b>годы</b> и <b>года</b>» — вторая форма через «и»/«или»/запятую
  if (node && node.type === "text" && /^\s*(?:и|или|,)\s*$/.test(node.data) && depth < 3) {
    let prevBold = node.prev;
    while (prevBold && isBlankText(prevBold)) prevBold = prevBold.prev;
    return isBold(prevBold) && isGrammaticalFormBold(prevBold as ElementNode, depth + 1);
  }
  if (!node || !isItalic(node) || !FORM_MARK_RE.test(textOf(node).trim())) return false;
  let before = node.prev;
  while (before && isBlankText(before)) before = before.prev;
  return isBold(before);
}

function extractBodyAfterBold(el: ElementNode, options: Required<Slovar1958ParseOptions>): string {
  let body = "";
  let node: Node | null = el.next;
  for (let steps = 0; node && steps < 80; steps += 1) {
    if (node.type === "text") {
      body += node.data;
    } else if (isItalic(node)) {
      body += ` ${textOf(node)} `;
    } else if (isBold(node)) {
      if (options.grammaticalForms && isGrammaticalFormBold(node as ElementNode)) {
        // «мн. дома» — форма в пометы, статья продолжается.
        // «мн. годы и года» → «мн. годы/года»: иначе «и года» попадёт в перевод
        const form = textOf(node).replace(/\u0301/g, "").trim();
        const connector = /(?:\s(?:и|или)|,)\s*$/;
        body = connector.test(body) && /(?:мн|ед)\./.test(body)
          ? `${body.replace(connector, "").trimEnd()}/${form} `
          : `${body} ${form} `;
        node = node.next;
        continue;
      }
      const pairAspect = peekAspectAfterBold(node as ElementNode);
      if (pairAspect) {
        body += ` ${textOf(node)} ${pairAspect.aspect}`;
        node = pairAspect.resumeAfter;
        continue;
      }
      if (isInlineIdiomBold(node as ElementNode)) {
        body += ` ${textOf(node)} `;
        node = node.next;
        continue;
      }
      break;
    } else if (isTag(node, "br", "p")) {
      break;
    } else {
      body += textOf(node);
    }
    node = node.next;
  }
  return body.replace(/^\s*[.,]\s*/, "").trim();
}

export function parseSlovar1958Html(html: string, opts: Slovar1958ParseOptions = {}): ImportWordRecord[] {
  const options: Required<Slovar1958ParseOptions> = { grammaticalForms: opts.grammaticalForms ?? true };

  // Основной корпус начинается с алфавита; предисловие с примерами пропускаем
  const marker = html.search(/ОЬРУС\s+АЛФАВИТ/i);
  const root = parseHtmlTree(marker >= 0 ? html.slice(marker) : html);

  const words: ImportWordRecord[] = [];
  const seen = new Set<string>();

  for (const el of findAll(root, ["b", "strong"])) {
    if (hasAncestor(el, ["b", "strong"])) continue;
    if (hasAncestor(el, ["i", "em"])) continue; // идиомы <i><b>…</b></i>
    if (isInlineIdiomBold(el)) continue;
    if (isSecondaryAspectHeadword(el)) continue;
    if (options.grammaticalForms && isGrammaticalFormBold(el)) continue;

    const russian = textOf(el).replace(/\u0301/g, "").trim();
    if (!russian) continue;
    if (/^[А-ЯЁ\s\-–—]+$/.test(russian) && russian.length > 15) continue;
    if (!/^[А-ЯЁа-яёA-Za-zIӀӏ]/.test(russian)) continue;
    if (/^(оьрус|русско|словарь|составитель|редактор|даг|алфавит)/i.test(russian)) continue;

    const body = extractBodyAfterBold(el, options);
    if (!body) continue;

    for (const parsed of parseEntry({ headword: russian, body })) {
      // «бык → м. ниц», «влага → ж. хъатлу»: помета рода в начале лакского слова
      const record = { ...parsed, lemma: parsed.lemma.replace(/^(?:(?:мн|ед|м|ж|ср)\.\s*)+/, "").trim() };
      if (!record.lemma) continue;
      const key = `${record.lemma.toLowerCase()}\0${record.translation.toLowerCase()}\0${record.synonymGroupId ?? ""}\0${record.wordType}`;
      if (seen.has(key)) continue;
      seen.add(key);
      words.push(record);
    }
  }

  return words;
}
