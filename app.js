/* ============================================
   LAKSKY LANGUAGE LEARNING APP
   Vanilla JavaScript (ES6+)
   ============================================ */

// ============================================
// USER AUTHENTICATION & PROGRESS MANAGEMENT
// ============================================

/**
 * Система управления пользователями
 * Данные хранятся в localStorage с префиксом userId
 */
const AuthSystem = {
    currentUser: null,
    
    /**
     * Регистрация нового пользователя
     * @param {string} username - имя пользователя
     * @returns {object} результат регистрации
     */
    register(username) {
        if (!username || username.trim().length < 3) {
            return { success: false, error: 'Имя должно содержать минимум 3 символа' };
        }
        
        const users = this.getAllUsers();
        if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
            return { success: false, error: 'Пользователь с таким именем уже существует' };
        }
        
        const newUser = {
            id: Date.now().toString(),
            username: username.trim(),
            createdAt: new Date().toISOString()
        };
        
        users.push(newUser);
        localStorage.setItem('lakskyApp_users', JSON.stringify(users));
        
        // Инициализация прогресса для нового пользователя
        this.initUserProgress(newUser.id);
        
        return { success: true, user: newUser };
    },
    
    /**
     * Вход пользователя
     * @param {string} username - имя пользователя
     * @returns {object} результат входа
     */
    login(username) {
        if (!username || username.trim().length === 0) {
            return { success: false, error: 'Введите имя пользователя' };
        }
        
        const users = this.getAllUsers();
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        
        if (!user) {
            return { success: false, error: 'Пользователь не найден' };
        }
        
        this.currentUser = user;
        localStorage.setItem('lakskyApp_currentUser', JSON.stringify(user));
        
        return { success: true, user: user };
    },
    
    /**
     * Выход из системы
     */
    logout() {
        this.currentUser = null;
        localStorage.removeItem('lakskyApp_currentUser');
    },
    
    /**
     * Проверка авторизации
     * @returns {boolean} авторизован ли пользователь
     */
    isLoggedIn() {
        return this.currentUser !== null;
    },
    
    /**
     * Получение всех пользователей
     * @returns {array} массив пользователей
     */
    getAllUsers() {
        const usersData = localStorage.getItem('lakskyApp_users');
        return usersData ? JSON.parse(usersData) : [];
    },
    
    /**
     * Инициализация прогресса пользователя
     * @param {string} userId - ID пользователя
     */
    initUserProgress(userId) {
        const progressData = {
            learnedWords: [],
            quizScore: { correct: 0, wrong: 0 },
            dictionary: []
        };
        localStorage.setItem(`lakskyApp_user_${userId}_progress`, JSON.stringify(progressData));
    },
    
    /**
     * Загрузка прогресса пользователя
     * @param {string} userId - ID пользователя
     * @returns {object} прогресс пользователя
     */
    loadUserProgress(userId) {
        const progressData = localStorage.getItem(`lakskyApp_user_${userId}_progress`);
        if (progressData) {
            return JSON.parse(progressData);
        }
        // Если прогресс не найден, инициализируем новый
        this.initUserProgress(userId);
        return this.loadUserProgress(userId);
    },
    
    /**
     * Сохранение прогресса пользователя
     * @param {string} userId - ID пользователя
     * @param {object} progress - данные прогресса
     */
    saveUserProgress(userId, progress) {
        localStorage.setItem(`lakskyApp_user_${userId}_progress`, JSON.stringify(progress));
    },
    
    /**
     * Восстановление сессии при загрузке страницы
     */
    restoreSession() {
        const currentUserData = localStorage.getItem('lakskyApp_currentUser');
        if (currentUserData) {
            this.currentUser = JSON.parse(currentUserData);
            return true;
        }
        return false;
    }
};

// ============================================
// DATA LOADING
// ============================================

/**
 * Словарь по умолчанию (используется как fallback)
 */
let DEFAULT_DICTIONARY = [];

/**
 * Загрузка словаря из JSON файла
 * @returns {Promise<Array>} массив слов
 */
async function loadDictionary() {
    try {
        const response = await fetch('data/words.json');
        if (!response.ok) {
            throw new Error('Не удалось загрузить words.json');
        }
        DEFAULT_DICTIONARY = await response.json();
        return DEFAULT_DICTIONARY;
    } catch (error) {
        console.error('Ошибка загрузки словаря:', error);
        // Fallback встроенные данные если файл не загружен
        DEFAULT_DICTIONARY = [
            { id: 1, lak: "Салам", ru: "Здравствуйте", transcription: "[салам]", category: "Приветствия", example: "Салам, кунна кул?" },
            { id: 2, lak: "Баркалла", ru: "Спасибо", transcription: "[баркалла]", category: "Приветствия", example: "Баркалла, зура тӏимамура!" },
            { id: 3, lak: "НахIуш", ru: "Пока / До свидания", transcription: "[нахӏуш]", category: "Приветствия", example: "НахIуш, дявуксса кӏанттай!" },
            { id: 4, lak: "Ва", ru: "Да", transcription: "[ва]", category: "Основные слова", example: "Ва, ттула нитти." },
            { id: 5, lak: "Я", ru: "Нет", transcription: "[я]", category: "Основные слова", example: "Я, ттущал бакъа." },
            { id: 6, lak: "Тту", ru: "Я", transcription: "[тту]", category: "Местоимения", example: "Тту лагма ялапар хъанахъиссар." },
            { id: 7, lak: "Ичӏал", ru: "Ты", transcription: "[ичӏал]", category: "Местоимения", example: "Ичӏал куна кул?" },
            { id: 8, lak: "Нитти", ru: "Мама", transcription: "[нитти]", category: "Семья", example: "Ттула нитти ххари буллуссар." },
            { id: 9, lak: "Бутта", ru: "Папа", transcription: "[бутта]", category: "Семья", example: "Ттула бутта зий ур заводрай." },
            { id: 10, lak: "Гьану", ru: "Дом", transcription: "[гьану]", category: "Дом", example: "Ттула гьану кӏулмур кӏанттур." }
        ];
        return DEFAULT_DICTIONARY;
    }
}

// ============================================
// STATE MANAGEMENT
// ============================================

/**
 * Основное состояние приложения
 * Все данные хранятся в localStorage для автономной работы
 */
const AppState = {
    dictionary: [],           // Словарь слов
    learnedWords: [],         // ID выученных слов
    quizScore: { correct: 0, wrong: 0 }, // Счёт в тесте
    currentCardIndex: 0,      // Текущая карточка
    theme: 'light',           // Тема оформления
    currentTab: 'cards'       // Активная вкладка
};

// ============================================
// USER-AWARE STORAGE HELPERS
// ============================================

/**
 * Сохранение состояния в localStorage с учётом пользователя
 */
function saveState() {
    if (!AuthSystem.isLoggedIn()) return;
    
    try {
        const progress = AuthSystem.loadUserProgress(AuthSystem.currentUser.id);
        progress.dictionary = AppState.dictionary;
        progress.learnedWords = AppState.learnedWords;
        progress.quizScore = AppState.quizScore;
        AuthSystem.saveUserProgress(AuthSystem.currentUser.id, progress);
        
        // Сохраняем тему глобально
        localStorage.setItem('lakskyApp_theme', AppState.theme);
    } catch (e) {
        console.error('Ошибка сохранения в localStorage:', e);
    }
}

/**
 * Загрузка состояния из localStorage для текущего пользователя
 * @returns {boolean} true если данные загружены, false если используются данные по умолчанию
 */
function loadState() {
    if (!AuthSystem.isLoggedIn()) return false;
    
    try {
        const userId = AuthSystem.currentUser.id;
        const progress = AuthSystem.loadUserProgress(userId);
        const themeData = localStorage.getItem('lakskyApp_theme');
        
        if (progress.dictionary && progress.dictionary.length > 0) {
            AppState.dictionary = progress.dictionary;
        } else {
            AppState.dictionary = [...DEFAULT_DICTIONARY];
        }
        
        if (progress.learnedWords) {
            AppState.learnedWords = progress.learnedWords;
        }
        
        if (progress.quizScore) {
            AppState.quizScore = progress.quizScore;
        }
        
        if (themeData) {
            AppState.theme = themeData;
        }
        
        return !!progress.dictionary && progress.dictionary.length > 0;
    } catch (e) {
        console.error('Ошибка загрузки из localStorage:', e);
        AppState.dictionary = [...DEFAULT_DICTIONARY];
        return false;
    }
}

/**
 * Сброс прогресса обучения
 */
function resetProgress() {
    AppState.learnedWords = [];
    AppState.quizScore = { correct: 0, wrong: 0 };
    saveState();
    updateProgressUI();
    updateQuizScoreUI();
}

/**
 * Сброс словаря к значениям по умолчанию
 */
function resetDictionary() {
    AppState.dictionary = [...DEFAULT_DICTIONARY];
    saveState();
    renderDictionary();
    updateStats();
    updateCategoryFilter();
}

// ============================================
// THEME MANAGEMENT
// ============================================

/**
 * Применение темы оформления
 */
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.querySelector('.theme-icon');
    if (icon) {
        icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
}

/**
 * Переключение темы
 */
function toggleTheme() {
    AppState.theme = AppState.theme === 'light' ? 'dark' : 'light';
    applyTheme(AppState.theme);
    saveState();
}

// ============================================
// TAB NAVIGATION
// ============================================

/**
 * Переключение между вкладками
 * @param {string} tabId - ID вкладки
 */
function switchTab(tabId) {
    // Обновляем кнопки вкладок
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Обновляем содержимое вкладок
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });

    AppState.currentTab = tabId;

    // Инициализация конкретной вкладки
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
        case 'settings':
            updateStats();
            break;
    }
}

// ============================================
// PROGRESS TRACKING
// ============================================

/**
 * Отметить слово как выученное
 */
function markAsLearned() {
    const currentWord = AppState.dictionary[AppState.currentCardIndex];
    if (currentWord && !AppState.learnedWords.includes(currentWord.id)) {
        AppState.learnedWords.push(currentWord.id);
        saveState();
        updateProgressUI();
        
        // Визуальная обратная связь
        const btn = document.getElementById('mark-learned');
        btn.classList.add('pulse');
        setTimeout(() => btn.classList.remove('pulse'), 300);
    }
    
    moveToNextCard();
}

/**
 * Обновление UI прогресса
 */
function updateProgressUI() {
    const total = AppState.dictionary.length;
    const learned = AppState.learnedWords.length;
    const percentage = total > 0 ? (learned / total) * 100 : 0;

    document.getElementById('progress-text').textContent = `${learned}/${total}`;
    document.getElementById('progress-fill').style.width = `${percentage}%`;
}

/**
 * Обновление статистики в настройках
 */
function updateStats() {
    const categories = new Set(AppState.dictionary.map(w => w.category));
    
    document.getElementById('stat-total').textContent = AppState.dictionary.length;
    document.getElementById('stat-learned').textContent = AppState.learnedWords.length;
    document.getElementById('stat-categories').textContent = categories.size;
}

// ============================================
// FLASHCARD MODE
// ============================================

/**
 * Рендер текущей карточки
 */
function renderCard() {
    if (AppState.dictionary.length === 0) {
        showEmptyState('card-word', 'Словарь пуст');
        return;
    }

    const word = AppState.dictionary[AppState.currentCardIndex];
    const card = document.getElementById('flashcard');
    
    // Сброс переворота карточки
    card.classList.remove('flipped');

    // Заполнение данными с небольшой задержкой для плавности
    setTimeout(() => {
        document.getElementById('card-word').textContent = word.lak;
        document.getElementById('card-translation').textContent = word.ru;
        document.getElementById('card-transcription').textContent = word.transcription;
        document.getElementById('card-example').textContent = word.example;
        
        // Обновление состояния кнопки "Выучено"
        const learnBtn = document.getElementById('mark-learned');
        learnBtn.disabled = AppState.learnedWords.includes(word.id);
    }, 150);

    updateNavigationButtons();
}

/**
 * Переход к следующей карточке
 */
function moveToNextCard() {
    if (AppState.currentCardIndex < AppState.dictionary.length - 1) {
        AppState.currentCardIndex++;
    } else {
        AppState.currentCardIndex = 0; // Зацикливание
    }
    renderCard();
}

/**
 * Переход к предыдущей карточке
 */
function moveToPrevCard() {
    if (AppState.currentCardIndex > 0) {
        AppState.currentCardIndex--;
    } else {
        AppState.currentCardIndex = AppState.dictionary.length - 1;
    }
    renderCard();
}

/**
 * Обновление кнопок навигации
 */
function updateNavigationButtons() {
    document.getElementById('prev-card').disabled = AppState.dictionary.length <= 1;
    document.getElementById('next-card').disabled = AppState.dictionary.length <= 1;
}

/**
 * Переворот карточки
 */
function flipCard() {
    const card = document.getElementById('flashcard');
    card.classList.toggle('flipped');
}

// ============================================
// QUIZ MODE
// ============================================

let currentQuizQuestion = null;
let quizAnswered = false;

/**
 * Инициализация теста
 */
function initQuiz() {
    if (AppState.dictionary.length < 4) {
        showEmptyState('quiz-word', 'Нужно минимум 4 слова для теста');
        return;
    }
    generateQuizQuestion();
}

/**
 * Генерация нового вопроса для теста
 */
function generateQuizQuestion() {
    quizAnswered = false;
    document.getElementById('next-question').style.display = 'none';
    document.getElementById('quiz-feedback').className = 'quiz-feedback';
    document.getElementById('quiz-feedback').textContent = '';

    // Выбор случайного слова для вопроса
    const randomIndex = Math.floor(Math.random() * AppState.dictionary.length);
    currentQuizQuestion = AppState.dictionary[randomIndex];

    // Генерация вариантов ответов (1 правильный + 3 неправильных)
    const options = [currentQuizQuestion];
    const distractors = AppState.dictionary.filter(w => w.id !== currentQuizQuestion.id);
    
    // Перемешиваем и берём 3 неправильных ответа
    shuffleArray(distractors);
    options.push(...distractors.slice(0, 3));
    
    // Перемешиваем все варианты
    shuffleArray(options);

    // Отображение вопроса
    document.getElementById('quiz-word').textContent = currentQuizQuestion.lak;

    // Генерация кнопок ответов
    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = '';

    options.forEach(option => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option';
        btn.textContent = option.ru;
        btn.dataset.id = option.id;
        btn.addEventListener('click', () => handleQuizAnswer(option.id, btn));
        optionsContainer.appendChild(btn);
    });
}

/**
 * Обработка ответа в тесте
 * @param {number} selectedId - ID выбранного ответа
 * @param {HTMLElement} btnElement - Элемент кнопки
 */
function handleQuizAnswer(selectedId, btnElement) {
    if (quizAnswered) return; // Защита от повторного нажатия
    quizAnswered = true;

    const isCorrect = selectedId === currentQuizQuestion.id;
    const feedback = document.getElementById('quiz-feedback');
    const allOptions = document.querySelectorAll('.quiz-option');

    // Блокировка всех кнопок
    allOptions.forEach(opt => opt.classList.add('disabled'));

    if (isCorrect) {
        btnElement.classList.add('correct');
        feedback.textContent = '✓ Правильно!';
        feedback.className = 'quiz-feedback correct';
        AppState.quizScore.correct++;
    } else {
        btnElement.classList.add('wrong');
        btnElement.classList.add('shake');
        feedback.textContent = `✗ Неправильно. Правильный ответ: ${currentQuizQuestion.ru}`;
        feedback.className = 'quiz-feedback wrong';
        AppState.quizScore.wrong++;

        // Подсветка правильного ответа
        allOptions.forEach(opt => {
            if (parseInt(opt.dataset.id) === currentQuizQuestion.id) {
                opt.classList.add('correct');
            }
        });
    }

    updateQuizScoreUI();
    saveState();
    document.getElementById('next-question').style.display = 'inline-flex';
}

/**
 * Обновление счёта в тесте
 */
function updateQuizScoreUI() {
    document.getElementById('score-correct').textContent = AppState.quizScore.correct;
    document.getElementById('score-wrong').textContent = AppState.quizScore.wrong;
}

// ============================================
// DICTIONARY MODE
// ============================================

/**
 * Рендер списка словаря с фильтрацией
 */
function renderDictionary() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const categoryFilter = document.getElementById('category-filter').value;
    const listContainer = document.getElementById('dictionary-list');
    const emptyState = document.getElementById('empty-state');

    // Фильтрация слов
    let filteredWords = AppState.dictionary.filter(word => {
        const matchesSearch = word.lak.toLowerCase().includes(searchTerm) ||
                             word.ru.toLowerCase().includes(searchTerm);
        const matchesCategory = !categoryFilter || word.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    // Сортировка: сначала невыученные, потом выученные
    filteredWords.sort((a, b) => {
        const aLearned = AppState.learnedWords.includes(a.id);
        const bLearned = AppState.learnedWords.includes(b.id);
        return aLearned - bLearned;
    });

    // Отображение результатов
    if (filteredWords.length === 0) {
        listContainer.style.display = 'none';
        emptyState.style.display = 'block';
    } else {
        listContainer.style.display = 'flex';
        emptyState.style.display = 'none';
        
        listContainer.innerHTML = filteredWords.map(word => {
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
        }).join('');
    }
}

/**
 * Обновление фильтра категорий
 */
function updateCategoryFilter() {
    const categories = [...new Set(AppState.dictionary.map(w => w.category))].sort();
    const select = document.getElementById('category-filter');
    
    select.innerHTML = '<option value="">Все категории</option>' +
        categories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('');
}

// ============================================
// IMPORT/EXPORT FUNCTIONALITY
// ============================================

/**
 * Экспорт словаря в JSON файл
 * Позволяет создавать резервные копии и обмениваться словарями
 */
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

/**
 * Импорт словаря из JSON файла
 * Валидирует структуру данных перед загрузкой
 * @param {File} file - JSON файл для импорта
 */
function importDictionary(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            // Валидация структуры данных
            if (!Array.isArray(importedData)) {
                throw new Error('Данные должны быть массивом');
            }

            // Проверка каждого элемента
            importedData.forEach((item, index) => {
                const requiredFields = ['id', 'lak', 'ru', 'transcription', 'category', 'example'];
                for (const field of requiredFields) {
                    if (!(field in item)) {
                        throw new Error(`Элемент ${index}: отсутствует поле "${field}"`);
                    }
                }
                
                // Проверка типов данных
                if (typeof item.id !== 'number') {
                    throw new Error(`Элемент ${index}: поле "id" должно быть числом`);
                }
                ['lak', 'ru', 'transcription', 'category', 'example'].forEach(field => {
                    if (typeof item[field] !== 'string') {
                        throw new Error(`Элемент ${index}: поле "${field}" должно быть строкой`);
                    }
                });
            });

            // Замена текущего словаря
            AppState.dictionary = importedData;
            AppState.learnedWords = []; // Сброс прогресса при импорте нового словаря
            AppState.currentCardIndex = 0;
            
            saveState();
            
            // Обновление UI
            renderDictionary();
            updateCategoryFilter();
            updateProgressUI();
            updateStats();
            renderCard();
            
            alert(`✓ Успешно импортировано ${importedData.length} слов(а)`);
            
        } catch (error) {
            console.error('Ошибка импорта:', error);
            alert(`✗ Ошибка импорта: ${error.message}\n\nПроверьте формат JSON файла.`);
        }
    };
    
    reader.onerror = function() {
        alert('✗ Ошибка чтения файла');
    };
    
    reader.readAsText(file);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Перемешивание массива (алгоритм Фишера-Йетса)
 * @param {Array} array - Массив для перемешивания
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/**
 * Экранирование HTML для защиты от XSS
 * @param {string} text - Текст для экранирования
 * @returns {string} Экранированный текст
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Показ сообщения о пустом состоянии
 * @param {string} elementId - ID элемента
 * @param {string} message - Сообщение
 */
function showEmptyState(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = message;
    }
}

// ============================================
// EVENT LISTENERS & INITIALIZATION
// ============================================

/**
 * Инициализация приложения
 */
function initApp() {
    // Загрузка сохранённого состояния
    loadState();
    
    // Применение темы
    applyTheme(AppState.theme);
    
    // Навигация по вкладкам
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    // Переключатель темы
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    
    // Карточки: навигация
    document.getElementById('prev-card').addEventListener('click', moveToPrevCard);
    document.getElementById('next-card').addEventListener('click', moveToNextCard);
    document.getElementById('mark-learned').addEventListener('click', markAsLearned);
    document.getElementById('flashcard').addEventListener('click', flipCard);
    
    // Тест: следующий вопрос
    document.getElementById('next-question').addEventListener('click', generateQuizQuestion);
    
    // Словарь: поиск и фильтрация
    document.getElementById('search-input').addEventListener('input', renderDictionary);
    document.getElementById('category-filter').addEventListener('change', renderDictionary);
    
    // Настройки: экспорт/импорт
    document.getElementById('export-json').addEventListener('click', exportDictionary);
    document.getElementById('import-json').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            importDictionary(file);
            e.target.value = ''; // Сброс для возможности повторного импорта того же файла
        }
    });
    
    // Настройки: сброс
    document.getElementById('reset-progress').addEventListener('click', () => {
        if (confirm('Сбросить весь прогресс обучения?')) {
            resetProgress();
            alert('Прогресс сброшен');
        }
    });
    
    document.getElementById('reset-dictionary').addEventListener('click', () => {
        if (confirm('Сбросить словарь к значениям по умолчанию? Все изменения будут потеряны!')) {
            resetDictionary();
            alert('Словарь сброшен');
        }
    });
    
    // Первоначальный рендер
    updateProgressUI();
    updateQuizScoreUI();
    updateCategoryFilter();
    renderCard();
    updateStats();
    
    console.log('Приложение запущено. Слов loaded:', AppState.dictionary.length);
}

// ============================================
// AUTH UI HANDLERS
// ============================================

/**
 * Обновление UI авторизации
 */
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
        if (headerUsername) headerUsername.textContent = AuthSystem.currentUser.username;
    } else {
        authSection.style.display = 'flex';
        mainApp.style.display = 'none';
        userInfo.style.display = 'none';
        authForms.style.display = 'block';
    }
}

/**
 * Показать ошибку авторизации
 * @param {string} message - сообщение об ошибке
 */
function showAuthError(message) {
    const errorEl = document.getElementById('auth-error');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        setTimeout(() => {
            errorEl.style.display = 'none';
        }, 5000);
    }
}

/**
 * Инициализация обработчиков авторизации
 */
function initAuthHandlers() {
    // Переключение между формами
    document.getElementById('show-register')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'block';
    });
    
    document.getElementById('show-login')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
    });
    
    // Обработка входа
    document.getElementById('login-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const result = AuthSystem.login(username);
        
        if (result.success) {
            loadState();
            applyTheme(AppState.theme);
            updateAuthUI();
            switchTab('cards');
        } else {
            showAuthError(result.error);
        }
    });
    
    // Обработка регистрации
    document.getElementById('register-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value.trim();
        const result = AuthSystem.register(username);
        
        if (result.success) {
            AuthSystem.login(username);
            loadState();
            applyTheme(AppState.theme);
            updateAuthUI();
            switchTab('cards');
        } else {
            showAuthError(result.error);
        }
    });
    
    // Выход из аккаунта
    document.getElementById('logout-btn')?.addEventListener('click', () => {
        saveState();
        AuthSystem.logout();
        updateAuthUI();
    });
    
    document.getElementById('header-logout-btn')?.addEventListener('click', () => {
        saveState();
        AuthSystem.logout();
        updateAuthUI();
    });
}

// Запуск приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', async () => {
    // Загрузка словаря из JSON файла
    await loadDictionary();
    
    // Восстановление сессии
    AuthSystem.restoreSession();
    
    // Инициализация обработчиков авторизации
    initAuthHandlers();
    
    // Обновление UI авторизации
    updateAuthUI();
    
    // Если пользователь авторизован, инициализируем приложение
    if (AuthSystem.isLoggedIn()) {
        initApp();
    }
});

/*
 * ============================================
 * ДОПОЛНИТЕЛЬНЫЕ ВОЗМОЖНОСТИ (КОММЕНТАРИИ)
 * ============================================
 * 
 * ДЛЯ ДОБАВЛЕНИЯ ОЗВУЧКИ В БУДУЩЕМ:
 * -------------------------------
 * Если появятся аудиофайлы для каждого слова, можно добавить:
 * 
 * 1. В структуру словаря добавить поле: audioFile: "path/to/audio.mp3"
 * 2. Создать функцию playAudio(wordId):
 *    const word = AppState.dictionary.find(w => w.id === wordId);
 *    if (word && word.audioFile) {
 *        const audio = new Audio(word.audioFile);
 *        audio.play();
 *    }
 * 3. Добавить кнопку воспроизведения на карточку и в словарь
 * 
 * ДЛЯ ДОБАВЛЕНИЯ НОВЫХ СЛОВ ЧЕРЕЗ JSON:
 * -------------------------------------
 * 1. Экспортируйте текущий словарь через кнопку "Экспорт JSON"
 * 2. Откройте файл в текстовом редакторе
 * 3. Добавьте новые элементы по аналогии с существующими:
 *    {
 *        "id": 31,
 *        "lak": "Новое слово",
 *        "ru": "Перевод",
 *        "transcription": "[транскрипция]",
 *        "category": "Категория",
 *        "example": "Пример использования"
 *    }
 * 4. Сохраните файл и импортируйте обратно через "Импорт JSON"
 * 
 * РЕЗЕРВНОЕ КОПИРОВАНИЕ:
 * ----------------------
 * Регулярно используйте "Экспорт JSON" для создания бэкапов.
 * Файл можно хранить на компьютере, в облаке или пересылать другим пользователям.
 */
