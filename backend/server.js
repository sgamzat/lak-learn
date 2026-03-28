// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('./database'); // 👈 query — это наша dbQuery из database.js

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ==========================================
// 🔐 Middleware: проверка токена
// ==========================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// 🔐 Middleware: только для админов
const requireAdmin = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
    if (err) return res.sendStatus(403);
    
    const dbUser = await query('SELECT is_admin FROM users WHERE id = $1', [user.id]);
    if (!dbUser.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Требуется права администратора' });
    }
    
    req.user = user;
    next();
  });
};

// ==========================================
// 👤 AUTH: Регистрация
// ==========================================
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    
    const result = await query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username, hash]
    );
    
    await query('INSERT INTO user_progress (user_id) VALUES ($1)', [result.rows[0].id]);
    
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      res.status(400).json({ error: 'Пользователь уже существует' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// ==========================================
// 🔑 AUTH: Логин
// ==========================================
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await query('SELECT * FROM users WHERE username = $1', [username]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }
    
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    
    if (!valid) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }
    
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });
    
    res.json({ 
  success: true, 
  token, 
  user: { 
    id: user.id, 
    username: user.username,
    is_admin: user.is_admin  // 👈 Добавили
  } 
});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 📊 PROGRESS: Получить прогресс
// ==========================================
app.get('/api/progress', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT current_lesson, score FROM user_progress WHERE user_id = $1', [req.user.id]);
    res.json({ progress: result.rows[0] || { current_lesson: 0, score: 0 } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 💾 PROGRESS: Сохранить прогресс
// ==========================================
app.post('/api/progress', authenticateToken, async (req, res) => {
  try {
    const { current_lesson, score } = req.body;
    await query(`
      INSERT INTO user_progress (user_id, current_lesson, score) 
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) 
      DO UPDATE SET current_lesson = $2, score = $3, updated_at = CURRENT_TIMESTAMP
    `, [req.user.id, current_lesson, score]);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 📚 LESSONS: Получить все уроки (публично)
// ==========================================
app.get('/api/lessons', async (req, res) => {
  try {
    const { category, difficulty } = req.query;
    
    // 👇 Используем sqlQuery вместо query, чтобы не было конфликта имён
    let sqlQuery = 'SELECT id, question, correct, options, category, difficulty FROM lessons WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (category) {
      sqlQuery += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    if (difficulty) {
      sqlQuery += ` AND difficulty = $${paramIndex}`;
      params.push(difficulty);
      paramIndex++;
    }
    
    sqlQuery += ' ORDER BY id ASC';
    
    // 👇 Вызываем функцию query() (из database.js) с переменной sqlQuery
    const result = await query(sqlQuery, params);
    res.json({ lessons: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ➕ LESSONS: Добавить урок (только админ)
// ==========================================
app.post('/api/lessons', requireAdmin, async (req, res) => {
  try {
    const { question, correct, options, category, difficulty } = req.body;
    
    if (!question || !correct || !options || !Array.isArray(options)) {
      return res.status(400).json({ error: 'Неверные данные' });
    }
    if (!options.includes(correct)) {
      return res.status(400).json({ error: 'Правильный ответ должен быть в списке вариантов' });
    }
    
    const result = await query(
      `INSERT INTO lessons (question, correct, options, category, difficulty) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [question, correct, JSON.stringify(options), category || 'general', difficulty || 1]
    );
    
    res.json({ success: true, lesson: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ✏️ LESSONS: Редактировать урок (только админ)
// ==========================================
app.put('/api/lessons/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { question, correct, options, category, difficulty } = req.body;
    
    const result = await query(
      `UPDATE lessons SET 
         question = COALESCE($1, question),
         correct = COALESCE($2, correct),
         options = COALESCE($3::jsonb, options),
         category = COALESCE($4, category),
         difficulty = COALESCE($5, difficulty)
       WHERE id = $6 RETURNING *`,
      [question, correct, options ? JSON.stringify(options) : null, category, difficulty, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Урок не найден' });
    }
    
    res.json({ success: true, lesson: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 🗑️ LESSONS: Удалить урок (только админ)
// ==========================================
app.delete('/api/lessons/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM lessons WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 🚀 Запуск сервера
// ==========================================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});