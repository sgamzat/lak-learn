-- Stage 1 migration for importing `lak_words.html`
-- Adds source-aware fields to `public.words` and introduces
-- tables for alphabet + phrasebook structures.

begin;

alter table public.words
    add column if not exists source text not null default 'manual',
    add column if not exists source_section text not null default '',
    add column if not exists order_index integer,
    add column if not exists normalized_key text;

create index if not exists idx_words_source on public.words(source);
create index if not exists idx_words_source_section on public.words(source, source_section);
create index if not exists idx_words_normalized_key on public.words(normalized_key);

create table if not exists public.alphabet_letters (
    id bigint generated always as identity primary key,
    source text not null default 'digiev_html',
    order_index integer not null,
    row_index integer not null,
    col_index integer not null,
    pair_text text not null,
    letter_upper text not null,
    letter_lower text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (source, order_index)
);

create index if not exists idx_alphabet_letters_source on public.alphabet_letters(source);

create table if not exists public.phrasebook_sections (
    id bigint generated always as identity primary key,
    source text not null default 'digiev_html',
    source_section text not null,
    title_ru text not null,
    title_lak text,
    section_type text not null check (section_type in ('phrasebook', 'dictionary')),
    order_index integer not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (source, source_section)
);

create index if not exists idx_phrasebook_sections_type on public.phrasebook_sections(section_type, order_index);

create table if not exists public.phrasebook_entries (
    id bigint generated always as identity primary key,
    section_id bigint not null references public.phrasebook_sections(id) on delete cascade,
    source text not null default 'digiev_html',
    source_section text not null,
    order_index integer not null,
    ru text not null,
    lak text not null,
    normalized_key text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (section_id, order_index)
);

create index if not exists idx_phrasebook_entries_section on public.phrasebook_entries(section_id, order_index);
create index if not exists idx_phrasebook_entries_normalized_key on public.phrasebook_entries(normalized_key);

create table if not exists public.reading_notes (
    id bigint generated always as identity primary key,
    source text not null default 'digiev_html',
    note_type text not null check (note_type in ('note', 'rule')),
    order_index integer not null,
    title text not null,
    content text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_reading_notes_source_type on public.reading_notes(source, note_type, order_index);

drop trigger if exists trg_alphabet_letters_set_updated_at on public.alphabet_letters;
create trigger trg_alphabet_letters_set_updated_at
before update on public.alphabet_letters
for each row execute function public.set_updated_at();

drop trigger if exists trg_phrasebook_sections_set_updated_at on public.phrasebook_sections;
create trigger trg_phrasebook_sections_set_updated_at
before update on public.phrasebook_sections
for each row execute function public.set_updated_at();

drop trigger if exists trg_phrasebook_entries_set_updated_at on public.phrasebook_entries;
create trigger trg_phrasebook_entries_set_updated_at
before update on public.phrasebook_entries
for each row execute function public.set_updated_at();

drop trigger if exists trg_reading_notes_set_updated_at on public.reading_notes;
create trigger trg_reading_notes_set_updated_at
before update on public.reading_notes
for each row execute function public.set_updated_at();

commit;
