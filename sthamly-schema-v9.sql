-- ============================================================
-- STHAMLY — SCHEMA v9
-- (1) One-time cleanup: earlier re-runs of the seed data (before
--     this fix) inserted duplicate rows, because the lessons/products
--     tables had no real uniqueness for "on conflict do nothing" to
--     catch (every row's id is a fresh random UUID, so nothing ever
--     conflicted). This removes the duplicates, keeping the oldest
--     row for each repeated title.
-- (2) Adds `long_form_video_url` to lessons — the founder's plan
--     defines the Core MVP as "Reel + Long Video + Quiz + Coins +
--     Creator + Commerce." Reels stay short (discovery); an optional
--     "See Full Lesson" long-form video is where real learning/mastery
--     happens, matching the plan's Short-Form vs Long-Form architecture.
-- Run in Supabase SQL Editor AFTER the consolidated schema.
-- ============================================================

-- ---- Part 1: de-duplicate lessons (keep oldest per exact title) ----
delete from public.lesson_completions
where lesson_id in (
  select id from (
    select id, row_number() over (
      partition by title order by created_at asc
    ) as rn
    from public.lessons
  ) ranked
  where rn > 1
);

delete from public.lessons
where id in (
  select id from (
    select id, row_number() over (
      partition by title order by created_at asc
    ) as rn
    from public.lessons
  ) ranked
  where rn > 1
);

-- ---- Part 1b: de-duplicate products (keep oldest per exact title) ----
-- Only removes rows with no real owner (maker_id is null) — i.e. the
-- original seed data — so we never accidentally delete something a
-- real seller listed through the app.
delete from public.products
where maker_id is null
  and id in (
    select id from (
      select id, row_number() over (
        partition by title order by created_at asc
      ) as rn
      from public.products
      where maker_id is null
    ) ranked
    where rn > 1
  );

-- ---- Part 2: long-form video support ----
alter table public.lessons
  add column if not exists long_form_video_url text,
  add column if not exists long_form_title text;

-- ============================================================
-- DONE. lessons.long_form_video_url now available — the app's
-- reel card shows a "See Full Lesson →" link whenever it's set.
-- ============================================================
