-- 동네 광장 profile schema


-- Run this in Supabase Dashboard > SQL Editor.
-- This script does not create or expose any service_role credential.

create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    nickname text not null check (char_length(trim(nickname)) between 2 and 24),
    icon text not null default '🌱',
    trust_score integer not null default 50 check (trust_score between 0 and 100),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

-- Case-insensitive uniqueness prevents both "Walker" and "walker".
create unique index if not exists profiles_nickname_lower_unique
    on public.profiles (lower(trim(nickname)));

create table if not exists public.private_profiles (
    user_id uuid primary key references auth.users (id) on delete cascade,
    name text not null check (char_length(trim(name)) between 1 and 100),
    gender text check (gender in ('male', 'female')),
    age integer check (age between 20 and 100),
    age_group text,
    phone text,
    verification_method text check (verification_method in ('phone', 'email')),
    privacy_consent boolean not null default false,
    marketing_consent boolean not null default false,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles enable row level security;
alter table public.private_profiles enable row level security;

drop policy if exists "profiles are publicly readable" on public.profiles;
create policy "profiles are publicly readable"
    on public.profiles for select
    to anon, authenticated
    using (true);

drop policy if exists "users can create their own profile" on public.profiles;
create policy "users can create their own profile"
    on public.profiles for insert
    to authenticated
    with check ((select auth.uid()) = id);

drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
    on public.profiles for update
    to authenticated
    using ((select auth.uid()) = id)
    with check ((select auth.uid()) = id);

drop policy if exists "users can read their own private profile" on public.private_profiles;
create policy "users can read their own private profile"
    on public.private_profiles for select
    to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "users can create their own private profile" on public.private_profiles;
create policy "users can create their own private profile"
    on public.private_profiles for insert
    to authenticated
    with check ((select auth.uid()) = user_id);

drop policy if exists "users can update their own private profile" on public.private_profiles;
create policy "users can update their own private profile"
    on public.private_profiles for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

-- Create both profile rows from the trusted auth.users insert event.
-- This is needed when Confirm email is enabled because signUp() may return
-- without an authenticated session, so the browser must not bypass RLS.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
    raw_age text := new.raw_user_meta_data ->> 'age';
begin
    insert into public.profiles (id, nickname, icon, trust_score)
    values (
        new.id,
        '이웃-' || left(replace(new.id::text, '-', ''), 8),
        '🌱',
        50
    )
    on conflict (id) do nothing;

    insert into public.private_profiles (
        user_id, name, gender, age, age_group, phone,
        verification_method, privacy_consent, marketing_consent
    )
    values (
        new.id,
        coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), '새로운 사용자'),
        case
            when new.raw_user_meta_data ->> 'gender' in ('male', 'female')
                then new.raw_user_meta_data ->> 'gender'
            else null
        end,
        case when raw_age ~ '^\d+$' then raw_age::integer else null end,
        nullif(new.raw_user_meta_data ->> 'age_group', ''),
        nullif(new.raw_user_meta_data ->> 'phone', ''),
        'email',
        coalesce((new.raw_user_meta_data ->> 'privacy_consent')::boolean, false),
        coalesce((new.raw_user_meta_data ->> 'marketing_consent')::boolean, false)
    )
    on conflict (user_id) do nothing;

    return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
