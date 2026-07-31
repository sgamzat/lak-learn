// Парсер статей Русско-лакского школьного словаря 1958.
// Спека: docs/import-1958.md

export type WordGender = "м" | "ж" | "ср";
export type VerbAspect = "сов." | "несов." | "однокр.";
export type WordType = "word" | "phrase";

export type ImportWordRecord = {
  lemma: string;
  translation: string;
  transcription: null;
  partOfSpeech: string | null;
  gender: WordGender | null;
  verbAspect: VerbAspect | null;
  wordType: WordType;
  notes: string | null;
  imageUrl: null;
  translationPriority: number;
  synonymGroupId: string | null;
  collectionSlug: string;
  collectionTitle: string;
  collectionDescription: string;
  collectionLevel: null;
  collectionIsPublic: true;
  collectionSortOrder: number;
  collectionRuleTagCodes: string[];
  collectionKind: "alphabet";
  isManual: false;
  isExcluded: false;
};

export type ParseEntryInput = {
  /** Русский заголовок (из <b>/<strong> или начала строки) */
  headword: string;
  /** Остаток статьи после заголовка */
  body: string;
};

const ALPHABET = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ";
/** Больше стольких слов → дефиниция, не lemma (учебные фразы часто 3–4 слова) */
const MAX_LEMMA_WORDS = 4;
/**
 * Двусловные куски длиннее порога — чаще пояснение («чагъарданул конвертрай»),
 * а не компактная lemma вроде «дачIу ришлан».
 */
const MAX_LEMMA_CHARS_FOR_BIGRAM = 22;

const STRESS_MARK = /[\u0301\u0341́]/g;

const LEMMA_STOPWORDS = new Set([
  "нет",
  "мн",
  "ед",
  "ср",
  "см",
  "см.",
  "дахх",
  "дахх.",
  "бахх",
  "бахх.",
  "тж",
  "тж.",
  "и",
  "в",
  "на",
  "с",
  "по",
  "за",
  "от",
  "до",
  "из",
  "к",
  "или",
  "м.",
  "ж.",
  "ср.",
  "ц.",
  "м.ц.",
  "м.ц"
]);

/** Грамматические префиксы в начале body (повторяемые). */
const GRAMMAR_TOKEN =
  /^(?:мн\.\s*нет|ед\.\s*нет|мн\.\s+[А-ЯЁа-яёA-Za-zIӀӏ\u0400-\u04FF\-]+|ед\.\s+[А-ЯЁа-яёA-Za-zIӀӏ\u0400-\u04FF\-]+|сов\.?\s+и\s+несов\.?|сов\.?\s*,+\s*[а-яёА-ЯЁ\-]+(?:ть|ти|чь|сти|зть)?\s+несов\.?|несов\.?\s*,+\s*[а-яёА-ЯЁ\-]+(?:ть|ти|чь|сти|зть)?\s+сов\.?|однокр\.?|сов\.?|несов\.?|прил\.|нареч\.|предлог|предл\.|союз\.?|мест\.|межд\.|числ\.(?:\s*порядк\.)?|частица|вводн\.\s*сл\.|собир\.|устар\.|нескл\.|ист\.|возв\.|сущ\.|[мж]\.|ср\.)/i;

/**
 * Разбирает одну словарную статью в учебные записи.
 */
export function parseEntry(input: ParseEntryInput): ImportWordRecord[] {
  const head = normalizeHeadword(input.headword);
  if (!head.translation) {
    return [];
  }

  let body = normalizeBody(input.body);
  if (!body) {
    return [];
  }

  const grammar = extractGrammarPrefix(body);
  body = grammar.rest;

  const { senses, phrases } = splitSensesAndPhrases(body);
  const records: ImportWordRecord[] = [];
  const seen = new Set<string>();

  const baseNotes = grammar.notes;
  const letter = collectionLetter(head.translation);
  const collection = collectionMeta(letter);

  type SenseDraft = {
    lemmas: string[];
    definitionNotes: string | null;
    figurative: boolean;
  };

  const drafts: SenseDraft[] = [];
  for (const sense of senses) {
    const figurative = /(?:^|[\s;])(?:бахх|дахх)\.?/i.test(sense);
    let senseText = sense
      .replace(/(?:^|[\s;])(?:бахх|дахх)\.?\s*/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    senseText = normalizeLakSeparators(senseText);
    const extracted = extractLemmas(senseText);
    drafts.push({
      lemmas: extracted.lemmas,
      definitionNotes: extracted.definitionNotes,
      figurative
    });
  }

  // Дефиниции без lemma (типичный «адрес; 1) …») → notes к предыдущему смыслу с lemma
  for (let i = 0; i < drafts.length; i += 1) {
    if (drafts[i].lemmas.length > 0) {
      continue;
    }
    if (!drafts[i].definitionNotes) {
      continue;
    }
    let target = -1;
    for (let j = i - 1; j >= 0; j -= 1) {
      if (drafts[j].lemmas.length > 0) {
        target = j;
        break;
      }
    }
    if (target < 0) {
      for (let j = i + 1; j < drafts.length; j += 1) {
        if (drafts[j].lemmas.length > 0) {
          target = j;
          break;
        }
      }
    }
    if (target >= 0) {
      drafts[target].definitionNotes = mergeNotes([
        drafts[target].definitionNotes,
        drafts[i].definitionNotes
      ]);
      if (drafts[i].figurative) {
        drafts[target].figurative = true;
      }
    }
  }

  const activeDrafts = drafts.filter((d) => d.lemmas.length > 0);
  const senseCount = activeDrafts.length;

  for (let senseIndex = 0; senseIndex < activeDrafts.length; senseIndex += 1) {
    const draft = activeDrafts[senseIndex];
    const senseNum = senseCount > 1 || head.homonym != null ? senseIndex + 1 : null;
    const groupId = buildGroupId(head.translation, head.homonym, senseNum, senseCount);

    const notes = mergeNotes([
      baseNotes,
      draft.figurative ? "перен." : null,
      draft.definitionNotes,
      head.homonym != null ? `омоним ${head.homonym}` : null
    ]);

    const uniqueLemmas: string[] = [];
    for (const lemma of draft.lemmas) {
      const key = `${lemma.toLowerCase()}\0${head.translation.toLowerCase()}\0${groupId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      uniqueLemmas.push(lemma);
    }

    if (uniqueLemmas.length === 0) {
      continue;
    }

    const needsGroup =
      uniqueLemmas.length > 1 || senseCount > 1 || head.homonym != null;
    const synonymGroupId = needsGroup ? groupId : null;

    uniqueLemmas.forEach((lemma, i) => {
      records.push({
        lemma,
        translation: head.translation,
        transcription: null,
        partOfSpeech: grammar.partOfSpeech,
        gender: grammar.gender,
        verbAspect: grammar.verbAspect,
        wordType: "word",
        notes: i === 0 ? notes : mergeNotes([draft.figurative ? "перен." : null, baseNotes]),
        imageUrl: null,
        translationPriority: i + 1,
        synonymGroupId,
        ...collection,
        collectionRuleTagCodes: [],
        collectionKind: "alphabet",
        isManual: false,
        isExcluded: false
      });
    });
  }

  for (const phrase of phrases) {
    const key = `${phrase.lemma.toLowerCase()}\0${phrase.translation.toLowerCase()}\0phrase`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    records.push({
      lemma: phrase.lemma,
      translation: phrase.translation,
      transcription: null,
      partOfSpeech: "Фраза",
      gender: null,
      verbAspect: null,
      wordType: "phrase",
      notes: null,
      imageUrl: null,
      translationPriority: 1,
      synonymGroupId: `phrase:${slugify(phrase.translation)}`,
      ...collection,
      collectionRuleTagCodes: [],
      collectionKind: "alphabet",
      isManual: false,
      isExcluded: false
    });
  }

  return records;
}

/**
 * Разбирает целую строку вида «абажу́р м. абажур, лампалул шар.»
 * (для тестов и plaintext-источников).
 */
export function parseEntryLine(line: string): ImportWordRecord[] {
  const trimmed = stripStress(line).trim();
  if (!trimmed) {
    return [];
  }

  const match = trimmed.match(
    /^([А-ЯЁа-яёA-Za-zIӀӏ\u0400-\u04FF][А-ЯЁа-яёA-Za-zIӀӏ\u0400-\u04FF\-']*(?:\s+\d+)?)(?:\s*[.,])?\s+(.+)$/u
  );
  if (!match) {
    return [];
  }

  return parseEntry({ headword: match[1], body: match[2] });
}

export function stripStress(value: string): string {
  return value.normalize("NFD").replace(STRESS_MARK, "").normalize("NFC");
}

export function collectionLetter(translation: string): string {
  const ch = translation.trim().charAt(0).toUpperCase();
  return ALPHABET.includes(ch) ? ch : "?";
}

function collectionMeta(letter: string) {
  const idx = ALPHABET.indexOf(letter);
  const sortOrder = idx >= 0 ? idx + 101 : 200;
  return {
    collectionSlug: `slovar-1958-${letter.toLowerCase()}`,
    collectionTitle: letter,
    collectionDescription: `Русско-лакский школьный словарь 1958 г. Гаджиев Г.М., буква ${letter}`,
    collectionLevel: null as null,
    collectionIsPublic: true as const,
    collectionSortOrder: sortOrder
  };
}

function normalizeHeadword(raw: string): { translation: string; homonym: number | null } {
  let t = stripStress(raw).replace(/\s+/g, " ").trim();
  t = t.replace(/[.,;:]+$/g, "").trim();

  const homonymMatch = t.match(/^(.+?)\s+(\d+)\.?$/);
  if (homonymMatch) {
    return {
      translation: capitalizeRu(homonymMatch[1].trim()),
      homonym: Number.parseInt(homonymMatch[2], 10)
    };
  }

  return { translation: capitalizeRu(t), homonym: null };
}

function capitalizeRu(value: string): string {
  if (!value) {
    return value;
  }
  // Единый вид для synonym_group_id: «Коса» → «коса»
  return value.charAt(0).toLocaleLowerCase("ru-RU") + value.slice(1);
}

function normalizeBody(raw: string): string {
  return stripStress(raw)
    .replace(/[◆♦].*$/s, "")
    .replace(/\[\d+\]/g, "")
    .replace(/^\s*[.,;:]+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractGrammarPrefix(body: string): {
  rest: string;
  partOfSpeech: string | null;
  gender: WordGender | null;
  verbAspect: VerbAspect | null;
  notes: string | null;
} {
  let rest = body.trim();
  const tokens: string[] = [];

  // Снимаем ведущие токены грамматики, разделённые запятыми/пробелами
  for (let guard = 0; guard < 12; guard += 1) {
    rest = rest.replace(/^[,;\s]+/, "");
    const m = rest.match(GRAMMAR_TOKEN);
    if (!m) {
      break;
    }
    tokens.push(m[0].trim());
    rest = rest.slice(m[0].length);
  }

  rest = rest.replace(/^[,;\s]+/, "").trim();
  const joined = tokens.join(" ");

  return {
    rest,
    partOfSpeech: normalizePartOfSpeech(joined),
    gender: extractGender(joined),
    verbAspect: extractVerbAspect(joined),
    notes: extractNotes(joined, tokens)
  };
}

function extractGender(posRaw: string): WordGender | null {
  const s = ` ${posRaw.toLowerCase()} `;
  if (/\sср\.?\s/.test(s)) {
    return "ср";
  }
  if (/\sж\.?\s/.test(s)) {
    return "ж";
  }
  if (/\sм\.?\s/.test(s)) {
    return "м";
  }
  return null;
}

function extractVerbAspect(posRaw: string): VerbAspect | null {
  const s = posRaw.toLowerCase();
  if (s.includes("однокр")) {
    return "однокр.";
  }
  if (/сов\.?\s+и\s+несов/.test(s)) {
    return null;
  }
  // «сов., добавлять несов.» — учим по сов. форме (MVP)
  if (/сов\.?\s*,+\s*\S+\s+несов/.test(s)) {
    return "сов.";
  }
  if (/несов\.?\s*,+\s*\S+\s+сов/.test(s)) {
    return "несов.";
  }
  const ne = s.search(/несов/);
  const so = s.search(/(?:^|[^а-я])сов(?:\.|\s|,|$)/);
  if (ne >= 0 && (so < 0 || ne < so)) {
    return "несов.";
  }
  if (so >= 0) {
    return "сов.";
  }
  return null;
}

function extractNotes(posRaw: string, tokens: string[]): string | null {
  const s = posRaw.toLowerCase();
  const found: string[] = [];

  if (s.includes("устар")) {
    found.push("устар.");
  }
  if (s.includes("разг")) {
    found.push("разг.");
  }
  if (s.includes("собир")) {
    found.push("собир.");
  }
  if (s.includes("нескл")) {
    found.push("нескл.");
  }
  if (s.includes("ист")) {
    found.push("ист.");
  }
  if (/мн\.?\s*нет/.test(s)) {
    found.push("мн. нет");
  }
  if (/ед\.?\s*нет/.test(s)) {
    found.push("ед. нет");
  }
  if (/сов\.?\s+и\s+несов/.test(s)) {
    found.push("сов. и несов.");
  }

  // сов., добавлять несов. → тж. добавлять (несов.)
  for (const token of tokens) {
    const pair = token.match(/^сов\.?\s*,+\s*([а-яёА-ЯЁ\-]+)\s+несов\.?$/i);
    if (pair) {
      found.push(`тж. ${pair[1].toLowerCase()} (несов.)`);
    }
    const pair2 = token.match(/^несов\.?\s*,+\s*([а-яёА-ЯЁ\-]+)\s+сов\.?$/i);
    if (pair2) {
      found.push(`тж. ${pair2[1].toLowerCase()} (сов.)`);
    }
    const plural = token.match(/^мн\.\s+(.+)$/i);
    if (plural && !/нет/i.test(plural[1])) {
      found.push(`мн. ${plural[1].trim()}`);
    }
  }

  return found.length ? found.join(", ") : null;
}

function normalizePartOfSpeech(posRaw: string): string | null {
  if (!posRaw) {
    return null;
  }
  const s = posRaw.toLowerCase();
  if (s.includes("прил")) {
    return "Прил.";
  }
  if (s.includes("нареч")) {
    return "Нареч.";
  }
  if (s.includes("мест")) {
    return "Мест.";
  }
  if (s.includes("числ") && s.includes("порядк")) {
    return "Числ. порядк.";
  }
  if (s.includes("числ")) {
    return "Числ.";
  }
  if (s.includes("предлог") || s.includes("предл")) {
    return "Предл.";
  }
  if (s.includes("союз")) {
    return "Союз";
  }
  if (s.includes("межд")) {
    return "Межд.";
  }
  if (s.includes("вводн")) {
    return "Вводн. сл.";
  }
  if (s.includes("частица")) {
    return "Частица";
  }
  if (s.includes("однокр") || s.includes("несов") || s.includes("сов")) {
    return "Глаг.";
  }
  if (s.includes("сущ") || /(?:^|[\s,])[мж]\./.test(s) || /(?:^|[\s,])ср\./.test(s)) {
    return "Сущ.";
  }
  // Род без точки в конце токена («ж» после собир.)
  if (/(?:^|[\s,])(?:[мж]|ср)(?:\.|\s|$)/.test(s)) {
    return "Сущ.";
  }
  return null;
}

function splitSensesAndPhrases(body: string): {
  senses: string[];
  phrases: Array<{ translation: string; lemma: string }>;
} {
  const phrases: Array<{ translation: string; lemma: string }> = [];
  const senseParts: string[] = [];

  // Тире-разделители идиом (длинное и ASCII « - »)
  for (const segment of body.split(";")) {
    const dash = segment.match(/^(.*?)\s*(?:[—–−]|\s-\s)\s*(.+)$/u);
    if (dash) {
      const left = dash[1].trim();
      const rightRaw = dash[2].trim();
      // «ятIулсса. Красная строка — …» → lemma до точки, фраза после
      const lead = left.match(/^(.*?)\.\s+(.+)$/u);
      if (lead && lead[1].trim() && lead[2].trim()) {
        senseParts.push(lead[1].trim());
        const right = rightRaw.replace(/[.;]+$/g, "").trim();
        if (lead[2].trim().length >= 2 && right.length >= 2) {
          phrases.push({
            translation: cleanPhraseTranslation(lead[2]),
            lemma: cleanLakLemma(right.split(/[,;]/)[0] ?? right)
          });
        }
        continue;
      }

      const right = rightRaw.replace(/[.;]+$/g, "").trim();
      if (left.length >= 2 && right.length >= 2) {
        phrases.push({
          translation: cleanPhraseTranslation(left),
          lemma: cleanLakLemma(right.split(/[,;]/)[0] ?? right)
        });
        continue;
      }
    }
    if (segment.trim()) {
      senseParts.push(segment.trim());
    }
  }

  const cleaned = senseParts.join("; ").replace(/\s+/g, " ").replace(/^[,;\s]+|[,;\s]+$/g, "").trim();

  const numbered = [...cleaned.matchAll(/(\d+)\)\s*/g)];
  let senses: string[];

  if (numbered.length >= 1) {
    senses = [];
    // Текст до первого 1) — отдельный смысл, если есть короткое слово (адрес)
    const firstIdx = numbered[0].index ?? 0;
    const preamble = cleaned.slice(0, firstIdx).replace(/[;,\s]+$/g, "").trim();
    if (preamble) {
      senses.push(preamble);
    }
    for (let i = 0; i < numbered.length; i += 1) {
      const start = (numbered[i].index ?? 0) + numbered[i][0].length;
      const end = i + 1 < numbered.length ? (numbered[i + 1].index ?? cleaned.length) : cleaned.length;
      const chunk = cleaned.slice(start, end).replace(/[;,\s]+$/g, "").trim();
      if (chunk) {
        senses.push(chunk);
      }
    }
  } else {
    senses = cleaned ? [cleaned] : [];
  }

  // Если preamble + numbered: preamble часто «адрес», numbered — дефиниции.
  // Оставляем как есть; длинные отфильтрует extractLemmas.

  return {
    senses: senses.filter(Boolean),
    phrases: phrases.filter((p) => p.lemma.length >= 2 && p.translation.length >= 2)
  };
}

function cleanPhraseTranslation(raw: string): string {
  return stripStress(raw)
    .replace(/^\d+\)\s*/, "")
    .replace(/^\(|\)$/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.;]+$/g, "")
    .trim()
    .toLowerCase();
}

function normalizeLakSeparators(text: string): string {
  // OCR: «кьяркьи. гьагъ» → запятая между лакскими токенами
  return text.replace(
    /([А-ЯЁа-яёA-Za-zIӀӏ\u0400-\u04FF]{2,})\.\s+([А-ЯЁа-яёA-Za-zIӀӏ\u0400-\u04FF]{2,})/g,
    "$1, $2"
  );
}

function extractLemmas(senseText: string): { lemmas: string[]; definitionNotes: string | null } {
  const parenNotes: string[] = [];
  // Сначала вырезаем скобки целиком, чтобы запятые внутри не рвали lemma
  let prepared = senseText.replace(/\(([^)]*)\)/g, (_, inner: string) => {
    const cleaned = inner.trim();
    if (cleaned && !/^(?:м\.?\s*ц\.?|ц\.?)$/i.test(cleaned)) {
      parenNotes.push(cleaned);
    }
    return " ";
  });
  // Обрубок незакрытой скобки (OCR)
  prepared = prepared.replace(/\([^)]*$/g, (chunk) => {
    const inner = chunk.slice(1).trim();
    if (inner) {
      parenNotes.push(inner.replace(/[)]+$/g, "").trim());
    }
    return " ";
  });

  const parts = prepared
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter(Boolean);

  const lemmas: string[] = [];
  const defs: string[] = [...parenNotes];

  for (const part of parts) {
    const raw = cleanLakLemma(part);
    if (!raw) {
      continue;
    }
    if (isStopLemma(raw)) {
      continue;
    }

    if (isLongDefinition(raw)) {
      defs.push(raw);
      continue;
    }

    lemmas.push(raw);
  }

  return {
    lemmas,
    definitionNotes: defs.length ? defs.join("; ") : null
  };
}

function cleanLakLemma(raw: string): string {
  return stripStress(raw)
    .replace(/[«»""„‟]/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[,.;:]+|[,.;:]+$/g, "")
    .trim();
}

function isLongDefinition(lemma: string): boolean {
  const words = lemma.split(/\s+/).filter(Boolean);
  if (words.length > MAX_LEMMA_WORDS) {
    return true;
  }
  // Ровно 2 слова и очень длинные — чаще пояснение («чагъарданул конвертрай»)
  if (words.length === 2 && lemma.length >= MAX_LEMMA_CHARS_FOR_BIGRAM) {
    return true;
  }
  // 3–4 слова: учебная глосса (глагол/устойчивое) vs описательная дефиниция
  if (words.length >= 3) {
    return !looksLikeLakGlossPhrase(lemma);
  }
  return false;
}

/** Компактные многословные переводы из словаря, не развёрнутые пояснения. */
function looksLikeLakGlossPhrase(lemma: string): boolean {
  const lower = lemma.toLowerCase();
  // кьутI-кьутI и подобные редупликации
  if (/[IӀӏа-яё]{2,}[\-‑][IӀӏа-яё]{2,}/i.test(lemma)) {
    return true;
  }
  // типичные финали лакских глаголов/форм в глоссах 1958
  if (
    /(?:тIун|буллан|бан|дан|хьун|хъанан|ришлан|рищун|дичин|лаган|уккан|дуккан|учин|байбишин|ан|ун|ин|лан|шан|чIин)$/i.test(
      lower
    )
  ) {
    return true;
  }
  return false;
}

function isStopLemma(w: string): boolean {
  const lower = w.toLowerCase().trim();
  if (LEMMA_STOPWORDS.has(lower)) {
    return true;
  }
  if (/^[а-яё]{1,2}\.?$/i.test(lower)) {
    return true;
  }
  if (/^[—–−-]/.test(w)) {
    return true;
  }
  if (!/[А-ЯЁа-яёA-Za-zIӀӏ\u0400-\u04FF]/.test(w)) {
    return true;
  }
  return false;
}

function buildGroupId(
  translation: string,
  homonym: number | null,
  senseNum: number | null,
  senseCount: number
): string {
  const base = translation.toLowerCase().trim();
  if (homonym != null && senseCount <= 1) {
    return `${base}#${homonym}`;
  }
  if (homonym != null && senseNum != null) {
    return `${base}#${homonym}.${senseNum}`;
  }
  if (senseCount > 1 && senseNum != null) {
    return `${base}#${senseNum}`;
  }
  return base;
}

function mergeNotes(parts: Array<string | null | undefined>): string | null {
  const uniq: string[] = [];
  for (const part of parts) {
    if (!part) {
      continue;
    }
    for (const chunk of part.split(",").map((s) => s.trim()).filter(Boolean)) {
      if (!uniq.includes(chunk)) {
        uniq.push(chunk);
      }
    }
  }
  return uniq.length ? uniq.join(", ") : null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}\-]+/gu, "")
    .slice(0, 80);
}
