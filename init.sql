-- Таблица уроков (слова/фразы)
CREATE TABLE IF NOT EXISTS lessons (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    correct TEXT NOT NULL,
    options JSONB NOT NULL,  -- Массив вариантов: ["вар1", "вар2", "вар3", "вар4"]
    category VARCHAR(50) DEFAULT 'general',
    difficulty INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_lessons_category ON lessons(category);
CREATE INDEX IF NOT EXISTS idx_lessons_difficulty ON lessons(difficulty);

-- 🎁 Бонус: добавим поле is_admin в users (для разделения прав)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 👑 Создадим админа по умолчанию (можно изменить позже)
-- Пароль: 'admin123' (хэш для примера, в продакшене сгенерируй новый!)
INSERT INTO users (username, password_hash, is_admin) 
SELECT 'admin', 'admin123', TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');