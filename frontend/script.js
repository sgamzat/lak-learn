// ==========================================
// ⚙️ КОНФИГУРАЦИЯ
// ==========================================
const API_URL = 'http://localhost:3000/api';
let token = localStorage.getItem('lakLingoToken');
let currentUser = null;

// ==========================================
// 🎮 ИГРОВАЯ ЛОГИКА
// ==========================================
let currentLessonIndex = 0;
let score = 0;

const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const nextBtn = document.getElementById('next-btn');
const feedbackText = document.getElementById('feedback');
const progressFill = document.getElementById('progress');
const currentStepSpan = document.getElementById('current-step');
const totalStepsSpan = document.getElementById('total-steps');

// ==========================================
// 🔐 АВТОРИЗАЦИЯ
// ==========================================
const authScreen = document.getElementById('auth-screen');
const gameScreen = document.getElementById('game-screen');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const logoutBtn = document.getElementById('logout-btn');
const usernameDisplay = document.getElementById('username-display');
const authError = document.getElementById('auth-error');

// Проверка токена при загрузке
async function checkAuth() {
    if (!token) {
        showAuthScreen();
        return;
    }
    
    try {
        const res = await fetch(`${API_URL}/progress`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            const data = await res.json();
            currentUser = JSON.parse(localStorage.getItem('lakLingoUser'));
            showGameScreen(data.progress);
        } else {
            logout();
        }
    } catch (err) {
        logout();
    }
}

function showAuthScreen() {
    authScreen.classList.remove('hidden');
    gameScreen.classList.add('hidden');
}

function showGameScreen(progress) {
    authScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    usernameDisplay.textContent = currentUser?.username || 'User';
    
    currentLessonIndex = progress?.current_lesson || 0;
    score = progress?.score || 0;
    
    totalStepsSpan.textContent = lessons.length;
    
    if (currentLessonIndex >= lessons.length) {
        showFinalScreen();
    } else {
        loadLesson();
    }
}

function logout() {
    token = null;
    currentUser = null;
    localStorage.removeItem('lakLingoToken');
    localStorage.removeItem('lakLingoUser');
    showAuthScreen();
}

// Регистрация
registerForm.onsubmit = async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    
    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            // Автоматический логин после регистрации
            await autoLogin(username, password);
        } else {
            authError.textContent = data.error;
        }
    } catch (err) {
        authError.textContent = 'Ошибка подключения к серверу';
    }
};

// Вход
loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    await autoLogin(username, password);
};

async function autoLogin(username, password) {
    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            token = data.token;
            currentUser = data.user;
            localStorage.setItem('lakLingoToken', token);
            localStorage.setItem('lakLingoUser', JSON.stringify(data.user));
            authError.textContent = '';
            showGameScreen({ current_lesson: 0, score: 0 });
        } else {
            authError.textContent = data.error;
        }
    } catch (err) {
        authError.textContent = 'Ошибка подключения к серверу';
    }
}

logoutBtn.onclick = logout;

// ==========================================
// 🎮 ИГРОВАЯ ЛОГИКА
// ==========================================

function initGame() {
    totalStepsSpan.textContent = lessons.length;
    
    if (lessons.length === 0) {
        questionText.textContent = "База знаний пуста!";
        return;
    }
    
    if (currentLessonIndex >= lessons.length) {
        showFinalScreen();
        return;
    }
    
    loadLesson();
}

function loadLesson() {
    const lesson = lessons[currentLessonIndex];
    questionText.textContent = lesson.question;
    currentStepSpan.textContent = currentLessonIndex + 1;
    
    const progressPercent = ((currentLessonIndex) / lessons.length) * 100;
    progressFill.style.width = `${progressPercent}%`;

    optionsContainer.innerHTML = '';
    feedbackText.textContent = '';
    nextBtn.classList.add('hidden');

    const shuffledOptions = [...lesson.options].sort(() => Math.random() - 0.5);

    shuffledOptions.forEach(option => {
        const btn = document.createElement('button');
        btn.classList.add('option-btn');
        btn.textContent = option;
        btn.onclick = () => checkAnswer(option, lesson.correct, btn);
        optionsContainer.appendChild(btn);
    });
}

function checkAnswer(selected, correct, btnElement) {
    const allButtons = document.querySelectorAll('.option-btn');
    allButtons.forEach(btn => btn.disabled = true);

    if (selected === correct) {
        btnElement.classList.add('correct');
        feedbackText.textContent = 'Отлично! ✅';
        feedbackText.style.color = '#58cc02';
        score++;
    } else {
        btnElement.classList.add('wrong');
        feedbackText.textContent = `Правильно было: ${correct} ❌`;
        feedbackText.style.color = '#ff4b4b';
        
        allButtons.forEach(btn => {
            if (btn.textContent === correct) btn.classList.add('correct');
        });
    }

    saveProgress();
    nextBtn.classList.remove('hidden');
}

async function saveProgress() {
    if (!token) return;
    
    try {
        await fetch(`${API_URL}/progress`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                current_lesson: currentLessonIndex,
                score: score
            })
        });
    } catch (err) {
        console.error('Failed to save progress:', err);
    }
}

nextBtn.onclick = () => {
    currentLessonIndex++;
    saveProgress();
    
    if (currentLessonIndex < lessons.length) {
        loadLesson();
    } else {
        showFinalScreen();
    }
};

function showFinalScreen() {
    progressFill.style.width = '100%';
    questionText.textContent = 'Урок завершен! 🎉';
    optionsContainer.innerHTML = `<p>Твой результат: ${score} из ${lessons.length}</p>`;
    feedbackText.textContent = '';
    nextBtn.textContent = 'Начать заново';
    nextBtn.classList.remove('hidden');
    nextBtn.onclick = async () => {
        currentLessonIndex = 0;
        score = 0;
        await saveProgress();
        location.reload();
    };
}

// ==========================================
// 🚀 ЗАПУСК
// ==========================================
checkAuth();