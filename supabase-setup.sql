-- ============================================
-- SUPABASE SETUP FOR LAK LEARN
-- ============================================

-- 1) PROFILES (1:1 с auth.users)
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    username text not null check (char_length(trim(username)) >= 3),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 2) USER PROGRESS (1:1 с пользователем)
create table if not exists public.user_progress (
    user_id uuid primary key references auth.users(id) on delete cascade,
    learned_words bigint[] not null default '{}',
    quiz_correct integer not null default 0,
    quiz_wrong integer not null default 0,
    theme text not null default 'light' check (theme in ('light', 'dark')),
    current_card_index integer not null default 0,
    updated_at timestamptz not null default now()
);

-- 3) GLOBAL WORDS DICTIONARY
create table if not exists public.words (
    id bigint generated always as identity primary key,
    lak text not null,
    ru text not null,
    transcription text not null,
    category text not null,
    example text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_words_category on public.words(category);
create index if not exists idx_words_lak on public.words(lak);
create index if not exists idx_words_ru on public.words(ru);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_progress_set_updated_at on public.user_progress;
create trigger trg_user_progress_set_updated_at
before update on public.user_progress
for each row execute function public.set_updated_at();

drop trigger if exists trg_words_set_updated_at on public.words;
create trigger trg_words_set_updated_at
before update on public.words
for each row execute function public.set_updated_at();

-- ============================================
-- OPTIONAL: AUTO PROFILE CREATION ON SIGNUP
-- ============================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1), 'Пользователь')
  )
  on conflict (id) do nothing;

  insert into public.user_progress (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================
-- RLS + POLICIES
-- ============================================

alter table public.profiles enable row level security;
alter table public.user_progress enable row level security;
alter table public.words enable row level security;

-- profiles: пользователь видит/меняет только себя
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- user_progress: пользователь видит/меняет только свой прогресс
drop policy if exists "progress_select_own" on public.user_progress;
create policy "progress_select_own"
on public.user_progress
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "progress_insert_own" on public.user_progress;
create policy "progress_insert_own"
on public.user_progress
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "progress_update_own" on public.user_progress;
create policy "progress_update_own"
on public.user_progress
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- words: общий словарь, чтение всем авторизованным
drop policy if exists "words_select_all_authenticated" on public.words;
create policy "words_select_all_authenticated"
on public.words
for select
to authenticated
using (true);

-- ============================================
-- FIRST DATA LOAD (manual)
-- ============================================
-- Импортируй слова из файла data/words.json через Supabase Table Editor:
-- public.words -> Insert -> Import data (JSON/CSV)

