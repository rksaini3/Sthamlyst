-- ============================================================
-- STHAMLY — SCHEMA v12
-- Adds: (1) Likes, Comments, Follows on reels — the social
--       engagement layer that was missing entirely.
--       (2) Settings: account edit, notification preferences,
--       language preference, all in one place.
--       (3) Long-form video support in the upload flow
--       (create_reel RPC now accepts it directly).
-- Run in Supabase SQL Editor AFTER the consolidated schema.
-- ============================================================

-- ---- Part 1: Settings ----
alter table public.profiles
  add column if not exists notification_prefs jsonb not null default
    '{"reward":true,"order":true,"social":true,"learning":true}',
  add column if not exists language text not null default 'hi-en';

create or replace function public.update_profile_settings(
  p_full_name text,
  p_city text,
  p_notification_prefs jsonb,
  p_language text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.profiles
    set full_name = coalesce(p_full_name, full_name),
        city = coalesce(p_city, city),
        notification_prefs = coalesce(p_notification_prefs, notification_prefs),
        language = coalesce(p_language, language)
    where id = auth.uid();
end;
$$;

-- ---- Part 2: Likes ----
create table if not exists public.likes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  lesson_id  uuid not null references public.lessons (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

alter table public.likes enable row level security;
drop policy if exists "Likes are public" on public.likes;
create policy "Likes are public" on public.likes for select using (true);

create or replace function public.toggle_like(p_lesson_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_exists boolean;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select exists(select 1 from public.likes where user_id = v_user and lesson_id = p_lesson_id) into v_exists;

  if v_exists then
    delete from public.likes where user_id = v_user and lesson_id = p_lesson_id;
    return false;
  else
    insert into public.likes (user_id, lesson_id) values (v_user, p_lesson_id);
    return true;
  end if;
end;
$$;

-- ---- Part 3: Comments ----
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  lesson_id  uuid not null references public.lessons (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists idx_comments_lesson on public.comments (lesson_id, created_at);

alter table public.comments enable row level security;
drop policy if exists "Comments are public" on public.comments;
create policy "Comments are public" on public.comments for select using (true);

create or replace function public.add_comment(p_lesson_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_new_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if length(trim(p_body)) = 0 then raise exception 'Comment cannot be empty'; end if;

  insert into public.comments (user_id, lesson_id, body)
  values (v_user, p_lesson_id, trim(p_body))
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- ---- Part 4: Follows ----
create table if not exists public.follows (
  follower_id  uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

alter table public.follows enable row level security;
drop policy if exists "Follows are public" on public.follows;
create policy "Follows are public" on public.follows for select using (true);

create or replace function public.toggle_follow(p_target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_exists boolean;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if v_user = p_target_user_id then raise exception 'Cannot follow yourself'; end if;

  select exists(
    select 1 from public.follows where follower_id = v_user and following_id = p_target_user_id
  ) into v_exists;

  if v_exists then
    delete from public.follows where follower_id = v_user and following_id = p_target_user_id;
    return false;
  else
    insert into public.follows (follower_id, following_id) values (v_user, p_target_user_id);
    return true;
  end if;
end;
$$;

-- ---- Part 5: long-form video directly in create_reel ----
create or replace function public.create_reel(
  p_title text,
  p_description text,
  p_video_url text,
  p_craft_theme text,
  p_quiz_questions jsonb,
  p_tagged_product_id uuid,
  p_long_form_video_url text default null,
  p_long_form_title text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_is_creator boolean;
  v_new_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select is_creator into v_is_creator from public.profiles where id = v_user;
  if not coalesce(v_is_creator, false) then
    raise exception 'Turn on Creator mode in your profile first';
  end if;

  insert into public.lessons
    (title, description, video_url, craft_theme, quiz_questions,
     points_reward, is_published, is_user_generated, creator_id, tagged_product_id,
     long_form_video_url, long_form_title)
  values
    (p_title, p_description, p_video_url, p_craft_theme, p_quiz_questions,
     10, true, true, v_user, p_tagged_product_id,
     p_long_form_video_url, p_long_form_title)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- ============================================================
-- DONE.
--  - toggle_like(lesson_id), add_comment(lesson_id, body),
--    toggle_follow(user_id), update_profile_settings(...)
--  - create_reel() now accepts optional long-form video directly
-- ============================================================
