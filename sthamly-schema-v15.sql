-- ============================================================
-- STHAMLY — SCHEMA v15
-- Dual reward: a small "watch reward" for finishing a video (no
-- quiz needed), and the existing bigger quiz reward stays as-is.
-- This keeps the core "verified learning, not passive scroll"
-- principle intact — watch reward is small and capped once per
-- lesson, so it can't be farmed like unlimited scroll-rewards.
-- Run in Supabase SQL Editor AFTER the consolidated schema.
-- ============================================================

alter table public.lessons
  add column if not exists watch_reward integer not null default 2;

create table if not exists public.watch_rewards (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  lesson_id     uuid not null references public.lessons (id) on delete cascade,
  points_earned integer not null,
  created_at    timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

alter table public.watch_rewards enable row level security;
drop policy if exists "Users see their own watch rewards" on public.watch_rewards;
create policy "Users see their own watch rewards"
  on public.watch_rewards for select
  using (auth.uid() = user_id);

create or replace function public.award_watch_reward(p_lesson_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_points integer;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select watch_reward into v_points from public.lessons where id = p_lesson_id and is_published = true;
  if v_points is null then raise exception 'Lesson not found'; end if;

  insert into public.watch_rewards (user_id, lesson_id, points_earned)
  values (v_user, p_lesson_id, v_points)
  on conflict (user_id, lesson_id) do nothing;

  if found then
    update public.profiles
      set sthamly_points = sthamly_points + v_points,
          points_expire_at = now() + interval '30 days'
      where id = v_user;
    return v_points;
  end if;

  return 0; -- already awarded for this lesson before
end;
$$;

-- ============================================================
-- DONE. award_watch_reward(lesson_id) gives a small, one-time-only
-- coin bonus just for finishing a video — quiz still gives the
-- bigger reward and remains fully optional, never mandatory.
-- ============================================================
