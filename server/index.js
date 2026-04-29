import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

import { pool, query } from './db.js';
import { signAccessToken, authRequired, adminRequired } from './auth.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const seedDir = path.join(rootDir, 'data', 'seed');

async function readSeedJson(fileName, fallback = null) {
    try {
        const fullPath = path.join(seedDir, fileName);
        const raw = await fs.readFile(fullPath, 'utf8');
        return JSON.parse(raw);
    } catch (_e) {
        return fallback;
    }
}

const corsOrigin = process.env.CORS_ORIGIN || '*';
const allowAllCors = corsOrigin === '*';
const allowedOrigins = corsOrigin
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        if (allowAllCors || !origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('CORS blocked'));
    }
}));
app.use(express.json());

app.get('/api/health', async (_req, res) => {
    try {
        await query('select 1');
        return res.json({ ok: true });
    } catch (e) {
        return res.status(500).json({ ok: false, error: e.message });
    }
});

app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body || {};

    if (!username || String(username).trim().length < 3) {
        return res.status(400).json({ error: 'Имя должно содержать минимум 3 символа' });
    }
    if (!email || !String(email).includes('@')) {
        return res.status(400).json({ error: 'Введите корректный email' });
    }
    if (!password || String(password).length < 6) {
        return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
    }

    try {
        const existing = await query('select id from public.users where email = $1', [String(email).trim().toLowerCase()]);
        if (existing.rowCount > 0) {
            return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
        }

        const passwordHash = await bcrypt.hash(String(password), 10);
        const created = await query(
            `insert into public.users (email, password_hash)
             values ($1, $2)
             returning id, email, created_at`,
            [String(email).trim().toLowerCase(), passwordHash]
        );

        const userId = created.rows[0].id;

        await query(
            `insert into public.profiles (id, username)
             values ($1, $2)
             on conflict (id) do nothing`,
            [userId, String(username).trim()]
        );

        await query(
            `insert into public.user_progress (user_id)
             values ($1)
             on conflict (user_id) do nothing`,
            [userId]
        );

        const profileRes = await query(
            `select p.id, p.username, p.is_admin, u.email
             from public.profiles p
             join public.users u on u.id = p.id
             where p.id = $1`,
            [userId]
        );

        const profile = profileRes.rows[0];
        const token = signAccessToken(profile);
        return res.status(201).json({ token, user: profile });
    } catch (e) {
        return res.status(500).json({ error: 'Ошибка регистрации', details: e.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({ error: 'Введите email и пароль' });
    }

    try {
        const result = await query(
            `select u.id, u.email, u.password_hash, p.username, p.is_admin
             from public.users u
             join public.profiles p on p.id = u.id
             where u.email = $1`,
            [String(email).trim().toLowerCase()]
        );

        if (result.rowCount === 0) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        const row = result.rows[0];
        const ok = await bcrypt.compare(String(password), row.password_hash);
        if (!ok) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        const user = {
            id: row.id,
            email: row.email,
            username: row.username,
            is_admin: row.is_admin
        };
        const token = signAccessToken(user);
        return res.json({ token, user });
    } catch (e) {
        return res.status(500).json({ error: 'Ошибка входа', details: e.message });
    }
});

app.get('/api/auth/me', authRequired, async (req, res) => {
    try {
        const result = await query(
            `select p.id, p.username, p.is_admin, u.email
             from public.profiles p
             join public.users u on u.id = p.id
             where p.id = $1`,
            [req.user.id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        return res.json({ user: result.rows[0] });
    } catch (e) {
        return res.status(500).json({ error: 'Ошибка загрузки профиля', details: e.message });
    }
});

app.get('/api/words', authRequired, async (_req, res) => {
    try {
        const result = await query(
            `select id, lak, ru, transcription, category, example
             from public.words
             order by id asc`
        );

        if (result.rowCount > 0) {
            return res.json({ data: result.rows });
        }

        const fallback = await readSeedJson('dictionary.json', []);
        return res.json({ data: Array.isArray(fallback) ? fallback : [] });
    } catch (e) {
        const fallback = await readSeedJson('dictionary.json', []);
        return res.json({ data: Array.isArray(fallback) ? fallback : [] });
    }
});

app.get('/api/alphabet', authRequired, async (_req, res) => {
    try {
        const result = await query(
            `select id, source, order_index, row_index, col_index, pair_text, letter_upper, letter_lower
             from public.alphabet_letters
             order by order_index asc`
        );

        if (result.rowCount > 0) {
            return res.json({ data: result.rows });
        }

        const fallback = await readSeedJson('alphabet.json', []);
        return res.json({ data: Array.isArray(fallback) ? fallback : [] });
    } catch (_e) {
        const fallback = await readSeedJson('alphabet.json', []);
        return res.json({ data: Array.isArray(fallback) ? fallback : [] });
    }
});

app.get('/api/phrasebook/sections', authRequired, async (_req, res) => {
    try {
        const result = await query(
            `select id, source, source_section, title_ru, title_lak, section_type, order_index
             from public.phrasebook_sections
             order by order_index asc`
        );

        if (result.rowCount > 0) {
            return res.json({ data: result.rows });
        }

        const fallback = await readSeedJson('phrasebook_sections.json', []);
        return res.json({ data: Array.isArray(fallback) ? fallback : [] });
    } catch (_e) {
        const fallback = await readSeedJson('phrasebook_sections.json', []);
        return res.json({ data: Array.isArray(fallback) ? fallback : [] });
    }
});

app.get('/api/phrasebook/entries', authRequired, async (req, res) => {
    const sourceSection = String(req.query.section || '').trim();

    try {
        if (sourceSection) {
            const result = await query(
                `select e.id, e.section_id, e.source, e.source_section, e.order_index, e.ru, e.lak, e.normalized_key,
                        s.title_ru as section_title_ru, s.title_lak as section_title_lak, s.section_type
                 from public.phrasebook_entries e
                 join public.phrasebook_sections s on s.id = e.section_id
                 where e.source_section = $1
                 order by e.order_index asc`,
                [sourceSection]
            );
            if (result.rowCount > 0) {
                return res.json({ data: result.rows });
            }
        } else {
            const result = await query(
                `select e.id, e.section_id, e.source, e.source_section, e.order_index, e.ru, e.lak, e.normalized_key,
                        s.title_ru as section_title_ru, s.title_lak as section_title_lak, s.section_type
                 from public.phrasebook_entries e
                 join public.phrasebook_sections s on s.id = e.section_id
                 order by s.order_index asc, e.order_index asc`
            );
            if (result.rowCount > 0) {
                return res.json({ data: result.rows });
            }
        }

        const fallback = await readSeedJson('phrasebook_entries.json', []);
        const fallbackRows = Array.isArray(fallback) ? fallback : [];
        const data = sourceSection
            ? fallbackRows.filter(item => String(item.source_section) === sourceSection)
            : fallbackRows;
        return res.json({ data });
    } catch (_e) {
        const fallback = await readSeedJson('phrasebook_entries.json', []);
        const fallbackRows = Array.isArray(fallback) ? fallback : [];
        const data = sourceSection
            ? fallbackRows.filter(item => String(item.source_section) === sourceSection)
            : fallbackRows;
        return res.json({ data });
    }
});

app.get('/api/reading-notes', authRequired, async (_req, res) => {
    try {
        const result = await query(
            `select id, source, note_type, order_index, title, content
             from public.reading_notes
             order by note_type asc, order_index asc`
        );

        if (result.rowCount > 0) {
            const notes = result.rows
                .filter(row => row.note_type === 'note')
                .map(row => ({ id: row.id, title: row.title, text: row.content }));
            const pronunciation_rules = result.rows
                .filter(row => row.note_type === 'rule')
                .map(row => ({ id: row.id, symbol: row.title, description: row.content }));
            return res.json({ data: { notes, pronunciation_rules } });
        }

        const fallback = await readSeedJson('reading_notes.json', { notes: [], pronunciation_rules: [] });
        return res.json({ data: fallback || { notes: [], pronunciation_rules: [] } });
    } catch (_e) {
        const fallback = await readSeedJson('reading_notes.json', { notes: [], pronunciation_rules: [] });
        return res.json({ data: fallback || { notes: [], pronunciation_rules: [] } });
    }
});

app.post('/api/words', authRequired, adminRequired, async (req, res) => {
    const { lak, ru, transcription, category, example } = req.body || {};
    if (!lak || !ru || !transcription || !category || !example) {
        return res.status(400).json({ error: 'Заполните все поля слова' });
    }

    try {
        const result = await query(
            `insert into public.words (lak, ru, transcription, category, example)
             values ($1, $2, $3, $4, $5)
             returning id, lak, ru, transcription, category, example`,
            [lak, ru, transcription, category, example]
        );
        return res.status(201).json({ data: result.rows[0] });
    } catch (e) {
        return res.status(500).json({ error: 'Ошибка сохранения слова', details: e.message });
    }
});

app.put('/api/words/:id', authRequired, adminRequired, async (req, res) => {
    const { id } = req.params;
    const { lak, ru, transcription, category, example } = req.body || {};
    if (!lak || !ru || !transcription || !category || !example) {
        return res.status(400).json({ error: 'Заполните все поля слова' });
    }

    try {
        const result = await query(
            `update public.words
             set lak = $1, ru = $2, transcription = $3, category = $4, example = $5
             where id = $6
             returning id, lak, ru, transcription, category, example`,
            [lak, ru, transcription, category, example, Number(id)]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Слово не найдено' });
        }

        return res.json({ data: result.rows[0] });
    } catch (e) {
        return res.status(500).json({ error: 'Ошибка обновления слова', details: e.message });
    }
});

app.get('/api/progress', authRequired, async (req, res) => {
    try {
        const result = await query(
            `select user_id, learned_words, quiz_correct, quiz_wrong, theme, current_card_index
             from public.user_progress
             where user_id = $1`,
            [req.user.id]
        );

        if (result.rowCount === 0) {
            return res.json({
                data: {
                    user_id: req.user.id,
                    learned_words: [],
                    quiz_correct: 0,
                    quiz_wrong: 0,
                    theme: 'light',
                    current_card_index: 0
                }
            });
        }

        return res.json({ data: result.rows[0] });
    } catch (e) {
        return res.status(500).json({ error: 'Ошибка загрузки прогресса', details: e.message });
    }
});

app.put('/api/progress', authRequired, async (req, res) => {
    const payload = req.body || {};

    try {
        const result = await query(
            `insert into public.user_progress (user_id, learned_words, quiz_correct, quiz_wrong, theme, current_card_index)
             values ($1, $2::bigint[], $3, $4, $5, $6)
             on conflict (user_id) do update
             set learned_words = excluded.learned_words,
                 quiz_correct = excluded.quiz_correct,
                 quiz_wrong = excluded.quiz_wrong,
                 theme = excluded.theme,
                 current_card_index = excluded.current_card_index,
                 updated_at = now()
             returning user_id, learned_words, quiz_correct, quiz_wrong, theme, current_card_index`,
            [
                req.user.id,
                Array.isArray(payload.learned_words) ? payload.learned_words : [],
                Number(payload.quiz_correct || 0),
                Number(payload.quiz_wrong || 0),
                payload.theme === 'dark' ? 'dark' : 'light',
                Number(payload.current_card_index || 0)
            ]
        );

        return res.json({ data: result.rows[0] });
    } catch (e) {
        return res.status(500).json({ error: 'Ошибка сохранения прогресса', details: e.message });
    }
});

app.get('/api/admin/users', authRequired, adminRequired, async (_req, res) => {
    try {
        const result = await query(
            `select p.id, p.username, u.email, p.created_at
             from public.profiles p
             left join public.users u on u.id = p.id
             order by p.created_at desc`
        );
        return res.json({ data: result.rows });
    } catch (e) {
        return res.status(500).json({ error: 'Ошибка загрузки пользователей', details: e.message });
    }
});

app.use(express.static(rootDir));

app.get('*', (_req, res) => {
    return res.sendFile(path.join(rootDir, 'index.html'));
});

const server = app.listen(PORT, () => {
    console.log(`API server started: http://localhost:${PORT}`);
});

async function shutdown() {
    server.close(async () => {
        await pool.end();
        process.exit(0);
    });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
