-- 동네 광장 Supabase MVP schema
-- Supabase SQL Editor에서 한 번 실행하세요.
-- 브라우저에는 publishable key만 사용하고, secret/service_role key는 사용하지 않습니다.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  login_id text not null unique check (login_id ~ '^[a-z0-9][a-z0-9_-]{3,23}$'),
  nickname text,
  name text not null,
  gender text not null check (gender in ('male', 'female')),
  age smallint not null check (age between 20 and 100),
  phone text not null,
  age_group text not null check (age_group in ('20s', '30s', '40s', '50plus')),
  verification_method text not null check (verification_method in ('phone', 'email')),
  marketing_consent boolean not null default false,
  trust_score numeric(5,2) not null default 50 check (trust_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_nickname_unique
  on public.profiles (lower(nickname))
  where nickname is not null;

create or replace function public.login_id_available(p_login_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles
    where login_id = lower(trim(p_login_id))
  );
$$;

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  host_nickname text not null,
  host_trust_score numeric(5,2) not null default 50 check (host_trust_score between 0 and 100),
  title text not null check (char_length(title) between 2 and 80),
  purpose text not null check (char_length(purpose) between 2 and 240),
  description text not null check (char_length(description) between 2 and 500),
  location text not null check (char_length(location) between 2 and 160),
  scheduled_at timestamptz not null,
  category text not null,
  category_family text not null,
  age_group text not null check (age_group in ('all', '20s', '30s', '40s', '50plus')),
  participant_count integer not null default 1 check (participant_count between 1 and 6),
  max_participants integer not null check (max_participants between 3 and 6),
  status text not null default 'pending' check (status in ('pending', 'recruiting', 'confirmed', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (participant_count <= max_participants)
);

create table if not exists public.activity_participants (
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'confirmed' check (status in ('confirmed', 'withdrawn', 'cancelled')),
  joined_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.activities enable row level security;
alter table public.activity_participants enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "activities_read_recruiting" on public.activities;
create policy "activities_read_recruiting"
  on public.activities for select to anon, authenticated
  using (status = 'recruiting' or (select auth.uid()) = creator_id);

drop policy if exists "activities_insert_own_pending" on public.activities;
create policy "activities_insert_own_pending"
  on public.activities for insert to authenticated
  with check (
    (select auth.uid()) = creator_id
    and status = 'pending'
    and participant_count = 1
  );

drop policy if exists "activities_update_own" on public.activities;
create policy "activities_update_own"
  on public.activities for update to authenticated
  using ((select auth.uid()) = creator_id)
  with check ((select auth.uid()) = creator_id);

drop policy if exists "participants_select_own" on public.activity_participants;
create policy "participants_select_own"
  on public.activity_participants for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "participants_insert_own" on public.activity_participants;
create policy "participants_insert_own"
  on public.activity_participants for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "participants_update_own" on public.activity_participants;
create policy "participants_update_own"
  on public.activity_participants for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "participants_delete_own" on public.activity_participants;
create policy "participants_delete_own"
  on public.activity_participants for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.join_activity(p_activity_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if exists (
    select 1 from public.activity_participants
    where activity_id = p_activity_id
      and user_id = auth.uid()
      and status = 'confirmed'
  ) then
    return jsonb_build_object('status', 'already_joined');
  end if;

  update public.activities
  set participant_count = participant_count + 1, updated_at = now()
  where id = p_activity_id
    and status = 'recruiting'
    and participant_count < max_participants
  returning participant_count into next_count;

  if next_count is null then
    return jsonb_build_object('status', 'full_or_unavailable');
  end if;

  insert into public.activity_participants (activity_id, user_id, status)
  values (p_activity_id, auth.uid(), 'confirmed')
  on conflict (activity_id, user_id)
  do update set status = 'confirmed', joined_at = now();

  return jsonb_build_object('status', 'joined', 'participant_count', next_count);
end;
$$;

create or replace function public.withdraw_activity(p_activity_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  update public.activity_participants
  set status = 'withdrawn'
  where activity_id = p_activity_id
    and user_id = auth.uid()
    and status = 'confirmed';

  if not found then
    return jsonb_build_object('status', 'not_joined');
  end if;

  update public.activities
  set participant_count = greatest(1, participant_count - 1), updated_at = now()
  where id = p_activity_id
  returning participant_count into next_count;

  return jsonb_build_object('status', 'withdrawn', 'participant_count', next_count);
end;
$$;

grant usage on schema public to anon, authenticated;
grant execute on function public.login_id_available(text) to anon, authenticated;
grant select on public.activities to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant insert, update on public.activities to authenticated;
grant select, insert, update, delete on public.activity_participants to authenticated;
grant execute on function public.join_activity(uuid) to authenticated;
grant execute on function public.withdraw_activity(uuid) to authenticated;
