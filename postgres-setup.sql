-- ============================================
-- POSTGRESQL SETUP FOR LAK LEARN (WITHOUT SUPABASE)
-- ============================================

create extension if not exists pgcrypto;

-- 1) USERS (local auth storage)
create table if not exists public.users (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    password_hash text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 2) PROFILES (1:1 с users)
create table if not exists public.profiles (
    id uuid primary key references public.users(id) on delete cascade,
    username text not null check (char_length(trim(username)) >= 3),
    is_admin boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_is_admin on public.profiles(is_admin);

-- 3) USER PROGRESS (1:1)
create table if not exists public.user_progress (
    user_id uuid primary key references public.users(id) on delete cascade,
    learned_words bigint[] not null default '{}',
    quiz_correct integer not null default 0,
    quiz_wrong integer not null default 0,
    theme text not null default 'light' check (theme in ('light', 'dark')),
    current_card_index integer not null default 0,
    updated_at timestamptz not null default now()
);

-- 4) GLOBAL WORDS DICTIONARY
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

drop trigger if exists trg_users_set_updated_at on public.users;
create trigger trg_users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

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

