-- ============================================
-- ADMIN ROLLBACK FOR LAK LEARN
-- ============================================

-- 1) Удаляем RPC для просмотра пользователей
drop function if exists public.admin_list_users();

-- 2) Удаляем админ-политики для изменения слов
drop policy if exists "words_insert_admin" on public.words;
drop policy if exists "words_update_admin" on public.words;
drop policy if exists "words_delete_admin" on public.words;

-- 3) Удаляем индекс и поле администратора
drop index if exists public.idx_profiles_is_admin;

alter table public.profiles
    drop column if exists is_admin;

