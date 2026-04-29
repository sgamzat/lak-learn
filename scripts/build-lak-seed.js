import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const SOURCE = 'digiev_html';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const HTML_PATH = path.join(rootDir, 'lak_words.html');
const OUT_DIR = path.join(rootDir, 'data', 'seed');
const SQL_PATH = path.join(rootDir, 'data', 'lak_seed.sql');

function cleanText(value) {
    return String(value ?? '')
        .replace(/\u00A0/g, ' ')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function decodeHtml(value) {
    return String(value ?? '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&#(\d+);/g, (_, code) => {
            const n = Number(code);
            return Number.isFinite(n) ? String.fromCharCode(n) : _;
        });
}

function stripTags(value) {
    return cleanText(decodeHtml(String(value ?? '').replace(/<[^>]+>/g, ' ')));
}

function escapeSql(text) {
    return String(text ?? '').replace(/'/g, "''");
}

function normalizedKey(ru, lak) {
    const normalizePart = (text) => cleanText(text)
        .toLowerCase()
        .replace(/[«»"'`.,:;!?()[\]{}]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    return `${normalizePart(ru)}|${normalizePart(lak)}`;
}

function parseSectionNumber(name) {
    const m = /^glava(\d+)$/.exec(String(name || ''));
    if (!m) return null;
    return Number(m[1]);
}

function collectSections(html) {
    const re = /<a\s+name="(glava\d+)"\s*><\/a>/gi;
    const anchors = [];
    let m;

    while ((m = re.exec(html)) !== null) {
        anchors.push({
            name: m[1],
            index: m.index,
            end: re.lastIndex
        });
    }

    const sections = [];
    for (let i = 0; i < anchors.length; i += 1) {
        const current = anchors[i];
        const next = anchors[i + 1];
        const chunk = html.slice(current.end, next ? next.index : html.length);
        sections.push({ name: current.name, html: chunk });
    }

    return sections;
}

function extractTagTexts(html, tag) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    const out = [];
    let m;
    while ((m = re.exec(html)) !== null) {
        out.push(stripTags(m[1]));
    }
    return out.filter(Boolean);
}

function parseAlphabet(html) {
    const letters = [];
    const blockMatch = /<h4[^>]*>\s*Лакский алфавит\s*<\/h4>[\s\S]*?<table[\s\S]*?<\/table>/i.exec(html);
    if (!blockMatch) return letters;

    const tableMatch = /<table[\s\S]*?<\/table>/i.exec(blockMatch[0]);
    if (!tableMatch) return letters;

    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;

    let orderIndex = 1;
    let rowIndex = 0;
    while ((rowMatch = rowRe.exec(tableMatch[0])) !== null) {
        rowIndex += 1;
        const tds = extractTagTexts(rowMatch[1], 'td');
        tds.forEach((pairText, colIdx) => {
            const parts = pairText.split(/\s+/).filter(Boolean);
            const letterUpper = parts[0] || '';
            const letterLower = parts[1] || letterUpper.toLowerCase();

            letters.push({
                id: orderIndex,
                source: SOURCE,
                order_index: orderIndex,
                row_index: rowIndex,
                col_index: colIdx + 1,
                pair_text: pairText,
                letter_upper: letterUpper,
                letter_lower: letterLower
            });
            orderIndex += 1;
        });
    }

    return letters;
}

function parseSections(html) {
    const sections = [];
    const rawSections = collectSections(html);

    rawSections.forEach((rawSection) => {
        const sourceSection = rawSection.name;
        const sectionNumber = parseSectionNumber(sourceSection);
        if (sectionNumber === null || sectionNumber === 0) return;

        const sectionType = sectionNumber <= 90 ? 'phrasebook' : 'dictionary';
        const chunkHtml = rawSection.html;

        let titleRu = '';
        let titleLak = '';

        if (sectionType === 'phrasebook') {
            const ths = extractTagTexts(chunkHtml, 'th');
            titleRu = ths[0] || `Раздел ${sourceSection}`;
            titleLak = ths[1] || '';
        } else {
            titleRu = extractTagTexts(chunkHtml, 'h4')[0] || `Словарь ${sourceSection}`;
            titleLak = extractTagTexts(chunkHtml, 'h3')[0] || '';
        }

        const rows = [];
        let orderIndex = 1;
        const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        let rowMatch;
        while ((rowMatch = rowRe.exec(chunkHtml)) !== null) {
            const tds = extractTagTexts(rowMatch[1], 'td');
            if (tds.length < 2) continue;

            const ru = tds[0];
            const lak = tds[1];
            if (!ru || !lak) continue;

            rows.push({
                source: SOURCE,
                source_section: sourceSection,
                order_index: orderIndex,
                ru,
                lak,
                normalized_key: normalizedKey(ru, lak)
            });

            orderIndex += 1;
        }

        if (rows.length === 0) return;

        sections.push({
            id: sections.length + 1,
            source: SOURCE,
            source_section: sourceSection,
            section_type: sectionType,
            order_index: sectionNumber,
            title_ru: titleRu,
            title_lak: titleLak,
            rows
        });
    });

    return sections;
}

function parseReadingNotes(html) {
    const sections = collectSections(html);
    const preface = sections.find((s) => s.name === 'glava00');
    if (!preface) return { notes: [], pronunciation_rules: [] };

    const chunkHtml = preface.html;

    const notes = [];
    let noteIndex = 1;
    const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let pMatch;
    while ((pMatch = pRe.exec(chunkHtml)) !== null) {
        const text = stripTags(pMatch[1]);
        if (!text) continue;
        if (text === '* * *') continue;
        notes.push({
            id: noteIndex,
            title: noteIndex <= 3 ? 'О языке' : (noteIndex <= 8 ? 'Как пользоваться разговорником' : 'Произношение'),
            text
        });
        noteIndex += 1;
    }

    const pronunciation_rules = [];
    let ruleIndex = 1;
    pRe.lastIndex = 0;
    while ((pMatch = pRe.exec(chunkHtml)) !== null) {
        const emMatch = /<em[^>]*>([\s\S]*?)<\/em>/i.exec(pMatch[1]);
        if (!emMatch) continue;

        const symbol = stripTags(emMatch[1]);
        const text = stripTags(pMatch[1]);
        if (!symbol || !text) continue;

        pronunciation_rules.push({
            id: ruleIndex,
            symbol,
            description: text
        });
        ruleIndex += 1;
    }

    return { notes, pronunciation_rules };
}

function buildDictionaryFromSections(sections) {
    const dictionary = [];
    let id = 1;

    for (const section of sections) {
        for (const row of section.rows) {
            dictionary.push({
                id,
                lak: row.lak,
                ru: row.ru,
                transcription: '',
                category: section.title_ru,
                example: '',
                source: SOURCE,
                source_section: section.source_section,
                order_index: row.order_index,
                normalized_key: row.normalized_key
            });
            id += 1;
        }
    }

    return dictionary;
}

function buildSql({ alphabet, sections, entries, dictionary, readingNotes }) {
    const lines = [];
    lines.push('-- Auto-generated from lak_words.html');
    lines.push('begin;');
    lines.push('');
    lines.push('-- reset target data');
    lines.push(`delete from public.phrasebook_entries where source = '${SOURCE}';`);
    lines.push(`delete from public.phrasebook_sections where source = '${SOURCE}';`);
    lines.push(`delete from public.alphabet_letters where source = '${SOURCE}';`);
    lines.push(`delete from public.reading_notes where source = '${SOURCE}';`);
    lines.push(`delete from public.words where source = '${SOURCE}';`);
    lines.push('');

    if (alphabet.length > 0) {
        lines.push('insert into public.alphabet_letters (source, order_index, row_index, col_index, pair_text, letter_upper, letter_lower) values');
        lines.push(alphabet.map((row) => `('${SOURCE}', ${row.order_index}, ${row.row_index}, ${row.col_index}, '${escapeSql(row.pair_text)}', '${escapeSql(row.letter_upper)}', '${escapeSql(row.letter_lower)}')`).join(',\n'));
        lines.push(';\n');
    }

    if (sections.length > 0) {
        lines.push('insert into public.phrasebook_sections (source, source_section, title_ru, title_lak, section_type, order_index) values');
        lines.push(sections.map((row) => `('${SOURCE}', '${escapeSql(row.source_section)}', '${escapeSql(row.title_ru)}', '${escapeSql(row.title_lak || '')}', '${escapeSql(row.section_type)}', ${row.order_index})`).join(',\n'));
        lines.push(';\n');
    }

    if (entries.length > 0) {
        lines.push('insert into public.phrasebook_entries (section_id, source, source_section, order_index, ru, lak, normalized_key)');
        lines.push('select s.id, v.source, v.source_section, v.order_index, v.ru, v.lak, v.normalized_key');
        lines.push('from (values');
        lines.push(entries.map((row) => `('${SOURCE}', '${escapeSql(row.source_section)}', ${row.order_index}, '${escapeSql(row.ru)}', '${escapeSql(row.lak)}', '${escapeSql(row.normalized_key)}')`).join(',\n'));
        lines.push(') as v(source, source_section, order_index, ru, lak, normalized_key)');
        lines.push('join public.phrasebook_sections s on s.source = v.source and s.source_section = v.source_section;\n');
    }

    if (dictionary.length > 0) {
        lines.push('insert into public.words (lak, ru, transcription, category, example, source, source_section, order_index, normalized_key) values');
        lines.push(dictionary.map((row) => `('${escapeSql(row.lak)}', '${escapeSql(row.ru)}', '', '${escapeSql(row.category)}', '', '${SOURCE}', '${escapeSql(row.source_section)}', ${row.order_index}, '${escapeSql(row.normalized_key)}')`).join(',\n'));
        lines.push(';\n');
    }

    if (readingNotes.notes.length > 0) {
        lines.push('insert into public.reading_notes (source, note_type, order_index, title, content) values');
        const noteValues = readingNotes.notes.map((row, idx) => `('${SOURCE}', 'note', ${idx + 1}, '${escapeSql(row.title)}', '${escapeSql(row.text)}')`);
        const ruleValues = readingNotes.pronunciation_rules.map((row, idx) => `('${SOURCE}', 'rule', ${idx + 1}, '${escapeSql(row.symbol)}', '${escapeSql(row.description)}')`);
        lines.push([...noteValues, ...ruleValues].join(',\n'));
        lines.push(';\n');
    }

    lines.push('commit;');
    lines.push('');
    return lines.join('\n');
}

async function writeJson(fileName, data) {
    const filePath = path.join(OUT_DIR, fileName);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function buildSeed() {
    const html = await fs.readFile(HTML_PATH, 'utf8');

    const alphabet = parseAlphabet(html);
    const sections = parseSections(html);
    const entries = sections.flatMap((section) =>
        section.rows.map((row) => ({
            section_id: section.id,
            section_type: section.section_type,
            section_title_ru: section.title_ru,
            ...row
        }))
    );
    const dictionary = buildDictionaryFromSections(sections);
    const readingNotes = parseReadingNotes(html);

    await fs.mkdir(OUT_DIR, { recursive: true });

    await writeJson('alphabet.json', alphabet);
    await writeJson('phrasebook_sections.json', sections.map(({ rows, ...rest }) => rest));
    await writeJson('phrasebook_entries.json', entries);
    await writeJson('dictionary.json', dictionary);
    await writeJson('reading_notes.json', readingNotes);
    await writeJson('manifest.json', {
        source: SOURCE,
        generated_at: new Date().toISOString(),
        counts: {
            alphabet: alphabet.length,
            sections: sections.length,
            entries: entries.length,
            dictionary: dictionary.length,
            reading_notes: readingNotes.notes.length,
            pronunciation_rules: readingNotes.pronunciation_rules.length
        }
    });

    const sql = buildSql({ alphabet, sections, entries, dictionary, readingNotes });
    await fs.writeFile(SQL_PATH, sql, 'utf8');

    console.log('Seed build complete');
    console.log(`alphabet: ${alphabet.length}`);
    console.log(`sections: ${sections.length}`);
    console.log(`entries: ${entries.length}`);
    console.log(`dictionary: ${dictionary.length}`);
    console.log(`reading_notes: ${readingNotes.notes.length}`);
    console.log(`pronunciation_rules: ${readingNotes.pronunciation_rules.length}`);
    console.log(`wrote: ${SQL_PATH}`);
    console.log(`wrote: ${OUT_DIR}`);
}

buildSeed().catch((error) => {
    console.error('Failed to build seed:', error);
    process.exitCode = 1;
});
