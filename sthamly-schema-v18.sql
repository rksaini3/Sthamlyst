-- ============================================================
-- STHAMLY — SCHEMA v18
-- (1) Creator identity fields (username/handle, bio, avatar)
-- (2) Mohalla Score — collective area-based coin target, unlocks
--     a bonus for everyone in that mohalla when hit
-- (3) Sathi Streak — two users' streaks are linked; either missing
--     a day breaks it for both
-- (4) Verified Teacher badge — auto-awarded once a creator's
--     lessons have been completed by 5+ distinct students
-- (5) Local Business Chain Reaction — nearby sellers get notified
--     when a seller crosses a customer milestone (FOMO -> onboarding)
-- Run in Supabase SQL Editor AFTER the consolidated schema.
-- ============================================================

-- ------------------------------------------------------------
-- PART 1 — CREATOR IDENTITY
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists username   text unique,
  add column if not exists bio        text,
  add column if not exists avatar_url text,
  add column if not exists mohalla    text; -- local area/neighbourhood name

create or replace function public.update_creator_identity(
  p_username text,
  p_bio text,
  p_avatar_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_username is not null and length(trim(p_username)) < 3 then
    raise exception 'Handle must be at least 3 characters';
  end if;

  update public.profiles
    set username = coalesce(nullif(trim(p_username), ''), username),
        bio = coalesce(p_bio, bio),
        avatar_url = coalesce(p_avatar_url, avatar_url)
    where id = auth.uid();
exception
  when unique_violation then
    raise exception 'Ye handle already liya ja chuka hai — dusra try karo';
end;
$$;

-- Storage bucket for avatars
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Public can view avatars" on storage.objects;
create policy "Public can view avatars" on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists "Users upload avatars into their own folder" on storage.objects;
create policy "Users upload avatars into their own folder"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ------------------------------------------------------------
-- PART 2 — MOHALLA SCORE (collective weekly area target)
-- ------------------------------------------------------------
create table if not exists public.mohalla_scores (
  mohalla       text not null,
  week_start    date not null,   -- Monday of the week, e.g. date_trunc('week', now())
  total_coins   integer not null default 0,
  bonus_unlocked boolean not null default false,
  primary key (mohalla, week_start)
);

alter table public.mohalla_scores enable row level security;
drop policy if exists "Mohalla scores are public" on public.mohalla_scores;
create policy "Mohalla scores are public" on public.mohalla_scores for select using (true);

-- Adds points to the user's mohalla's weekly total whenever they earn
-- coins (from either quiz or watch reward) — reuses the same trigger
-- pattern as notifications.
create or replace function public.bump_mohalla_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mohalla text;
  v_week date := date_trunc('week', now())::date;
  v_new_total integer;
begin
  select mohalla into v_mohalla from public.profiles where id = new.user_id;
  if v_mohalla is null then return new; end if;

  insert into public.mohalla_scores (mohalla, week_start, total_coins)
  values (v_mohalla, v_week, new.points_earned)
  on conflict (mohalla, week_start)
  do update set total_coins = public.mohalla_scores.total_coins + new.points_earned
  returning total_coins into v_new_total;

  -- Unlock a one-time bonus notification for the mohalla every 10,000 coins
  if v_new_total >= 10000 and not exists (
    select 1 from public.mohalla_scores where mohalla = v_mohalla and week_start = v_week and bonus_unlocked = true
  ) then
    update public.mohalla_scores set bonus_unlocked = true where mohalla = v_mohalla and week_start = v_week;
    insert into public.notifications (user_id, category, title, body)
    select id, 'reward', '🎉 Mohalla Bonus Unlocked!',
           v_mohalla || ' ne is hafte 10,000 coins paar kar liye — sabko ek extra local bonus mila!'
    from public.profiles where mohalla = v_mohalla;
  end if;

  return new;
end;
$$;

drop trigger if exists bump_mohalla_from_lesson on public.lesson_completions;
create trigger bump_mohalla_from_lesson
  after insert on public.lesson_completions
  for each row execute procedure public.bump_mohalla_score();

drop trigger if exists bump_mohalla_from_watch on public.watch_rewards;
create trigger bump_mohalla_from_watch
  after insert on public.watch_rewards
  for each row execute procedure public.bump_mohalla_score();

-- ------------------------------------------------------------
-- PART 3 — SATHI STREAK (paired accountability streak)
-- ------------------------------------------------------------
create table if not exists public.sathi_pairs (
  id              uuid primary key default gen_random_uuid(),
  user_a          uuid not null references public.profiles (id) on delete cascade,
  user_b          uuid not null references public.profiles (id) on delete cascade,
  status          text not null default 'pending' check (status in ('pending','active','broken')),
  streak_count    integer not null default 0,
  last_active_a   date,
  last_active_b   date,
  created_at      timestamptz not null default now(),
  check (user_a <> user_b),
  unique (user_a, user_b)
);

alter table public.sathi_pairs enable row level security;
drop policy if exists "Sathi pair members can view it" on public.sathi_pairs;
create policy "Sathi pair members can view it"
  on public.sathi_pairs for select
  using (auth.uid() = user_a or auth.uid() = user_b);

create or replace function public.invite_sathi(p_target_user_id uuid)
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
  if v_user = p_target_user_id then raise exception 'Khud ko Sathi nahi bana sakte'; end if;

  insert into public.sathi_pairs (user_a, user_b, status)
  values (v_user, p_target_user_id, 'pending')
  on conflict (user_a, user_b) do nothing
  returning id into v_new_id;

  return v_new_id;
end;
$$;

create or replace function public.accept_sathi(p_pair_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.sathi_pairs
    set status = 'active', last_active_a = current_date, last_active_b = current_date
    where id = p_pair_id and user_b = auth.uid() and status = 'pending';
end;
$$;

-- Mark today's activity for whichever side of the pair the current
-- user is on — called once per day, e.g. right after any coin-earning
-- action, so the streak only counts genuinely active days.
create or replace function public.mark_sathi_active_today()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then return; end if;

  update public.sathi_pairs
    set last_active_a = current_date
    where user_a = v_user and status = 'active' and (last_active_a is null or last_active_a < current_date);

  update public.sathi_pairs
    set last_active_b = current_date
    where user_b = v_user and status = 'active' and (last_active_b is null or last_active_b < current_date);

  -- If both sides were active today for the first time today, bump the streak
  update public.sathi_pairs
    set streak_count = streak_count + 1
    where (user_a = v_user or user_b = v_user)
      and status = 'active'
      and last_active_a = current_date and last_active_b = current_date
      and streak_count < (current_date - created_at::date); -- avoid double counting same day
end;
$$;

-- Daily job: any pair where one side missed yesterday breaks the streak
create or replace function public.check_broken_sathi_streaks()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sathi_pairs
    set status = 'broken', streak_count = 0
    where status = 'active'
      and (
        coalesce(last_active_a, '1970-01-01') < current_date - interval '1 day' or
        coalesce(last_active_b, '1970-01-01') < current_date - interval '1 day'
      );
end;
$$;

select cron.schedule(
  'check-sathi-streaks-daily',
  '5 0 * * *',
  $$select public.check_broken_sathi_streaks();$$
) where not exists (
  select 1 from cron.job where jobname = 'check-sathi-streaks-daily'
);

-- ------------------------------------------------------------
-- PART 4 — VERIFIED TEACHER BADGE
-- ------------------------------------------------------------
create or replace function public.check_verified_teacher()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator_id uuid;
  v_theme text;
  v_student_count integer;
  v_badges jsonb;
  v_badge_name text;
begin
  select l.creator_id, l.craft_theme into v_creator_id, v_theme
    from public.lessons l where l.id = new.lesson_id and l.is_user_generated = true;

  if v_creator_id is null then return new; end if;

  select count(distinct lc.user_id) into v_student_count
    from public.lesson_completions lc
    join public.lessons l on l.id = lc.lesson_id
    where l.creator_id = v_creator_id and l.craft_theme = v_theme;

  if v_student_count >= 5 then
    v_badge_name := 'Verified Teacher of ' || v_theme;
    select skill_badges into v_badges from public.profiles where id = v_creator_id;
    if not (v_badges @> to_jsonb(v_badge_name)) then
      update public.profiles
        set skill_badges = skill_badges || to_jsonb(v_badge_name)
        where id = v_creator_id;
      insert into public.notifications (user_id, category, title, body)
      values (v_creator_id, 'learning', '🏅 Verified Teacher Badge!',
              'Aapke ' || v_theme || ' lessons se 5+ students seekh chuke hain — aap ab "Verified Teacher" hain!');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists award_verified_teacher on public.lesson_completions;
create trigger award_verified_teacher
  after insert on public.lesson_completions
  for each row execute procedure public.check_verified_teacher();

-- ------------------------------------------------------------
-- PART 5 — LOCAL BUSINESS CHAIN REACTION
-- ------------------------------------------------------------
-- When a seller crosses a customer milestone (5, 20, 50... distinct
-- buyers), nearby sellers in the same city get a FOMO notification.
create or replace function public.check_business_milestone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_id uuid;
  v_seller_name text;
  v_seller_city text;
  v_customer_count integer;
begin
  select seller_id into v_seller_id from public.orders where id = new.order_id;
  if v_seller_id is null then return new; end if;

  select full_name, city into v_seller_name, v_seller_city from public.profiles where id = v_seller_id;

  select count(distinct buyer_id) into v_customer_count
    from public.orders where seller_id = v_seller_id and status in ('paid','completed');

  if v_customer_count in (5, 20, 50, 100) then
    insert into public.notifications (user_id, category, title, body)
    select id, 'social', '📈 Nearby Business Update',
           coalesce(v_seller_name, 'Ek local seller') || ' ne is hafte ' || v_customer_count ||
           ' customers Sthamly se paaye — aap bhi apni dukaan list karo!'
    from public.profiles
    where city = v_seller_city and is_seller = false and id <> v_seller_id
    limit 100; -- cap the notification fan-out
  end if;

  return new;
end;
$$;

drop trigger if exists notify_business_milestone on public.commission_ledger;
create trigger notify_business_milestone
  after insert on public.commission_ledger
  for each row execute procedure public.check_business_milestone();

-- ============================================================
-- DONE.
--  - update_creator_identity(username, bio, avatar_url)
--  - Mohalla Score auto-tracked, bonus notification at 10k/week
--  - invite_sathi() / accept_sathi() / mark_sathi_active_today()
--  - Verified Teacher badge auto-awarded at 5+ distinct students
--  - Nearby non-seller profiles notified at seller milestones
-- ============================================================

-- RPC: set my mohalla/local-area name (used by Mohalla Score)
create or replace function public.update_my_mohalla(p_mohalla text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.profiles set mohalla = nullif(trim(p_mohalla), '') where id = auth.uid();
end;
$$;
