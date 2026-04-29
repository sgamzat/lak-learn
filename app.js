/* ============================================
   LAKSKY LANGUAGE LEARNING APP
   Vanilla JavaScript (ES6+) + REST API
   ============================================ */

const API_BASE_URL = window.APP_CONFIG?.apiBaseUrl || '/api';
const ACCESS_TOKEN_KEY = 'lak_learn_access_token';

const ApiClient = {
    getToken() {
        return localStorage.getItem(ACCESS_TOKEN_KEY);
    },

    setToken(token) {
        if (!token) {
            localStorage.removeItem(ACCESS_TOKEN_KEY);
            return;
        }
        localStorage.setItem(ACCESS_TOKEN_KEY, token);
    },

    async request(path, options = {}) {
        const token = this.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}${path}`, {
            ...options,
            headers
        });

        let payload = null;
        try {
            payload = await response.json();
        } catch (_err) {
            payload = null;
        }

        if (!response.ok) {
            throw new Error(payload?.error || `HTTP ${response.status}`);
        }

        return payload;
    }
};

// ============================================
// USER AUTHENTICATION (JWT + API)
// ============================================

const AuthSystem = {
    currentUser: null,

    async register(username, email, password) {
        if (!username || username.trim().length < 3) {
            return { success: false, error: 'Имя должно содержать минимум 3 символа' };
        }
        if (!email || !email.includes('@')) {
            return { success: false, error: 'Введите корректный email' };
        }
        if (!password || password.length < 6) {
            return { success: false, error: 'Пароль должен содержать минимум 6 символов' };
        }

        try {
            const result = await ApiClient.request('/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    username: username.trim(),
                    email: email.trim(),
                    password
                })
            });
            ApiClient.setToken(result.token);

            this.currentUser = {
                id: result.user.id,
                email: result.user.email,
                username: result.user.username || username.trim(),
                isAdmin: Boolean(result.user.is_admin)
            };

            return { success: true, user: this.currentUser };
        } catch (e) {
            return { success: false, error: `Сетевая ошибка регистрации: ${e?.message || 'неизвестно'}` };
        }
    },

    async login(email, password) {
        if (!email || !password) {
            return { success: false, error: 'Введите email и пароль' };
        }

        try {
            const result = await ApiClient.request('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email: email.trim(), password })
            });
            ApiClient.setToken(result.token);

            this.currentUser = {
                id: result.user.id,
                email: result.user.email,
                username: result.user.username || 'Пользователь',
                isAdmin: Boolean(result.user.is_admin)
            };

            return { success: true, user: this.currentUser };
        } catch (e) {
            return { success: false, error: `Сетевая ошибка входа: ${e?.message || 'неизвестно'}` };
        }
    },

    async logout() {
        ApiClient.setToken(null);
        this.currentUser = null;
    },

    isLoggedIn() {
        return this.currentUser !== null;
    },

    async restoreSession() {
        if (!ApiClient.getToken()) {
            return false;
        }

        try {
            const result = await ApiClient.request('/auth/me');
            const user = result.user;
            this.currentUser = {
                id: user.id,
                email: user.email,
                username: user.username || 'Пользователь',
                isAdmin: Boolean(user.is_admin)
            };
            return true;
        } catch (_e) {
            ApiClient.setToken(null);
            this.currentUser = null;
            return false;
        }
    }
};

// ============================================
// DATA LOADING
// ============================================

let DEFAULT_DICTIONARY = [];
let DEFAULT_ALPHABET = [];
let DEFAULT_PHRASEBOOK_SECTIONS = [];
let DEFAULT_PHRASEBOOK_ENTRIES = [];
let DEFAULT_READING_NOTES = { notes: [], pronunciation_rules: [] };

function normalizeWord(item, index = 0) {
    return {
        id: Number(item.id ?? index + 1),
        lak: String(item.lak ?? '').trim(),
        ru: String(item.ru ?? '').trim(),
        transcription: String(item.transcription ?? '').trim(),
        category: String(item.category ?? 'Без категории').trim(),
        example: String(item.example ?? '').trim()
    };
}

function normalizeAlphabetLetter(item, index = 0) {
    return {
        id: Number(item.id ?? index + 1),
        order_index: Number(item.order_index ?? index + 1),
        row_index: Number(item.row_index ?? 0),
        col_index: Number(item.col_index ?? 0),
        pair_text: String(item.pair_text ?? '').trim(),
        letter_upper: String(item.letter_upper ?? '').trim(),
        letter_lower: String(item.letter_lower ?? '').trim()
    };
}

function normalizePhraseSection(item, index = 0) {
    return {
        id: Number(item.id ?? index + 1),
        source_section: String(item.source_section ?? '').trim(),
        title_ru: String(item.title_ru ?? '').trim(),
        title_lak: String(item.title_lak ?? '').trim(),
        section_type: String(item.section_type ?? '').trim(),
        order_index: Number(item.order_index ?? index + 1)
    };
}

function normalizePhraseEntry(item, index = 0) {
    return {
        id: Number(item.id ?? index + 1),
        section_id: Number(item.section_id ?? 0),
        source_section: String(item.source_section ?? '').trim(),
        section_title_ru: String(item.section_title_ru ?? '').trim(),
        section_type: String(item.section_type ?? '').trim(),
        order_index: Number(item.order_index ?? index + 1),
        ru: String(item.ru ?? '').trim(),
        lak: String(item.lak ?? '').trim()
    };
}

async function loadSeedJson(fileName, fallback) {
    try {
        const response = await fetch(`data/seed/${fileName}`);
        if (!response.ok) {
            return fallback;
        }
        return await response.json();
    } catch (_e) {
        return fallback;
    }
}

async function loadDictionaryFromFile() {
    const response = await fetch('data/words.json');
    if (!response.ok) {
        throw new Error('Не удалось загрузить data/words.json');
    }

    const json = await response.json();
    if (!Array.isArray(json)) {
        throw new Error('Некорректный формат words.json');
    }

    return json.map((item, idx) => normalizeWord(item, idx));
}

async function loadDictionaryFromApi() {
    const result = await ApiClient.request('/words');
    const data = result?.data;

    if (!Array.isArray(data)) {
        return [];
    }

    return data.map((item, idx) => normalizeWord(item, idx));
}

async function loadDictionary() {
    try {
        const words = await loadDictionaryFromApi();
        if (words.length > 0) {
            DEFAULT_DICTIONARY = words;
            return words;
        }

        console.warn('Таблица words пуста, используем data/words.json');
        DEFAULT_DICTIONARY = await loadDictionaryFromFile();
        return DEFAULT_DICTIONARY;
    } catch (error) {
        console.error('Ошибка загрузки словаря из API:', error);
        try {
            DEFAULT_DICTIONARY = await loadDictionaryFromFile();
            return DEFAULT_DICTIONARY;
        } catch (fileError) {
            console.error('Ошибка fallback загрузки words.json:', fileError);
            DEFAULT_DICTIONARY = [];
            return [];
        }
    }
}

async function loadAlphabet() {
    try {
        const result = await ApiClient.request('/alphabet');
        const data = Array.isArray(result?.data) ? result.data : [];
        if (data.length > 0) {
            DEFAULT_ALPHABET = data.map((item, idx) => normalizeAlphabetLetter(item, idx));
            return DEFAULT_ALPHABET;
        }
    } catch (_e) {
        // fallback below
    }

    const fallback = await loadSeedJson('alphabet.json', []);
    DEFAULT_ALPHABET = Array.isArray(fallback)
        ? fallback.map((item, idx) => normalizeAlphabetLetter(item, idx))
        : [];
    return DEFAULT_ALPHABET;
}

async function loadPhrasebookSections() {
    try {
        const result = await ApiClient.request('/phrasebook/sections');
        const data = Array.isArray(result?.data) ? result.data : [];
        if (data.length > 0) {
            DEFAULT_PHRASEBOOK_SECTIONS = data.map((item, idx) => normalizePhraseSection(item, idx));
            return DEFAULT_PHRASEBOOK_SECTIONS;
        }
    } catch (_e) {
        // fallback below
    }

    const fallback = await loadSeedJson('phrasebook_sections.json', []);
    DEFAULT_PHRASEBOOK_SECTIONS = Array.isArray(fallback)
        ? fallback.map((item, idx) => normalizePhraseSection(item, idx))
        : [];
    return DEFAULT_PHRASEBOOK_SECTIONS;
}

async function loadPhrasebookEntries() {
    try {
        const result = await ApiClient.request('/phrasebook/entries');
        const data = Array.isArray(result?.data) ? result.data : [];
        if (data.length > 0) {
            DEFAULT_PHRASEBOOK_ENTRIES = data.map((item, idx) => normalizePhraseEntry(item, idx));
            return DEFAULT_PHRASEBOOK_ENTRIES;
        }
    } catch (_e) {
        // fallback below
    }

    const fallback = await loadSeedJson('phrasebook_entries.json', []);
    DEFAULT_PHRASEBOOK_ENTRIES = Array.isArray(fallback)
        ? fallback.map((item, idx) => normalizePhraseEntry(item, idx))
        : [];
    return DEFAULT_PHRASEBOOK_ENTRIES;
}

async function loadReadingNotes() {
    try {
        const result = await ApiClient.request('/reading-notes');
        const data = result?.data;
        if (data && Array.isArray(data.notes) && Array.isArray(data.pronunciation_rules)) {
            DEFAULT_READING_NOTES = data;
            return DEFAULT_READING_NOTES;
        }
    } catch (_e) {
        // fallback below
    }

    const fallback = await loadSeedJson('reading_notes.json', { notes: [], pronunciation_rules: [] });
    DEFAULT_READING_NOTES = {
        notes: Array.isArray(fallback?.notes) ? fallback.notes : [],
        pronunciation_rules: Array.isArray(fallback?.pronunciation_rules) ? fallback.pronunciation_rules : []
    };
    return DEFAULT_READING_NOTES;
}

async function loadSupplementaryData() {
    await Promise.all([
        loadAlphabet(),
        loadPhrasebookSections(),
        loadPhrasebookEntries(),
        loadReadingNotes()
    ]);
}

// ============================================
// STATE MANAGEMENT
// ============================================

const AppState = {
    dictionary: [],
    alphabet: [],
    phrasebookSections: [],
    phrasebookEntries: [],
    readingNotes: { notes: [], pronunciation_rules: [] },
    learnedWords: [],
    quizScore: { correct: 0, wrong: 0 },
    currentCardIndex: 0,
    theme: 'light',
    currentTab: 'cards'
};

function isCurrentUserAdmin() {
    return Boolean(AuthSystem.currentUser?.isAdmin);
}

function getDefaultProgress() {
    return {
        dictionary: [],
        learned_words: [],
        quiz_correct: 0,
        quiz_wrong: 0,
        theme: 'light',
        current_card_index: 0
    };
}

// ============================================
// STORAGE HELPERS (API)
// ============================================

async function saveState() {
    if (!AuthSystem.isLoggedIn()) return;

    try {
        const payload = {
            learned_words: AppState.learnedWords,
            quiz_correct: AppState.quizScore.correct,
            quiz_wrong: AppState.quizScore.wrong,
            theme: AppState.theme,
            current_card_index: AppState.currentCardIndex
        };

        await ApiClient.request('/progress', {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
    } catch (e) {
        console.error('Ошибка сохранения прогресса в API:', e);
    }
}

async function loadState() {
    if (!AuthSystem.isLoggedIn()) return false;

    try {
        const result = await ApiClient.request('/progress');
        const progress = result?.data || getDefaultProgress();

        // Словарь всегда общий
        AppState.dictionary = [...DEFAULT_DICTIONARY];

        AppState.learnedWords = Array.isArray(progress.learned_words)
            ? progress.learned_words.map(Number).filter(Number.isFinite)
            : [];

        AppState.quizScore = {
            correct: Number(progress.quiz_correct || 0),
            wrong: Number(progress.quiz_wrong || 0)
        };

        AppState.theme = progress.theme === 'dark' ? 'dark' : 'light';

        const maxIndex = Math.max(0, AppState.dictionary.length - 1);
        const safeIndex = Number.isInteger(progress.current_card_index) ? progress.current_card_index : 0;
        AppState.currentCardIndex = Math.min(Math.max(safeIndex, 0), maxIndex);

        return true;
    } catch (e) {
        console.error('Ошибка загрузки прогресса из API:', e);

        AppState.dictionary = [...DEFAULT_DICTIONARY];
        AppState.learnedWords = [];
        AppState.quizScore = { correct: 0, wrong: 0 };
        AppState.theme = 'light';
        AppState.currentCardIndex = 0;

        return false;
    }
}

async function resetProgress() {
    AppState.learnedWords = [];
    AppState.quizScore = { correct: 0, wrong: 0 };
    AppState.currentCardIndex = 0;
    await saveState();
    updateProgressUI();
    updateQuizScoreUI();
    updateStats();
    renderCard();
}

async function resetDictionary() {
    await loadDictionary();
    AppState.dictionary = [...DEFAULT_DICTIONARY];
    AppState.currentCardIndex = 0;
    updateCategoryFilter();
    renderDictionary();
    updateProgressUI();
    updateStats();
    renderCard();
}

// ============================================
// THEME MANAGEMENT
// ============================================

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.querySelector('.theme-icon');
    if (icon) {
        icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
}

async function toggleTheme() {
    AppState.theme = AppState.theme === 'light' ? 'dark' : 'light';
    applyTheme(AppState.theme);
    await saveState();
}

// ============================================
// TAB NAVIGATION
// ============================================

function switchTab(tabId) {
    if (tabId === 'admin' && !isCurrentUserAdmin()) {
        showAuthError('Доступ к админ-панели только для администратора');
        return;
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });

    AppState.currentTab = tabId;

    switch (tabId) {
        case 'cards':
            renderCard();
            break;
        case 'quiz':
            initQuiz();
            break;
        case 'dictionary':
            renderDictionary();
            break;
        case 'alphabet':
            renderAlphabet();
            break;
        case 'phrasebook':
            renderPhrasebook();
            break;
        case 'notes':
            renderReadingNotes();
            break;
        case 'settings':
            updateStats();
            break;
        case 'admin':
            renderAdminWordsList();
            loadAdminUsers();
            break;
    }
}

// ============================================
// ADMIN PANEL
// ============================================

function updateAdminUI() {
    const adminTabBtn = document.getElementById('admin-tab-btn');
    if (!adminTabBtn) return;

    adminTabBtn.classList.toggle('hidden', !isCurrentUserAdmin());

    if (!isCurrentUserAdmin() && AppState.currentTab === 'admin') {
        switchTab('cards');
    }
}

function resetAdminWordForm() {
    const form = document.getElementById('admin-word-form');
    if (!form) return;

    form.reset();
    document.getElementById('admin-word-id').value = '';
    document.getElementById('admin-word-submit').textContent = '➕ Добавить слово';
}

function fillAdminWordForm(wordId) {
    const word = AppState.dictionary.find(w => Number(w.id) === Number(wordId));
    if (!word) return;

    document.getElementById('admin-word-id').value = String(word.id);
    document.getElementById('admin-lak').value = word.lak;
    document.getElementById('admin-ru').value = word.ru;
    document.getElementById('admin-transcription').value = word.transcription;
    document.getElementById('admin-category').value = word.category;
    document.getElementById('admin-example').value = word.example;
    document.getElementById('admin-word-submit').textContent = '💾 Сохранить изменения';
}

async function saveAdminWord(event) {
    event.preventDefault();

    if (!isCurrentUserAdmin()) {
        alert('Недостаточно прав для изменения словаря');
        return;
    }

    const idRaw = document.getElementById('admin-word-id').value;
    const payload = {
        lak: document.getElementById('admin-lak').value.trim(),
        ru: document.getElementById('admin-ru').value.trim(),
        transcription: document.getElementById('admin-transcription').value.trim(),
        category: document.getElementById('admin-category').value.trim(),
        example: document.getElementById('admin-example').value.trim()
    };

    if (!payload.lak || !payload.ru || !payload.transcription || !payload.category || !payload.example) {
        alert('Заполните все поля слова');
        return;
    }

    try {
        if (idRaw) {
            await ApiClient.request(`/words/${Number(idRaw)}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
        } else {
            await ApiClient.request('/words', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        }
    } catch (error) {
        console.error('Ошибка сохранения слова:', error);
        alert(`Не удалось сохранить слово: ${error.message}`);
        return;
    }

    await loadDictionary();
    AppState.dictionary = [...DEFAULT_DICTIONARY];
    updateCategoryFilter();
    renderDictionary();
    renderCard();
    updateStats();
    renderAdminWordsList();
    resetAdminWordForm();

    alert(idRaw ? 'Слово обновлено' : 'Слово добавлено');
}

function renderAdminWordsList() {
    const list = document.getElementById('admin-words-list');
    if (!list || !isCurrentUserAdmin()) return;

    const rows = [...AppState.dictionary]
        .sort((a, b) => Number(a.id) - Number(b.id))
        .map(word => `
            <div class="admin-item">
                <div class="admin-item-main">
                    <strong>${escapeHtml(word.lak)}</strong> — ${escapeHtml(word.ru)}
                    <div class="admin-item-meta">${escapeHtml(word.transcription)} · ${escapeHtml(word.category)}</div>
                </div>
                <div class="admin-item-actions">
                    <button class="btn btn-secondary admin-edit-btn" data-word-id="${word.id}">✏️ Редактировать</button>
                </div>
            </div>
        `)
        .join('');

    list.innerHTML = rows || '<p class="info-text">Словарь пуст</p>';

    list.querySelectorAll('.admin-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => fillAdminWordForm(btn.dataset.wordId));
    });
}

async function loadAdminUsers() {
    const list = document.getElementById('admin-users-list');
    if (!list || !isCurrentUserAdmin()) return;

    list.innerHTML = '<p class="info-text">Загрузка пользователей...</p>';

    let data = [];
    try {
        const result = await ApiClient.request('/admin/users');
        data = Array.isArray(result?.data) ? result.data : [];
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        list.innerHTML = `<p class="info-text">Ошибка загрузки пользователей: ${escapeHtml(error.message)}</p>`;
        return;
    }

    if (!Array.isArray(data) || data.length === 0) {
        list.innerHTML = '<p class="info-text">Пользователи не найдены</p>';
        return;
    }

    const rows = data
        .map(user => `
            <div class="admin-item">
                <div class="admin-item-main">
                    <strong>${escapeHtml(user.username || 'Пользователь')}</strong>
                    <div class="admin-item-meta">${escapeHtml(user.email || 'без email')} · ${escapeHtml(String(user.created_at || ''))}</div>
                </div>
            </div>
        `)
        .join('');

    list.innerHTML = rows;
}

// ============================================
// PROGRESS TRACKING
// ============================================

async function markAsLearned() {
    const currentWord = AppState.dictionary[AppState.currentCardIndex];
    if (currentWord && !AppState.learnedWords.includes(currentWord.id)) {
        AppState.learnedWords.push(currentWord.id);
        await saveState();
        updateProgressUI();

        const btn = document.getElementById('mark-learned');
        btn.classList.add('pulse');
        setTimeout(() => btn.classList.remove('pulse'), 300);
    }

    moveToNextCard();
}

function updateProgressUI() {
    const total = AppState.dictionary.length;
    const learned = AppState.learnedWords.length;
    const percentage = total > 0 ? (learned / total) * 100 : 0;

    document.getElementById('progress-text').textContent = `${learned}/${total}`;
    document.getElementById('progress-fill').style.width = `${percentage}%`;
}

function updateStats() {
    const categories = new Set(AppState.dictionary.map(w => w.category));

    document.getElementById('stat-total').textContent = AppState.dictionary.length;
    document.getElementById('stat-learned').textContent = AppState.learnedWords.length;
    document.getElementById('stat-categories').textContent = categories.size;
}

// ============================================
// FLASHCARD MODE
// ============================================

function renderCard() {
    if (AppState.dictionary.length === 0) {
        showEmptyState('card-word', 'Словарь пуст');
        return;
    }

    const safeIndex = Math.min(Math.max(AppState.currentCardIndex, 0), AppState.dictionary.length - 1);
    AppState.currentCardIndex = safeIndex;

    const word = AppState.dictionary[safeIndex];
    const card = document.getElementById('flashcard');

    card.classList.remove('flipped');

    setTimeout(() => {
        document.getElementById('card-word').textContent = word.lak;
        document.getElementById('card-translation').textContent = word.ru;
        document.getElementById('card-transcription').textContent = word.transcription;
        document.getElementById('card-example').textContent = word.example;

        const learnBtn = document.getElementById('mark-learned');
        learnBtn.disabled = AppState.learnedWords.includes(word.id);
    }, 120);

    updateNavigationButtons();
}

function moveToNextCard() {
    if (AppState.currentCardIndex < AppState.dictionary.length - 1) {
        AppState.currentCardIndex++;
    } else {
        AppState.currentCardIndex = 0;
    }
    renderCard();
    saveState();
}

function moveToPrevCard() {
    if (AppState.currentCardIndex > 0) {
        AppState.currentCardIndex--;
    } else {
        AppState.currentCardIndex = AppState.dictionary.length - 1;
    }
    renderCard();
    saveState();
}

function updateNavigationButtons() {
    document.getElementById('prev-card').disabled = AppState.dictionary.length <= 1;
    document.getElementById('next-card').disabled = AppState.dictionary.length <= 1;
}

function flipCard() {
    const card = document.getElementById('flashcard');
    card.classList.toggle('flipped');
}

// ============================================
// QUIZ MODE
// ============================================

let currentQuizQuestion = null;
let quizAnswered = false;

function initQuiz() {
    if (AppState.dictionary.length < 4) {
        showEmptyState('quiz-word', 'Нужно минимум 4 слова для теста');
        return;
    }
    generateQuizQuestion();
}

function generateQuizQuestion() {
    quizAnswered = false;
    document.getElementById('next-question').style.display = 'none';
    document.getElementById('quiz-feedback').className = 'quiz-feedback';
    document.getElementById('quiz-feedback').textContent = '';

    const randomIndex = Math.floor(Math.random() * AppState.dictionary.length);
    currentQuizQuestion = AppState.dictionary[randomIndex];

    const options = [currentQuizQuestion];
    const distractors = AppState.dictionary.filter(w => w.id !== currentQuizQuestion.id);

    shuffleArray(distractors);
    options.push(...distractors.slice(0, 3));
    shuffleArray(options);

    document.getElementById('quiz-word').textContent = currentQuizQuestion.lak;

    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = '';

    options.forEach(option => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option';
        btn.textContent = option.ru;
        btn.dataset.id = String(option.id);
        btn.addEventListener('click', () => handleQuizAnswer(option.id, btn));
        optionsContainer.appendChild(btn);
    });
}

function handleQuizAnswer(selectedId, btnElement) {
    if (quizAnswered) return;
    quizAnswered = true;

    const isCorrect = Number(selectedId) === Number(currentQuizQuestion.id);
    const feedback = document.getElementById('quiz-feedback');
    const allOptions = document.querySelectorAll('.quiz-option');

    allOptions.forEach(opt => opt.classList.add('disabled'));

    if (isCorrect) {
        btnElement.classList.add('correct');
        feedback.textContent = '✓ Правильно!';
        feedback.className = 'quiz-feedback correct';
        AppState.quizScore.correct++;
    } else {
        btnElement.classList.add('wrong', 'shake');
        feedback.textContent = `✗ Неправильно. Правильный ответ: ${currentQuizQuestion.ru}`;
        feedback.className = 'quiz-feedback wrong';
        AppState.quizScore.wrong++;

        allOptions.forEach(opt => {
            if (Number(opt.dataset.id) === Number(currentQuizQuestion.id)) {
                opt.classList.add('correct');
            }
        });
    }

    updateQuizScoreUI();
    saveState();
    document.getElementById('next-question').style.display = 'inline-flex';
}

function updateQuizScoreUI() {
    document.getElementById('score-correct').textContent = AppState.quizScore.correct;
    document.getElementById('score-wrong').textContent = AppState.quizScore.wrong;
}

// ============================================
// DICTIONARY MODE
// ============================================

function renderDictionary() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const categoryFilter = document.getElementById('category-filter').value;
    const listContainer = document.getElementById('dictionary-list');
    const emptyState = document.getElementById('empty-state');

    const filteredWords = AppState.dictionary
        .filter(word => {
            const matchesSearch = word.lak.toLowerCase().includes(searchTerm) || word.ru.toLowerCase().includes(searchTerm);
            const matchesCategory = !categoryFilter || word.category === categoryFilter;
            return matchesSearch && matchesCategory;
        })
        .sort((a, b) => {
            const aLearned = AppState.learnedWords.includes(a.id);
            const bLearned = AppState.learnedWords.includes(b.id);
            return Number(aLearned) - Number(bLearned);
        });

    if (filteredWords.length === 0) {
        listContainer.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    listContainer.style.display = 'flex';
    emptyState.style.display = 'none';

    listContainer.innerHTML = filteredWords
        .map(word => {
            const isLearned = AppState.learnedWords.includes(word.id);
            return `
                <div class="dict-item ${isLearned ? 'learned' : ''}">
                    <div class="dict-header">
                        <span class="dict-lak">${escapeHtml(word.lak)}</span>
                        <span class="dict-category">${escapeHtml(word.category)}</span>
                    </div>
                    <div class="dict-ru">${escapeHtml(word.ru)}</div>
                    <div class="dict-transcription">${escapeHtml(word.transcription)}</div>
                    <div class="dict-example">${escapeHtml(word.example)}</div>
                </div>
            `;
        })
        .join('');
}

function updateCategoryFilter() {
    const categories = [...new Set(AppState.dictionary.map(w => w.category))].sort();
    const select = document.getElementById('category-filter');

    select.innerHTML =
        '<option value="">Все категории</option>' +
        categories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('');
}

function renderAlphabet() {
    const container = document.getElementById('alphabet-table');
    if (!container) return;

    const letters = Array.isArray(AppState.alphabet) ? AppState.alphabet : [];
    if (letters.length === 0) {
        container.innerHTML = '<p class="info-text">Алфавит пока не загружен</p>';
        return;
    }

    container.innerHTML = letters
        .sort((a, b) => Number(a.order_index) - Number(b.order_index))
        .map(letter => `
            <div class="alphabet-cell">
                <div class="alphabet-main">${escapeHtml(letter.pair_text)}</div>
                <div class="alphabet-sub">${escapeHtml(letter.letter_upper)} · ${escapeHtml(letter.letter_lower)}</div>
            </div>
        `)
        .join('');
}

function updatePhrasebookSectionFilter() {
    const select = document.getElementById('phrasebook-section-filter');
    if (!select) return;

    const sections = [...AppState.phrasebookSections]
        .sort((a, b) => Number(a.order_index) - Number(b.order_index));

    select.innerHTML =
        '<option value="">Все разделы</option>' +
        sections.map(s => `<option value="${escapeHtml(s.source_section)}">${escapeHtml(s.title_ru)}</option>`).join('');
}

function renderPhrasebook() {
    const sectionFilter = document.getElementById('phrasebook-section-filter');
    const searchInput = document.getElementById('phrasebook-search');
    const listContainer = document.getElementById('phrasebook-list');
    const emptyState = document.getElementById('phrasebook-empty-state');

    if (!sectionFilter || !searchInput || !listContainer || !emptyState) return;

    const section = String(sectionFilter.value || '');
    const search = String(searchInput.value || '').toLowerCase();

    const filtered = AppState.phrasebookEntries
        .filter(item => !section || item.source_section === section)
        .filter(item => {
            if (!search) return true;
            return item.ru.toLowerCase().includes(search) || item.lak.toLowerCase().includes(search);
        });

    if (filtered.length === 0) {
        listContainer.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    listContainer.style.display = 'flex';
    emptyState.style.display = 'none';

    listContainer.innerHTML = filtered
        .map(item => `
            <div class="dict-item">
                <div class="dict-header">
                    <span class="dict-lak">${escapeHtml(item.lak)}</span>
                    <span class="dict-category">${escapeHtml(item.section_title_ru || item.source_section)}</span>
                </div>
                <div class="dict-ru">${escapeHtml(item.ru)}</div>
            </div>
        `)
        .join('');
}

function renderReadingNotes() {
    const notesList = document.getElementById('reading-notes-list');
    const rulesList = document.getElementById('pronunciation-rules-list');
    if (!notesList || !rulesList) return;

    const notes = Array.isArray(AppState.readingNotes?.notes) ? AppState.readingNotes.notes : [];
    const rules = Array.isArray(AppState.readingNotes?.pronunciation_rules)
        ? AppState.readingNotes.pronunciation_rules
        : [];

    notesList.innerHTML = notes.length > 0
        ? notes.map(note => `
            <div class="note-item">
                <h3>${escapeHtml(note.title || 'Заметка')}</h3>
                <p>${escapeHtml(note.text || '')}</p>
            </div>
        `).join('')
        : '<p class="info-text">Конспект пока не загружен</p>';

    rulesList.innerHTML = rules.length > 0
        ? rules.map(rule => `
            <div class="note-item rule-item">
                <h3>${escapeHtml(rule.symbol || '')}</h3>
                <p>${escapeHtml(rule.description || '')}</p>
            </div>
        `).join('')
        : '<p class="info-text">Правила произношения пока не загружены</p>';
}

// ============================================
// IMPORT/EXPORT
// ============================================

function exportDictionary() {
    const dataStr = JSON.stringify(AppState.dictionary, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `laksky-dictionary-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importDictionary() {
    alert('Словарь общий и хранится в PostgreSQL. Импорт выполняется через backend/БД или админ-панель приложения.');
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showEmptyState(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = message;
    }
}

function showAuthError(message, type = 'error') {
    const errorEl = document.getElementById('auth-error');
    if (!errorEl) return;

    errorEl.textContent = message;
    errorEl.style.display = 'block';
    errorEl.style.color = type === 'success' ? '#27ae60' : '';
    errorEl.style.borderColor = type === 'success' ? '#27ae60' : '';
    errorEl.style.background = type === 'success' ? 'rgba(39, 174, 96, 0.1)' : '';

    setTimeout(() => {
        errorEl.style.display = 'none';
        errorEl.style.color = '';
        errorEl.style.borderColor = '';
        errorEl.style.background = '';
    }, 5000);
}

function setAuthLoading(formId, isLoading) {
    const form = document.getElementById(formId);
    if (!form) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    if (!submitBtn) return;

    if (isLoading) {
        submitBtn.dataset.originalText = submitBtn.textContent;
        submitBtn.textContent = 'Подождите...';
        submitBtn.disabled = true;
    } else {
        submitBtn.textContent = submitBtn.dataset.originalText || submitBtn.textContent;
        submitBtn.disabled = false;
    }
}

function humanizeAuthError(message) {
    const msg = String(message || '').toLowerCase();

    if (msg.includes('email not confirmed') || msg.includes('email_not_confirmed')) {
        return 'Email не подтвержден. Перейдите по ссылке из письма и повторите вход.';
    }

    if (msg.includes('invalid login credentials')) {
        return 'Неверный email или пароль.';
    }

    if (msg.includes('email address') && msg.includes('invalid')) {
        return 'Некорректный email. Введите реальный почтовый адрес (например Gmail/Yandex).';
    }

    if (msg.includes('password should be at least')) {
        return 'Пароль слишком короткий. Минимум 6 символов.';
    }

    return message || 'Ошибка авторизации';
}

// ============================================
// APP INITIALIZATION
// ============================================

let appEventHandlersBound = false;

function bindAppHandlers() {
    if (appEventHandlersBound) return;

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    document.getElementById('theme-toggle').addEventListener('click', () => {
        toggleTheme();
    });

    document.getElementById('prev-card').addEventListener('click', moveToPrevCard);
    document.getElementById('next-card').addEventListener('click', moveToNextCard);
    document.getElementById('mark-learned').addEventListener('click', () => {
        markAsLearned();
    });
    document.getElementById('flashcard').addEventListener('click', flipCard);

    document.getElementById('next-question').addEventListener('click', generateQuizQuestion);

    document.getElementById('search-input').addEventListener('input', renderDictionary);
    document.getElementById('category-filter').addEventListener('change', renderDictionary);
    document.getElementById('phrasebook-section-filter')?.addEventListener('change', renderPhrasebook);
    document.getElementById('phrasebook-search')?.addEventListener('input', renderPhrasebook);

    document.getElementById('export-json').addEventListener('click', exportDictionary);
    document.getElementById('import-json').addEventListener('change', () => importDictionary());

    document.getElementById('reset-progress').addEventListener('click', async () => {
        if (confirm('Сбросить весь прогресс обучения?')) {
            await resetProgress();
            alert('Прогресс сброшен');
        }
    });

    document.getElementById('reset-dictionary').addEventListener('click', async () => {
        if (confirm('Перезагрузить словарь из PostgreSQL?')) {
            await resetDictionary();
            alert('Словарь перезагружен');
        }
    });

    document.getElementById('admin-word-form')?.addEventListener('submit', saveAdminWord);
    document.getElementById('admin-word-cancel')?.addEventListener('click', resetAdminWordForm);
    document.getElementById('admin-refresh-users')?.addEventListener('click', () => {
        loadAdminUsers();
    });

    appEventHandlersBound = true;
}

async function initApp() {
    await loadSupplementaryData();
    await loadState();

    AppState.alphabet = [...DEFAULT_ALPHABET];
    AppState.phrasebookSections = [...DEFAULT_PHRASEBOOK_SECTIONS];
    AppState.phrasebookEntries = [...DEFAULT_PHRASEBOOK_ENTRIES];
    AppState.readingNotes = {
        notes: [...(DEFAULT_READING_NOTES.notes || [])],
        pronunciation_rules: [...(DEFAULT_READING_NOTES.pronunciation_rules || [])]
    };

    applyTheme(AppState.theme);
    bindAppHandlers();

    // Общий словарь — запрет пользовательского импорта
    const importInput = document.getElementById('import-json');
    if (importInput) {
        importInput.disabled = true;
    }

    updateProgressUI();
    updateQuizScoreUI();
    updateCategoryFilter();
    updatePhrasebookSectionFilter();
    renderCard();
    renderDictionary();
    renderAlphabet();
    renderPhrasebook();
    renderReadingNotes();
    updateStats();
    updateAdminUI();
    renderAdminWordsList();

    if (isCurrentUserAdmin()) {
        await loadAdminUsers();
    }
}

// ============================================
// AUTH UI HANDLERS
// ============================================

function updateAuthUI() {
    const authSection = document.getElementById('auth-section');
    const mainApp = document.getElementById('main-app');
    const userInfo = document.getElementById('user-info');
    const authForms = document.getElementById('auth-forms');
    const currentUsername = document.getElementById('current-username');
    const headerUsername = document.getElementById('header-username');

    if (AuthSystem.isLoggedIn()) {
        authSection.style.display = 'none';
        mainApp.style.display = 'block';
        userInfo.style.display = 'block';
        authForms.style.display = 'none';

        if (currentUsername) currentUsername.textContent = AuthSystem.currentUser.username;
        if (headerUsername) {
            headerUsername.textContent = isCurrentUserAdmin()
                ? `${AuthSystem.currentUser.username} (admin)`
                : AuthSystem.currentUser.username;
        }
    } else {
        authSection.style.display = 'flex';
        mainApp.style.display = 'none';
        userInfo.style.display = 'none';
        authForms.style.display = 'block';
    }

    updateAdminUI();
}

function initAuthHandlers() {
    document.getElementById('show-register')?.addEventListener('click', e => {
        e.preventDefault();
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'block';
    });

    document.getElementById('show-login')?.addEventListener('click', e => {
        e.preventDefault();
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
    });

    document.getElementById('login-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        setAuthLoading('login-form', true);

        try {
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;

            const result = await AuthSystem.login(email, password);
            if (!result.success) {
                showAuthError(humanizeAuthError(result.error));
                return;
            }

            await loadDictionary();
            updateAuthUI();
            await initApp();
            switchTab('cards');
        } catch (err) {
            console.error('Unhandled login error:', err);
            showAuthError(`Ошибка входа: ${err?.message || 'неизвестно'}`);
        } finally {
            setAuthLoading('login-form', false);
        }
    });

    document.getElementById('register-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        setAuthLoading('register-form', true);

        try {
            const username = document.getElementById('register-username').value.trim();
            const email = document.getElementById('register-email').value.trim();
            const password = document.getElementById('register-password').value;

            const result = await AuthSystem.register(username, email, password);
            if (!result.success) {
                showAuthError(humanizeAuthError(result.error));
                return;
            }

            await loadDictionary();
            updateAuthUI();
            await initApp();
            switchTab('cards');
        } catch (err) {
            console.error('Unhandled register error:', err);
            showAuthError(`Ошибка регистрации: ${err?.message || 'неизвестно'}`);
        } finally {
            setAuthLoading('register-form', false);
        }
    });

    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await saveState();
        await AuthSystem.logout();
        updateAuthUI();
    });

    document.getElementById('header-logout-btn')?.addEventListener('click', async () => {
        await saveState();
        await AuthSystem.logout();
        updateAuthUI();
    });
}

// ============================================
// BOOTSTRAP
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    await AuthSystem.restoreSession();

    if (AuthSystem.isLoggedIn()) {
        await loadDictionary();
    }

    initAuthHandlers();
    updateAuthUI();

    if (AuthSystem.isLoggedIn()) {
        await initApp();
    }
});

window.addEventListener('error', (event) => {
    console.error('Global JS error:', event.error || event.message);
    showAuthError(`Ошибка JS: ${event.message || 'см. консоль'}`);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    const reasonText = typeof event.reason === 'string'
        ? event.reason
        : (event.reason?.message || 'неизвестная ошибка');
    showAuthError(`Ошибка async: ${reasonText}`);
});
