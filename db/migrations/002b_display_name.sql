-- Миграция 002b: добавить display_name для пользователей
-- Запускать после 001_init.sql / 002_collections.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(64);