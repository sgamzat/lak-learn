// frontend/admin.js
const API_URL = 'http://localhost:3000/api';
let adminToken = localStorage.getItem('lakLingoAdminToken');

// Элементы
const authScreen = document.getElementById('auth-screen-admin');
const adminPanel = document.getElementById('admin-panel');
const loginForm = document.getElementById('admin-login-form');
const logoutBtn = document.getElementById('admin-logout');
const addLessonForm = document.getElementById('add-lesson-form');
const lessonsContainer = document.getElementById('lessons-container');
const formMessage = document.getElementById('form-message');
const loginError = document.getElementById('admin-login-error');

console.log('🔐 Admin panel loaded, token:', adminToken ? 'exists' : 'none');

// Проверка авторизации
async function checkAdminAuth() {
    if (!adminToken) {
        console.log('❌ No token, showing auth screen');
        authScreen.classList.remove('hidden');
        adminPanel.classList.add('hidden');
        return;
    }
    
    try {
        console.log('🔄 Checking admin auth...');
        const res = await fetch(`${API_URL}/lessons`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        console.log('📡 Lessons API response:', res.status);
        
        if (res.ok) {
            console.log('✅ Auth OK, showing admin panel');
            authScreen.classList.add('hidden');
            adminPanel.classList.remove('hidden');
            loadLessons();
        } else {
            console.log('❌ Auth failed, logging out');
            logout();
        }
    } catch (err) {
        console.error('💥 Auth check error:', err);
        logout();
    }
}

function logout() {
    console.log('🚪 Logging out');
    adminToken = null;
    localStorage.removeItem('lakLingoAdminToken');
    authScreen.classList.remove('hidden');
    adminPanel.classList.add('hidden');
}

// Вход
loginForm.onsubmit = async (e) => {
    e.preventDefault();
    console.log('🔑 Login attempt');
    
    const username = document.getElementById('admin-username').value;
    const password = document.getElementById('admin-password').value;
    
    try {
        console.log('📡 Sending login request...');
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await res.json();
        console.log('📥 Login response:', res.status, data);
        
        if (res.ok && data.user) {
            console.log('👤 User data:', data.user);
            
            // Проверяем, что пользователь — админ
            if (!data.user.is_admin) {
                console.log('❌ User is not admin');
                loginError.textContent = '❌ Нет прав администратора';
                return;
            }
            
            console.log('✅ Admin login successful');
            adminToken = data.token;
            localStorage.setItem('lakLingoAdminToken', adminToken);
            loginError.textContent = '';
            checkAdminAuth();
        } else {
            console.log('❌ Login failed:', data.error);
            loginError.textContent = data.error || 'Ошибка входа';
        }
    } catch (err) {
        console.error('💥 Login error:', err);
        loginError.textContent = 'Ошибка подключения к серверу';
    }
};

logoutBtn.onclick = logout;

// Загрузка списка уроков
async function loadLessons() {
    console.log('📚 Loading lessons...');
    try {
        const res = await fetch(`${API_URL}/lessons`);
        const data = await res.json();
        console.log('📥 Lessons data:', data);
        
        if (!data.lessons || data.lessons.length === 0) {
            lessonsContainer.innerHTML = '<p>Уроков пока нет. Добавь первый! 👆</p>';
            return;
        }
        
        lessonsContainer.innerHTML = data.lessons.map(lesson => `
            <div class="lesson-item">
                <strong>Q:</strong> ${lesson.question}<br>
                <strong>A:</strong> ${lesson.correct}<br>
                <small>Категория: ${lesson.category} | Сложность: ${lesson.difficulty}</small>
                <div class="lesson-actions">
                    <button class="btn btn-danger btn-sm" onclick="deleteLesson(${lesson.id})">🗑️ Удалить</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('💥 Error loading lessons:', err);
        lessonsContainer.innerHTML = '<p style="color: #ff4b4b;">Ошибка загрузки уроков</p>';
    }
}

// Добавление урока
addLessonForm.onsubmit = async (e) => {
    e.preventDefault();
    console.log('✏️ Adding new lesson');
    formMessage.textContent = 'Сохранение...';
    
    const options = Array.from(document.querySelectorAll('.option-input'))
        .map(input => input.value.trim())
        .filter(v => v);
    
    const lessonData = {
        question: document.getElementById('lesson-question').value.trim(),
        correct: document.getElementById('lesson-correct').value.trim(),
        options: options,
        category: document.getElementById('lesson-category').value,
        difficulty: parseInt(document.getElementById('lesson-difficulty').value)
    };
    
    console.log('📦 Lesson data:', lessonData);
    
    try {
        const res = await fetch(`${API_URL}/lessons`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify(lessonData)
        });
        const data = await res.json();
        console.log('📥 Add lesson response:', res.status, data);
        
        if (res.ok) {
            formMessage.textContent = '✅ Урок добавлен!';
            formMessage.style.color = '#58cc02';
            addLessonForm.reset();
            loadLessons();
            setTimeout(() => formMessage.textContent = '', 3000);
        } else {
            formMessage.textContent = `❌ ${data.error}`;
            formMessage.style.color = '#ff4b4b';
        }
    } catch (err) {
        console.error('💥 Error adding lesson:', err);
        formMessage.textContent = '❌ Ошибка подключения';
        formMessage.style.color = '#ff4b4b';
    }
};

// Удаление урока
window.deleteLesson = async (id) => {
    if (!confirm('Удалить этот урок?')) return;
    console.log('🗑️ Deleting lesson', id);
    
    try {
        const res = await fetch(`${API_URL}/lessons/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        console.log('📥 Delete response:', res.status);
        
        if (res.ok) {
            loadLessons();
        } else {
            alert('Ошибка при удалении');
        }
    } catch (err) {
        console.error('💥 Error deleting lesson:', err);
        alert('Ошибка подключения');
    }
};

// Инициализация
console.log('🚀 Admin panel initializing...');
checkAdminAuth();