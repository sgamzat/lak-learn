FROM python:3.11-slim as builder

WORKDIR /app

# Установка зависимостей для сборки
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Копируем только requirements.txt для кэширования
COPY requirements.txt .

# Устанавливаем зависимости в отдельную директорию
RUN pip install --user --no-cache-dir -r requirements.txt

# Финальный образ
FROM python:3.11-slim

WORKDIR /app

# Установка runtime зависимостей
RUN apt-get update && apt-get install -y \
    postgresql-client \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Копируем установленные пакеты из builder
COPY --from=builder /root/.local /root/.local

# Копируем проект
COPY . .

# Добавляем user installed packages в PATH
ENV PATH=/root/.local/bin:$PATH

# Создаем директории для статики и медиа
RUN mkdir -p /app/staticfiles /app/media

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000"]
