require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Middleware для проверки токена
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

// 📝 Регистрация
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    
    const result = await query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username, hash]
    );
    
    // Создаём запись прогресса
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

// 🔑 Логин
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
    
    res.json({ success: true, token, user: { id: user.id, username: user.username } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📊 Получить прогресс
app.get('/api/progress', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT current_lesson, score FROM user_progress WHERE user_id = $1', [req.user.id]);
    res.json({ progress: result.rows[0] || { current_lesson: 0, score: 0 } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 💾 Сохранить прогресс
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

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});