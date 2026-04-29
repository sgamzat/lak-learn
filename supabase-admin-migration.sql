-- ============================================
-- ADMIN MIGRATION FOR LAK LEARN
-- ============================================

-- 1) Добавляем флаг администратора в profiles
alter table public.profiles
    add column if not exists is_admin boolean not null default false;

create index if not exists idx_profiles_is_admin on public.profiles(is_admin);

-- 2) Политики на изменение словаря: только администратор
drop policy if exists "words_insert_admin" on public.words;
create policy "words_insert_admin"
on public.words
for insert
to authenticated
with check (
    exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.is_admin = true
    )
);

drop policy if exists "words_update_admin" on public.words;
create policy "words_update_admin"
on public.words
for update
to authenticated
using (
    exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.is_admin = true
    )
)
with check (
    exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.is_admin = true
    )
);

drop policy if exists "words_delete_admin" on public.words;
create policy "words_delete_admin"
on public.words
for delete
to authenticated
using (
    exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.is_admin = true
    )
);

-- 3) RPC для чтения пользователей (только администратор)
create or replace function public.admin_list_users()
returns table (
    id uuid,
    username text,
    email text,
    created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if not exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.is_admin = true
    ) then
        raise exception 'Недостаточно прав' using errcode = '42501';
    end if;

    return query
    select
        p.id,
        p.username,
        u.email,
        p.created_at
    from public.profiles p
    left join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

grant execute on function public.admin_list_users() to authenticated;

-- 4) Назначение первого администратора (выполнить вручную)
-- UUID_АДМИНА = id пользователя из auth.users / public.profiles,
-- обычно это ваш аккаунт, под которым вы входите в приложение.
--
-- Шаг 4.1: найти нужный id (выполнить и посмотреть результат)
select p.id, p.username, u.email
from public.profiles p
left join auth.users u on u.id = p.id
order by p.created_at desc;
--
-- Шаг 4.2: взять id из результата выше и подставить в update:
update public.profiles
set is_admin = true
where id = 'd827a9b2-f14d-435e-a2d2-803d37bd7541';
