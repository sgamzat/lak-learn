# Backend-план для финализации проекта

## 1. Целевая архитектура (облегчённый стек)

- **Frontend + Backend API в одном приложении Next.js** (App Router + Route Handlers).
- **PostgreSQL** как основная БД.
- **Nginx** как reverse proxy перед приложением.
- **Без Redis на первом релизе** — чтобы не усложнять деплой.
- Оркестрация всех сервисов через Docker Compose.

## 2. Почему этот стек оптимален

- Один runtime и один кодовый репозиторий для UI и API.
- Меньше операционной сложности (нет отдельного backend-сервиса).
- Быстрый запуск локально/на сервере через одну команду Docker Compose.
- Плавный рост: Redis и отдельный API-сервис можно добавить позже без полного переписывания.

## 3. Модель данных (финальная структура)

База уже заложена в миграции `db/migrations/001_init.sql`:

- `roles` — роли `user/admin`.
- `users` — пользователь, email/password hash, блокировка.
- `user_sessions` — refresh-сессии.
- `words` — словарные единицы.
- `word_examples` — примеры употребления.
- `tags` + `word_tags` — теги и связи.
- `user_progress` — общий прогресс пользователя.
- `review_history` — история SRS-оценок.
- `audit_log` — аудит админ-действий.

## 4. Auth и безопасность

- Регистрация/логин с хэшированием паролей.
- Access token (короткий TTL) + refresh token (длинный TTL).
- Хранение refresh-сессий в `user_sessions`.
- RBAC: проверка роли для admin endpoint-ов.
- Блокировка пользователя флагом `is_blocked`.
- Журналирование админ-операций в `audit_log`.

## 5. API-контракты (минимум для финала)

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### User
- `GET /api/profile`
- `PATCH /api/profile`
- `GET /api/progress`

### Dictionary
- `GET /api/words` (поиск, пагинация, фильтры)
- `GET /api/words/:id`

### SRS
- `GET /api/srs/queue`
- `POST /api/srs/review`
- `GET /api/srs/stats`

### Admin
- `POST /api/admin/words`
- `PATCH /api/admin/words/:id`
- `DELETE /api/admin/words/:id` (soft delete)
- `POST /api/admin/words/import` (CSV/JSON)
- `GET /api/admin/users`
- `PATCH /api/admin/users/:id` (role/block)
- `GET /api/admin/audit`

## 6. Где хранить базу слов и как обновлять

- Источник истины: таблицы `words`, `word_examples`, `tags`, `word_tags` в PostgreSQL.
- Импорт:
  - загрузка CSV/JSON через admin endpoint,
  - валидация,
  - upsert/обновление записей,
  - запись операции в `audit_log`.
- Для безопасных массовых обновлений — staging-подход (временная таблица + подтверждение).

## 7. Админ-панель

Раздел `/admin` внутри текущего Next.js приложения:

- Управление словами: создать/редактировать/деактивировать.
- Управление пользователями: просмотр, смена роли, блокировка.
- Импорт словаря из CSV/JSON.
- Просмотр журнала изменений (`audit_log`).

## 8. План миграции с текущих mock-данных

1. Оставить текущий fallback в клиенте как резерв.
2. Поднять read endpoint-ы (`/api/words`, `/api/srs/queue`, `/api/progress`).
3. Переключить чтение с mock на API.
4. Добавить write endpoint-ы SRS и профиля.
5. Подключить auth и приватные страницы.
6. Подключить `/admin` и отключить mock fallback.

## 9. Backlog реализации (по шагам)

1. Базовая DB-обвязка (`DATABASE_URL`, pool, error handling).
2. Auth API + middleware авторизации и RBAC.
3. Dictionary read API.
4. SRS API (queue/review/stats).
5. User profile/progress API.
6. Admin API (words/users/audit/import).
7. UI для auth и admin.
8. Финальные тесты и hardening.

## 10. Docker (финальная версия)

Финальный состав уже подготовлен:

- `docker-compose.yml` — сервисы `postgres`, `migrate`, `app`, `nginx`.
- `nginx/default.conf` — reverse proxy конфиг.
- `.env.example` — шаблон env.
- `src/app/api/health/route.ts` — health endpoint для проверок.
- `db/migrations/001_init.sql` — базовая схема БД.

