lak-learn/
├── docker-compose.yml          # Оркестрация БД
├── .env                        # Переменные окружения (секреты)
├── backend/
│   ├── package.json
│   ├── server.js               # API сервер
│   └── database.js             # Подключение к БД
└── frontend/
    ├── index.html
    ├── style.css
    ├── script.js
    └── data.js


🚀 Запуск проекта

# 1. Перейди в корень проекта
cd lak-learn

# 2. Запусти весь стек (БД + Бэкенд)
docker-compose up -d

# 3. Проверь логи
docker-compose logs -f backend

# 4. Открой фронтенд
# Просто открой frontend/index.html в браузере
# ИЛИ запусти локальный сервер:
cd frontend
python3 -m http.server 8080
# Открой http://localhost:8080

# Регистрация
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"123"}'

# Логин
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"123"}'

# Проверка БД
docker exec -it lak_postgres psql -U lakuser -d laklingo -c "SELECT * FROM users;"


📊 Мониторинг (для SRE 😄)

# Статус контейнеров
docker-compose ps

# Логи PostgreSQL
docker-compose logs postgres

# Логи Backend
docker-compose logs backend

# Подключение к БД
docker exec -it lak_postgres psql -U lakuser -d laklingo

# Метрики (размер БД)
docker exec -it lak_postgres psql -U lakuser -d laklingo -c "SELECT pg_size_pretty(pg_database_size('laklingo'));"