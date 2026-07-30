-- ============================================================
-- Миграция 009: стартовый admin-пользователь
-- Запускать после 001_init.sql (нужны roles + users)
--
-- Логин:  admin@laklearn.local
-- Пароль: Admin123!
--
-- Повторный прогон безопасен: email UNIQUE + ON CONFLICT DO NOTHING.
-- В проде сразу смените пароль или удалите этого пользователя.
-- ============================================================

INSERT INTO users (email, password_hash, role_id, display_name, is_blocked)
SELECT
  'admin@laklearn.local',
  '120000:c776fe2b8b69b31d4f1b8b6ad1b4e28e:7c7f0b192bfb993e1d89a7ca5e949cc0ba6a02870d5d97bcb13c0db212ad3762eeb5d4b5cbae2770f825767168daa8a917dd7c508cc8e28313353a258e954af5',
  r.id,
  'Admin',
  FALSE
FROM roles r
WHERE r.code = 'admin'
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_progress (user_id, xp, streak_days, learned_words)
SELECT u.id, 0, 0, 0
FROM users u
WHERE u.email = 'admin@laklearn.local'
ON CONFLICT (user_id) DO NOTHING;
