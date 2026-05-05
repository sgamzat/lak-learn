📘 ТЕХНИЧЕСКОЕ ЗАДАНИЕ: Веб-приложение для изучения лакского языка (MVP)
1. Общее описание

Цель: Создать production-ready веб-приложение для изучения лексики лакского языка на основе интервального повторения (SRS).
Ограничения MVP: Без аудио и изображений. Только текст: слова, переводы, примеры предложений, категории.
Масштаб: 50–100 одновременных пользователей.
Инфраструктура: Один VPS (2–4 CPU, 4–8 GB RAM), Docker Compose, PostgreSQL, Redis.
Контент-менеджмент: Безопасный импорт/экспорт слиянием (UPSERT), без удаления существующих данных, с dry-run и аудитом.

2. Технологический стек

Слой	Технология	Версия	Обоснование
Frontend	Next.js 14+ (App Router) + TypeScript + TailwindCSS	Stable	SSR/SSG, строгая типизация, PWA из коробки, легкая масштабируемость
Backend	FastAPI + Pydantic v2 + Python 3.12+	Stable	Async, высокая производительность, встроенная валидация, идеален для SRS/NLP
Database	PostgreSQL 16+	Latest	UPSERT, JSONB, индексы, транзакции, масштабируется до реплик
Cache/Queue	Redis 7+	Latest	Сессии, кэш очереди, блокировки импорта, брокер задач
ORM	SQLAlchemy 2.0 (async) + Alembic	Latest	Типизированные миграции, pool connection, готово к репликам
Auth	JWT (access 15m / refresh 7d)	-	Stateless, легко масштабируется, refresh rotation
Infra	Docker Compose + Nginx + GitHub Actions	-	Один compose.yml, healthchecks, CI/CD, бэкапы cron

3. Архитектура системы
[Browser/PWA] ──HTTPS──> [Nginx] ──> [Next.js Frontend (:3000)]
                                      │
                                      └─> [FastAPI Backend (:8000)]
                                              ├── PostgreSQL (:5432)
                                              └── Redis (:6379)
* Nginx: reverse proxy, TLS termination, static assets cache, rate limiting
* FastAPI: stateless, /api/* endpoints, background tasks через asyncio + Redis lock
* Next.js: клиентский роутинг, React Query, PWA manifest, offline fallback
* Все даты: хранятся в UTC, конвертируются на клиенте



4. Структура базы данных
Создаётся через Alembic. Все таблицы с id UUID PRIMARY KEY. Индексы обязательны.

users
sql

id UUID PK, email VARCHAR(255) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, role VARCHAR(20) DEFAULT 'user', created_at TIMESTAMPTZ DEFAULT NOW()

words
sql

id UUID PK, source_key VARCHAR(100) UNIQUE, lemma VARCHAR(100) NOT NULL, translation VARCHAR(255) NOT NULL, pos VARCHAR(20), difficulty_level VARCHAR(5) DEFAULT 'A1', frequency FLOAT DEFAULT 1.0, example_sentence TEXT, last_imported_at TIMESTAMPTZ, version INT DEFAULT 1, created_at TIMESTAMPTZ DEFAULT NOW()

Индексы: idx_words_source_key, idx_words_lemma, idx_words_frequency

categories
sql

id UUID PK, name_ru VARCHAR(50) NOT NULL, name_lak VARCHAR(50), icon VARCHAR(10), order_index INT DEFAULT 0

tags
sql

id UUID PK, name VARCHAR(30) UNIQUE NOT NULL

word_category (many-to-many)
sql

word_id UUID FK, category_id UUID FK, is_primary BOOLEAN DEFAULT false, PK(word_id, category_id)

word_tag (many-to-many)
sql

word_id UUID FK, tag_id UUID FK, PK(word_id, tag_id)

user_word_progress
sql

id UUID PK, user_id UUID FK, word_id UUID FK, ease_factor FLOAT DEFAULT 2.5, interval INT DEFAULT 0, repetitions INT DEFAULT 0, status VARCHAR(10) DEFAULT 'new', last_review TIMESTAMPTZ, next_review TIMESTAMPTZ, UNIQUE(user_id, word_id)

Индексы: idx_progress_user_next_review, idx_progress_status

import_logs
sql

id UUID PK, user_id UUID FK, filename VARCHAR(255), status VARCHAR(20), diff_summary JSONB, created_at TIMESTAMPTZ DEFAULT NOW()

5. Алгоритм SRS (Spaced Repetition)
Реализация: Модифицированный SM-2. Все вычисления на бэкенде. Даты в UTC.

Входы:
* progress (текущее состояние слова пользователя)
* quality ∈ {0, 1, 2, 3}
    * 0 = Снова (Again)
    * 1 = Сложно (Hard)
    * 2 = Хорошо (Good)
    * 3 = Легко (Easy)

Логика (псевдокод → Python):
python

from datetime import datetime, timedelta
import math

def calculate_next_review(progress, quality: int):
    now = datetime.utcnow()
    if quality == 0:
        progress.repetitions = 0
        progress.interval = 0
        progress.status = "learning"
        progress.next_review = now + timedelta(minutes=1)
    else:
        if progress.repetitions == 0:
            interval = 1
        elif progress.repetitions == 1:
            interval = 6
        else:
            interval = math.ceil(progress.interval * progress.ease_factor)

        if quality == 1:
            interval = max(1, int(interval * 0.8))
        elif quality == 3:
            interval = max(interval, int(interval * 1.3))

        progress.ease_factor += 0.1 - (3 - quality) * 0.08
        progress.ease_factor = max(1.3, progress.ease_factor)
        progress.repetitions += 1
        progress.interval = min(interval, 365)  # cap 1 year
        progress.status = "review"
        progress.next_review = now + timedelta(days=progress.interval)

    progress.last_review = now
    return progress

Граничные условия:
* interval не может быть <1 дня для статуса review
* ease_factor не падает ниже 1.3
* next_review всегда > last_review
* Все операции в транзакции


6. API Specification (FastAPI)
Auth
* POST /auth/register → {email, password} → {token, refresh_token}
* POST /auth/login → {email, password} → {token, refresh_token}
* POST /auth/refresh → {refresh_token} → {token}

Study (SRS)
* GET /api/study/queue?limit=20&category_id=UUID Возвращает: [{word_id, lemma, example_sentence, progress_id}] Логика: WHERE next_review <= NOW() ORDER BY status, next_review ASC, frequency DESC LIMIT 20
* POST /api/study/review Тело: {progress_id: UUID, quality: 0|1|2|3} Возвращает: {next_word?, remaining: int, stats: {new, learning, review}}

Admin / Content
* POST /api/admin/import/dry-run Тело: multipart JSON file Возвращает: {added: int, updated: int, skipped: int, errors: [{word, reason}]}
* POST /api/admin/import/execute Тело: multipart JSON file Возвращает: {job_id, status: processing} → polling /api/admin/jobs/{id}
* GET /api/admin/export?format=json&category_id=UUID Возвращает: stream/download JSON с meta + words[]

Stats
* GET /api/stats → {due_today: int, mastered: int, streak: int, accuracy: float}

Валидация: Pydantic v2 models на каждый request/response. Strict mode.



7. Импорт/Экспорт Pipeline (Безопасный мердж)
Формат файла (words_import.json)
json

{
  "meta": {"exported_at": "2026-05-05T00:00:00Z", "version": "1.0"},
  "words": [
    {
      "source_key": "food_bread_01",
      "lemma": "хIахI",
      "translation": "хлеб",
      "pos": "noun",
      "difficulty_level": "A1",
      "frequency": 9.2,
      "example_sentence": "Ду хIахI ур.",
      "categories": ["Еда"],
      "tags": ["high_frequency"]
    }
  ]
}

Правила импорта (абсолютные)
1. NO DELETE: Импорт никогда не удаляет слова, категории, теги или прогресс.
2. Поиск дублей: source_key → если нет, lemma + pos → если нет, INSERT.
3. UPsert: ON CONFLICT (source_key) DO UPDATE обновляет только указанные поля, инкрементирует version.
4. Категории/Теги: если отсутствуют в БД → создаются автоматически.
5. Транзакция: весь файл в одной транзакции. При ошибке → полный откат.
6. Redis Lock: import:{user_id} предотвращает параллельный запуск.
7. Dry-Run: валидация + расчёт diff без записи в БД.
8. Audit: запись в import_logs с diff_summary и filename.

Алгоритм (пошагово для ИИ)
1. Парсинг JSON → валидация Pydantic schema
2. Нормализация: lemma.strip(), Unicode NFC, lowercase для поиска
3. Dry-Run: сравнение с БД, сбор статистики
4. Execute: BEGIN → цикл слов → UPSERT → sync relations → COMMIT
5. Логирование → возврат статуса



8. Frontend & UX Flow
Страницы
* / → Dashboard: статистика, кнопка "Начать занятие", прогресс-бар
* /study → Flashcard: слово → "Показать перевод" → 4 кнопки оценки → авто-переход
* /dictionary → Таблица с фильтрами (категория, POS, статус), поиск
* /admin/import → Drag&drop JSON, таблица dry-run preview, кнопка "Запустить", лог
* /profile → Настройки, экспорт, смена пароля

Компоненты
* Flashcard: flip-анимация, keyboard shortcuts (1-4 для оценки)
* ImportPreview: таблица с color-coded diff (зелёный=новое, жёлтый=обновление, красный=ошибка)
* CategoryFilter: чипы с active state
* ProgressRing: SVG, due_today / mastered

PWA
* manifest.json (иконка, display: standalone, theme_color)
* Service Worker: кэш static assets, fallback на /study при offline
* IndexedDB: кэш текущей очереди (синхронизация при reconnect)



9. DevOps & Инфраструктура
docker-compose.yml (основа)
yaml

services:
  db:
    image: postgres:16-alpine
    env_file: .env
    volumes: [pg_data:/var/lib/postgresql/data]
    healthcheck: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER"]
  redis:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "yes", "--maxmemory-policy", "allkeys-lru"]
    volumes: [redis_data:/data]
  backend:
    build: ./backend
    env_file: .env
    depends_on: [db, redis]
    deploy: {resources: {limits: {cpus: '1.0', memory: 1G}}}
  frontend:
    build: ./frontend
    env_file: .env
    depends_on: [backend]
  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes: [./nginx.conf:/etc/nginx/nginx.conf:ro]
    depends_on: [frontend, backend]
volumes: {pg_data:, redis_data:}

CI/CD (GitHub Actions)
yaml

name: CI/CD
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps: [checkout, setup-python, pip install, pytest, ruff, mypy]
  build-push:
    needs: test
    runs-on: ubuntu-latest
    steps: [docker buildx, push to GHCR]
  deploy:
    needs: build-push
    runs-on: self-hosted
    steps: [ssh to VPS, pull compose, up -d, db migrate, healthcheck]

Бэкапы & Мониторинг
* cron на VPS: pg_dump | gzip > /backups/db_$(date +\%F).sql.gz (хранить 7 дней)
* Logs: JSON формат, logrotate для контейнеров
* Healthchecks: /healthz (backend), /readyz (next.js)

10. Пошаговый план для ИИ-агента

Фаза	Задача	Команды/Файлы	Критерий приёмки
1	Инициализация репозитория, docker-compose, .env.example, CI	mkdir, git init, compose.yml	docker compose up -d поднимает пустые сервисы, healthchecks зелёные
2	БД + Alembic миграции, Pydantic модели, SQLAlchemy async	alembic init, models.py, migrations/	alembic upgrade head создаёт таблицы, индексы, FK
3	Auth + JWT + Middleware	auth.py, dependencies.py	Регистрация/логин работают, refresh rotation, rate limit 5/min
4	SRS ядро + Queue API	srs.py, study.py	Алгоритм SM-2 корректен, очередь сортируется, статусы обновляются
5	Import/Export Pipeline + Dry-Run	import_service.py, export.py, workers/	Dry-run показывает diff, execute не удаляет данные, логируются в БД
6	Frontend (Next.js) + PWA + React Query	app/, components/, sw.js	Карточка работает, offline fallback, фильтры, dry-run preview
7	Nginx + HTTPS + Deploy Script	nginx.conf, deploy.sh	Работает на localhost:80/443, curl /api/health 200
8	Тесты + Нагрузка + Финальная сборка	tests/, k6/script.js	Unit/Int/E2E 100%, 100 concurrent без падения памяти <70%
Инструкция для ИИ: Генерировать код поэтапно. Не объединять всё в один промпт. После каждой фазы запускать docker compose up -d --build, проверять healthchecks, запускать тесты. При ошибке возвращаться к шагу 2.


11. Тестирование и критерии приёмки
Обязательные тесты
* test_srs_calculation.py: граничные случаи (quality 0-3, ease_factor min/max, interval cap)
* test_import_merge.py: dry-run diff, UPSERT без удаления, авто-создание категорий, откат при ошибке
* test_queue_logic.py: сортировка по статусу/дате/частоте, пагинация, фильтрация по category
* test_auth_flow.py: register → login → refresh → expired token → 401
* E2E: playwright или cypress → пользователь проходит 10 карточек, видит прогресс

Нагрузочный тест (k6)
js

import http from 'k6/http';
export const options = { vus: 100, duration: '2m' };
export default () => {
  http.get('http://localhost/api/study/queue?limit=20');
};

Приёмка: p95 < 300ms, error rate < 0.1%, memory < 80% RAM, CPU < 70%



12. Лак-специфичные требования
1. Unicode: Все строки нормализуются в NFC. Валидация допускает Ӏ, хъ, къ, гъ, цI, чI.
2. POS Tags: noun, verb, adj, adv, pron, postposition, particle
3. Примеры предложений: хранятся как текст. Позже будут парситься для подсветки аффиксов.
4. Категории: на старте плоские. Поддержка иерархии заложена в order_index и parent_id (добавить позже).
5. Язык интерфейса: Русский по умолчанию. Поле language: "ru" в users. Заготовка для "lak".
