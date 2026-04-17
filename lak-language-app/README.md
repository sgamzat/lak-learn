# Lak Language Learning App

Веб-приложение для изучения Лакского языка (Дагестан) с функционалом, похожим на Duolingo и Ewa.

## 📋 Содержание

- [Технологический стек](#технологический-стек)
- [Быстрый старт](#быстрый-старт)
- [Структура проекта](#структура-проекта)
- [API Documentation](#api-documentation)
- [Админ-панель](#админ-панель)
- [Тестирование](#тестирование)

## 🚀 Технологический стек

### Backend
- **Node.js 20+** с **NestJS** - модульный фреймворк с отличной поддержкой TypeScript
- **PostgreSQL** - основная база данных
- **Redis** - кэширование и сессии
- **Prisma ORM** - типобезопасная работа с БД
- **JWT + refresh tokens** - аутентификация
- **bcrypt** - хеширование паролей

### Frontend
- **React 18** + **TypeScript**
- **Vite** - быстрая сборка и hot reload
- **Tailwind CSS** - стилизация
- **React Query** - управление состоянием сервера
- **React Router** - навигация
- **Zustand** - локальное состояние

### Инфраструктура
- **Docker** + **docker-compose** - контейнеризация
- **Jest** - тестирование backend
- **Vitest** + **React Testing Library** - тестирование frontend
- **Playwright** - E2E тесты

## 🎯 Быстрый старт

### Предварительные требования

- Docker и Docker Compose
- Node.js 20+ (для локальной разработки без Docker)

### Запуск через Docker (рекомендуется)

```bash
# Клонирование репозитория
git clone <repository-url>
cd lak-language-app

# Копирование переменных окружения
cp .env.example .env

# Запуск всех сервисов
docker-compose up -d

# Инициализация базы данных (миграции и сиды)
docker-compose exec backend npm run db:migrate
docker-compose exec backend npm run db:seed

# Приложение доступно по адресу:
# Frontend: http://localhost:3000
# Backend API: http://localhost:5000
# Admin Panel: http://localhost:3000/admin
```

### Локальная разработка (без Docker)

```bash
# Установка зависимостей
cd backend && npm install
cd ../frontend && npm install

# Запуск PostgreSQL и Redis (через Docker или локально)
docker-compose up -d postgres redis

# Настройка переменных окружения
cp .env.example .env

# Миграции и сиды
cd backend
npm run db:migrate
npm run db:seed

# Запуск в режиме разработки
# Терминал 1 - Backend
cd backend
npm run dev

# Терминал 2 - Frontend
cd frontend
npm run dev
```

## 📁 Структура проекта

```
lak-language-app/
├── backend/                 # NestJS backend
│   ├── src/
│   │   ├── auth/           # Аутентификация
│   │   ├── users/          # Пользователи
│   │   ├── words/          # Слова
│   │   ├── sentences/      # Предложения
│   │   ├── progress/       # Прогресс обучения
│   │   ├── admin/          # Админ-панель
│   │   └── main.ts
│   ├── prisma/
│   │   ├── schema.prisma   # Схема БД
│   │   ├── migrations/     # Миграции
│   │   └── seeds/          # Сиды
│   ├── test/               # Тесты
│   └── package.json
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # UI компоненты
│   │   ├── pages/          # Страницы
│   │   ├── hooks/          # Custom hooks
│   │   ├── services/       # API client
│   │   ├── store/          # Zustand store
│   │   └── App.tsx
│   ├── public/
│   └── package.json
├── docker-compose.yml
├── .env.example
└── README.md
```

## 🔑 Первый вход как админ

После запуска приложения и выполнения сидов:

```
Email: admin@laklanguage.com
Пароль: admin123
```

Для создания нового админа:

```bash
docker-compose exec backend npm run create-admin -- email@example.com password
```

## 📊 Импорт контента

### Через админ-панель

1. Войдите как админ
2. Перейдите в раздел "Контент"
3. Выберите "Импорт слов" или "Импорт предложений"
4. Загрузите CSV/JSON файл

### Формат CSV для слов

```csv
lakWord,translation,transcription,partOfSpeech,topic,exampleSentence
барз,медведь,barz,существительное,Животные,Барз лесде яхъирчай.
```

### Формат JSON для слов

```json
[
  {
    "lakWord": "барз",
    "translation": "медведь",
    "transcription": "barz",
    "partOfSpeech": "существительное",
    "topic": "Животные",
    "exampleSentence": "Барз лесде яхъирчай.",
    "difficulty": 1
  }
]
```

## 🧪 Тестирование

```bash
# Backend тесты
cd backend
npm run test          # Unit тесты
npm run test:e2e      # E2E тесты
npm run test:cov      # Покрытие кода

# Frontend тесты
cd frontend
npm run test          # Unit тесты
npm run test:e2e      # E2E тесты (Playwright)
```

## 🌐 API Endpoints

### Аутентификация

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Вход |
| POST | `/api/auth/refresh` | Обновление токена |
| POST | `/api/auth/logout` | Выход |

### Пользователь

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/user/profile` | Профиль |
| PUT | `/api/user/profile` | Обновление профиля |
| GET | `/api/user/stats` | Статистика |
| GET | `/api/user/progress` | Прогресс |

### Обучение

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/words` | Список слов |
| POST | `/api/words/:id/practice` | Практика слова |
| GET | `/api/sentences` | Список предложений |
| POST | `/api/sentences/:id/practice` | Практика предложения |

### Админ (требуется роль admin)

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/admin/words` | Список слов |
| POST | `/api/admin/words` | Создание слова |
| PUT | `/api/admin/words/:id` | Обновление слова |
| DELETE | `/api/admin/words/:id` | Удаление слова |
| POST | `/api/admin/import` | Импорт контента |

## 🎮 Геймификация

- **XP (Experience Points)** - опыт за выполненные упражнения
- **Streak** - серия дней подряд с активностью
- **Levels** - уровни от 1 до 50
- **Achievements** - достижения за различные успехи
- **Leaderboard** - таблица лидеров (в разработке)

## 🌙 Темы оформления

Приложение поддерживает светлую и тёмную тему. Переключение в профиле пользователя.

## 📱 PWA (Progressive Web App)

Приложение можно установить на мобильное устройство как нативное приложение через браузер.

## 🔧 Конфигурация

Все настройки через переменные окружения. См. `.env.example` для полного списка.

## 📝 Лицензия

MIT License
