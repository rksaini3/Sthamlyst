-- ============================================================
-- STHAMLY — SCHEMA v10
-- Adds a real Stories feature (like Instagram/WhatsApp Status):
-- any signed-in user can post a photo/video that's visible to
-- everyone for 24 hours, then automatically disappears.
-- Run in Supabase SQL Editor AFTER the consolidated schema.
-- ============================================================

create table if not exists public.stories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  media_url   text not null,
  media_type  text not null check (media_type in ('image','video')),
  caption     text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '24 hours')
);

create index if not exists idx_stories_active on public.stories (expires_at, user_id);

-- RPC: post a story (keeps writes server-validated, consistent with
-- the rest of the app's pattern)
create or replace function public.create_story(
  p_media_url text,
  p_media_type text,
  p_caption text default null
)
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
  if p_media_type not in ('image','video') then raise exception 'Invalid media type'; end if;

  insert into public.stories (user_id, media_url, media_type, caption)
  values (v_user, p_media_url, p_media_type, p_caption)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

alter table public.stories enable row level security;

drop policy if exists "Active stories are public" on public.stories;
create policy "Active stories are public"
  on public.stories for select
  using (expires_at > now());

-- Storage bucket for story photos/videos
insert into storage.buckets (id, name, public)
values ('stories', 'stories', true)
on conflict (id) do nothing;

drop policy if exists "Public can view story media" on storage.objects;
create policy "Public can view story media"
  on storage.objects for select
  using (bucket_id = 'stories');

drop policy if exists "Users upload stories into their own folder" on storage.objects;
create policy "Users upload stories into their own folder"
  on storage.objects for insert
  with check (bucket_id = 'stories' and (storage.foldername(name))[1] = auth.uid()::text);

-- Daily cleanup of expired stories (keeps the table small; storage
-- files are cheap to leave behind but rows are cleaned up)
create or replace function public.delete_expired_stories()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.stories where expires_at < now();
end;
$$;

select cron.schedule(
  'delete-expired-stories-daily',
  '30 0 * * *',
  $$select public.delete_expired_stories();$$
) where not exists (
  select 1 from cron.job where jobname = 'delete-expired-stories-daily'
);

-- ============================================================
-- DONE. create_story(media_url, media_type, caption) posts a story.
-- Stories auto-expire from view after 24h (RLS), and are fully
-- deleted from the table daily via pg_cron.
-- ============================================================
