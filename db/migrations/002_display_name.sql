-- Миграция 002: добавить display_name для пользователей
-- Запускать после 001_init.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(64);