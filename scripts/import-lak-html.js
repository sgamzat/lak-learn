import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';
import cheerio from 'cheerio';

dotenv.config();

const { Pool } = pg;

const SOURCE = 'digiev_html';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const HTML_PATH = path.join(rootDir, 'lak_words.html');

const pool = new Pool({
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    database: process.env.PGDATABASE || 'lak_learn'
});

function cleanText(value) {
    return String(value ?? '')
        .replace(/\u00A0/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim();
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

function collectUntilNextAnchor($, startNode) {
    const chunks = [];
    let node = startNode?.next;

    while (node) {
        const isAnchor = node.type === 'tag'
            && node.name === 'a'
            && /^glava\d+$/.test($(node).attr('name') || '');

        if (isAnchor) {
            break;
        }

        chunks.push($.html(node));
        node = node.next;
    }

    return chunks.join('\n');
}

function parseAlphabet($) {
    const letters = [];
    const header = $('h4').filter((_, el) => cleanText($(el).text()) === 'Лакский алфавит').first();
    if (!header.length) {
        return letters;
    }

    const table = header.nextAll('div').first().find('table').first();
    if (!table.length) {
        return letters;
    }

    let orderIndex = 1;
    table.find('tr').each((rowIndex, tr) => {
        $(tr).find('td').each((colIndex, td) => {
            const pairText = cleanText($(td).text());
            if (!pairText) return;

            const parts = pairText.split(/\s+/).filter(Boolean);
            const letterUpper = parts[0] || '';
            const letterLower = parts[1] || letterUpper.toLowerCase();

            letters.push({
                source: SOURCE,
                order_index: orderIndex++,
                row_index: rowIndex + 1,
                col_index: colIndex + 1,
                pair_text: pairText,
                letter_upper: letterUpper,
                letter_lower: letterLower
            });
        });
    });

    return letters;
}

function parseSections($) {
    const sections = [];

    $('a[name^="glava"]').each((_, anchor) => {
        const sourceSection = $(anchor).attr('name');
        const sectionNumber = parseSectionNumber(sourceSection);
        if (sectionNumber === null || sectionNumber === 0) {
            return;
        }

        const sectionType = sectionNumber <= 90 ? 'phrasebook' : 'dictionary';
        const chunkHtml = collectUntilNextAnchor($, anchor);
        const $$ = cheerio.load(chunkHtml);

        let titleRu = '';
        let titleLak = '';

        if (sectionType === 'phrasebook') {
            const ths = $$('table').first().find('tr').first().find('th');
            titleRu = cleanText($$(ths.get(0)).text()) || `Раздел ${sourceSection}`;
            titleLak = cleanText($$(ths.get(1)).text());
        } else {
            titleRu = cleanText($$('h4').first().text()) || `Словарь ${sourceSection}`;
            titleLak = cleanText($$('h3').first().text());
        }

        const rows = [];
        let orderIndex = 1;

        $$('tr').each((__, tr) => {
            const tds = $$(tr).find('td');
            if (tds.length < 2) return;

            const ru = cleanText($$(tds.get(0)).text());
            const lak = cleanText($$(tds.get(1)).text());
            if (!ru || !lak) return;

            rows.push({
                source: SOURCE,
                source_section: sourceSection,
                order_index: orderIndex++,
                ru,
                lak,
                normalized_key: normalizedKey(ru, lak)
            });
        });

        if (rows.length === 0) {
            return;
        }

        sections.push({
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

async function importData() {
    const html = await fs.readFile(HTML_PATH, 'utf8');
    const $ = cheerio.load(html);

    const alphabetLetters = parseAlphabet($);
    const sections = parseSections($);

    const client = await pool.connect();
    try {
        await client.query('begin');

        await client.query('delete from public.phrasebook_entries where source = $1', [SOURCE]);
        await client.query('delete from public.phrasebook_sections where source = $1', [SOURCE]);
        await client.query('delete from public.alphabet_letters where source = $1', [SOURCE]);
        await client.query('delete from public.words where source = $1', [SOURCE]);

        for (const letter of alphabetLetters) {
            await client.query(
                `insert into public.alphabet_letters
                    (source, order_index, row_index, col_index, pair_text, letter_upper, letter_lower)
                 values ($1, $2, $3, $4, $5, $6, $7)
                 on conflict (source, order_index) do update
                 set row_index = excluded.row_index,
                     col_index = excluded.col_index,
                     pair_text = excluded.pair_text,
                     letter_upper = excluded.letter_upper,
                     letter_lower = excluded.letter_lower,
                     updated_at = now()`,
                [
                    letter.source,
                    letter.order_index,
                    letter.row_index,
                    letter.col_index,
                    letter.pair_text,
                    letter.letter_upper,
                    letter.letter_lower
                ]
            );
        }

        const seenWords = new Set();
        let insertedSections = 0;
        let insertedEntries = 0;
        let insertedWords = 0;

        for (const section of sections) {
            const sectionInsert = await client.query(
                `insert into public.phrasebook_sections
                    (source, source_section, title_ru, title_lak, section_type, order_index)
                 values ($1, $2, $3, $4, $5, $6)
                 on conflict (source, source_section) do update
                 set title_ru = excluded.title_ru,
                     title_lak = excluded.title_lak,
                     section_type = excluded.section_type,
                     order_index = excluded.order_index,
                     updated_at = now()
                 returning id`,
                [
                    section.source,
                    section.source_section,
                    section.title_ru,
                    section.title_lak,
                    section.section_type,
                    section.order_index
                ]
            );

            insertedSections += 1;
            const sectionId = sectionInsert.rows[0].id;

            for (const row of section.rows) {
                await client.query(
                    `insert into public.phrasebook_entries
                        (section_id, source, source_section, order_index, ru, lak, normalized_key)
                     values ($1, $2, $3, $4, $5, $6, $7)
                     on conflict (section_id, order_index) do update
                     set ru = excluded.ru,
                         lak = excluded.lak,
                         normalized_key = excluded.normalized_key,
                         updated_at = now()`,
                    [
                        sectionId,
                        row.source,
                        row.source_section,
                        row.order_index,
                        row.ru,
                        row.lak,
                        row.normalized_key
                    ]
                );

                insertedEntries += 1;

                const dedupeKey = `${row.normalized_key}|${section.source_section}`;
                if (!seenWords.has(dedupeKey)) {
                    seenWords.add(dedupeKey);
                    await client.query(
                        `insert into public.words
                            (lak, ru, transcription, category, example, source, source_section, order_index, normalized_key)
                         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                        [
                            row.lak,
                            row.ru,
                            '',
                            section.title_ru,
                            '',
                            SOURCE,
                            section.source_section,
                            row.order_index,
                            row.normalized_key
                        ]
                    );
                    insertedWords += 1;
                }
            }
        }

        await client.query('commit');

        console.log('Импорт завершён успешно');
        console.log(`Алфавит: ${alphabetLetters.length}`);
        console.log(`Разделы: ${insertedSections}`);
        console.log(`Фразы/словарные пары: ${insertedEntries}`);
        console.log(`Записей в words: ${insertedWords}`);
    } catch (error) {
        await client.query('rollback');
        console.error('Ошибка импорта:', error);
        process.exitCode = 1;
    } finally {
        client.release();
    }
}

importData()
    .catch((error) => {
        console.error('Критическая ошибка:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });

