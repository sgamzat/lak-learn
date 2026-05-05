# lak-learn

MVP веб-приложения для изучения лакского языка по SRS, реализуемый строго по [`TECHNICAL_SPECIFICATION.md`](TECHNICAL_SPECIFICATION.md).

## Текущий статус

Выполнен каркас и MVP-слой приложения:

- `backend/` FastAPI skeleton + `healthz` и `readyz`
- `frontend/` Next.js skeleton + `api/readyz`
- `infra/` docker compose + nginx reverse proxy
- Реализованы API: `auth`, `study`, `stats`, `dictionary`, `admin import/export`
- Реализованы страницы: `/`, `/study`, `/dictionary`, `/admin/import`, `/profile`, `/login`, `/register`
- Добавлен PWA базис: `manifest.json`, `sw.js`
- Добавлен CI workflow и начальные тесты backend

## Быстрый старт

1. Скопировать окружение:

```bash
cp .env.example .env
```

2. Запустить контейнеры:

```bash
docker compose -f infra/docker-compose.yml up -d --build
```

3. Проверить:

- `http://localhost/` frontend
- `http://localhost/healthz` backend health

4. Применить миграции БД:

```bash
docker compose -f infra/docker-compose.yml exec backend alembic upgrade head
```

## Пошагово: как обновить проект через Git и запустить через Docker Compose


2. Проверить текущую ветку (обычно `main`):

```bash
git branch --show-current
```

3. Подтянуть последние изменения:

```bash
git pull origin main
```

4. Создать локальный `.env` из шаблона (если ещё не создан):

```bash
cp .env.example .env
```

5. Собрать и поднять сервисы:

```bash
docker compose -f infra/docker-compose.yml up -d --build
```

6. Применить миграции базы данных:

```bash
docker compose -f infra/docker-compose.yml exec backend alembic upgrade head
```

7. Проверить, что контейнеры healthy:

```bash
docker compose -f infra/docker-compose.yml ps
```

8. Проверить доступность приложения:

- Frontend: `http://localhost/`
- Backend health: `http://localhost/healthz`

9. Посмотреть логи при проблемах:

```bash
docker compose -f infra/docker-compose.yml logs -f
```

10. Остановить проект:

```bash
docker compose -f infra/docker-compose.yml down
```
