# Запуск проекта через Docker Compose

## 1) Предусловия

- Установлен Docker Desktop (или Docker Engine + Compose Plugin)
- Свободен порт `3000`

## 2) Сборка и запуск

Из корня проекта выполнить:

```bash
docker compose up --build -d
```

После запуска приложение доступно по адресу:

```text
http://localhost:3000
```

## 3) Проверка статуса

```bash
docker compose ps
docker compose logs -f lak-learn-frontend
```

## 4) Остановка

```bash
docker compose down
```

## 5) Пересборка после изменений

```bash
docker compose down
docker compose up --build -d
```

## 6) Полная очистка (опционально)

```bash
docker compose down --rmi local --volumes --remove-orphans
```

