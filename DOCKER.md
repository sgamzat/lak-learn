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
- `migrate` — одноразовое применение SQL-миграций из `db/migrations`
- `app` — Next.js приложение (frontend + API)
- `nginx` — reverse proxy

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
