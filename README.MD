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