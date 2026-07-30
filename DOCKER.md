# Запуск финальной версии через Docker Compose

## 1) Предусловия

- Установлен Docker Desktop (или Docker Engine + Compose Plugin)
- Свободен порт `80` (Nginx)

## 2) Подготовка переменных окружения

```bash
cp .env.example .env
```

Отредактировать `.env` и обязательно заменить секреты JWT.

## 3) Сборка и запуск

Из корня проекта выполнить:

```bash
docker compose up --build -d
```

Запускаются сервисы:

- `postgres` — база данных
- `migrate` — применение **только ещё не применённых** SQL-миграций из `db/migrations` (учёт в таблице `schema_migrations`)
- `app` — Next.js приложение (frontend + API)
- `nginx` — reverse proxy

### Миграции вручную (локально)

Нужны `psql` и доступный Postgres. Из корня:

```bash
export PGPASSWORD=lak_password
export POSTGRES_USER=lak_user
export POSTGRES_DB=lak_learn
export PGHOST=localhost
./db/migrate.sh ./db/migrations
```

Или одной командой через Compose:

```bash
docker compose run --rm migrate
```

Повторный прогон безопасен: уже записанные файлы пропускаются.

### Стартовый админ

После миграций создаётся пользователь с ролью `admin`:

- email: `admin@laklearn.local`
- password: `Admin123!`

В проде сразу смените пароль (или удалите пользователя).

## 4) Проверка статуса

```bash
docker compose ps
docker compose logs -f postgres
docker compose logs -f app
docker compose logs -f nginx
```

## 5) Проверка доступности

- Приложение: `http://localhost`
- Health API: `http://localhost/api/health`

## 6) Остановка

```bash
docker compose down
```

## 7) Пересборка после изменений

```bash
docker compose down
docker compose up --build -d
```

## 8) Полная очистка (опционально)

```bash
docker compose down --rmi local --volumes --remove-orphans
```
