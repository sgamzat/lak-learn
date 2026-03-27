// ==========================================
// 📚 БАЗА ЗНАНИЙ (РЕДАКТИРУЙ ЭТОТ СПИСОК)
// ==========================================
const lessons = [
    {
        question: "Как переводится 'Вода'?",
        correct: "Щив",
        options: ["Щив", "Чурт", "Баркалл", "Хъирши"]
    },
    {
        question: "Как переводится 'Хлеб'?",
        correct: "Чурт",
        options: ["Щив", "Чурт", "Нан", "Дук"]
    },
    {
        question: "Выберите перевод для 'Спасибо'",
        correct: "Баркалл",
        options: ["Баркалл", "Ассаламу", "Щив", "Чурт"]
    },
    {
        question: "Как будет 'Хорошо'?",
        correct: "Хъирши",
        options: ["Хъирши", "Яман", "Щив", "Дук"]
    },
    {
        question: "Переведите 'Дом'",
        correct: "Хъуна",
        options: ["Хъуна", "Щив", "Чурт", "Кьан"]
    }
    // Чтобы добавить новый урок, скопируй блок {...}, вставь ниже и поменяй текст
];

// ==========================================
// ⚙️ ЛОГИКА ПРИЛОЖЕНИЯ (НЕ МЕНЯЙ, ЕСЛИ НЕ ЗНАЕШЬ)
// ==========================================

let currentLessonIndex = 0;
let score = 0;

// Элементы интерфейса
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const nextBtn = document.getElementById('next-btn');
const feedbackText = document.getElementById('feedback');
const progressFill = document.getElementById('progress');
const currentStepSpan = document.getElementById('current-step');
const totalStepsSpan = document.getElementById('total-steps');

// Инициализация
function initGame() {
    totalStepsSpan.textContent = lessons.length;
    loadLesson();
}

// Загрузка урока
function loadLesson() {
    const lesson = lessons[currentLessonIndex];
    questionText.textContent = lesson.question;
    currentStepSpan.textContent = currentLessonIndex + 1;
    
    // Обновляем прогресс бар
    const progressPercent = ((currentLessonIndex) / lessons.length) * 100;
    progressFill.style.width = `${progressPercent}%`;

    // Очищаем старые кнопки
    optionsContainer.innerHTML = '';
    feedbackText.textContent = '';
    nextBtn.classList.add('hidden');

    // Перемешиваем варианты ответов (чтобы правильный не всегда был первым)
    const shuffledOptions = [...lesson.options].sort(() => Math.random() - 0.5);

    shuffledOptions.forEach(option => {
        const btn = document.createElement('button');
        btn.classList.add('option-btn');
        btn.textContent = option;
        btn.onclick = () => checkAnswer(option, lesson.correct, btn);
        optionsContainer.appendChild(btn);
    });
}

// Проверка ответа
function checkAnswer(selected, correct, btnElement) {
    // Блокируем все кнопки, чтобы нельзя было нажать дважды
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
        
        // Подсветить правильный ответ
        allButtons.forEach(btn => {
            if (btn.textContent === correct) btn.classList.add('correct');
        });
    }

    nextBtn.classList.remove('hidden');
}

// Переход к следующему уроку
nextBtn.onclick = () => {
    currentLessonIndex++;
    if (currentLessonIndex < lessons.length) {
        loadLesson();
    } else {
        showFinalScreen();
    }
};

// Экран завершения
function showFinalScreen() {
    progressFill.style.width = '100%';
    questionText.textContent = 'Урок завершен! 🎉';
    optionsContainer.innerHTML = `<p>Твой результат: ${score} из ${lessons.length}</p>`;
    feedbackText.textContent = '';
    nextBtn.textContent = 'Начать заново';
    nextBtn.classList.remove('hidden');
    nextBtn.onclick = () => location.reload();
}

// Запуск
initGame();