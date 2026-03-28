// ==========================================
// 🌐 ЗАГРУЗКА УРОКОВ С СЕРВЕРА
// ==========================================

async function loadLessonsFromAPI() {
    try {
        const res = await fetch('http://localhost:3000/api/lessons');
        const data = await res.json();
        return data.lessons || [];
    } catch (err) {
        console.error('Не удалось загрузить уроки:', err);
        // Fallback: пустой массив или можно вернуть дефолтные уроки
        return [];
    }
}

// В функции initGame() замени:
async function initGame() {
    loadProgress();
    
    // 👇 Загружаем уроки из БД вместо статического массива
    const apiLessons = await loadLessonsFromAPI();
    
    // Объединяем: если в БД пусто, используем дефолтные из data.js
    const allLessons = apiLessons.length > 0 ? apiLessons : (typeof lessons !== 'undefined' ? lessons : []);
    
    totalStepsSpan.textContent = allLessons.length;
    
    if (allLessons.length === 0) {
        questionText.textContent = "Уроков пока нет. Добавь их в админке!";
        return;
    }
    
    if (currentLessonIndex >= allLessons.length) {
        showFinalScreen();
        return;
    }
    
    // 👇 Передаём уроки в функцию загрузки
    loadLesson(allLessons);
}

// Обновляем функцию loadLesson, чтобы принимать уроки как параметр:
function loadLesson(lessonsArray) {
    const lesson = lessonsArray[currentLessonIndex];
    // ... остальной код без изменений ...
}

// В checkAnswer и nextBtn.onclick тоже передавай lessonsArray
// (или сделай lessonsArray глобальной переменной для простоты)