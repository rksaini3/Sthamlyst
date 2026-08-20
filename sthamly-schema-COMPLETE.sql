-- ============================================================
-- STHAMLY — COMPLETE CONSOLIDATED SCHEMA (v2 through v8)
-- Safe to run on a FRESH Supabase project, OR re-run on a project
-- that already has some of these versions applied — every
-- statement is written to be idempotent (safe to repeat).
-- This replaces the need to track 6+ separate version files.
-- Supabase Dashboard → SQL Editor → New Query → paste all → Run
-- ============================================================

-- ---- from sthamly-learn-earn-schema.sql ----
-- ============================================================
-- STHAMLY — "LEARN & EARN" SCHEMA (v2)
-- Learn & Earn: Users → Lessons (with quiz + points) → Products
-- (Maker-made goods, points-based discount)
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. USERS (profiles) — now tracks Sthamly Points balance
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  full_name      text,
  phone          text,
  city           text default 'Gonda',
  sthamly_points integer not null default 0 check (sthamly_points >= 0),
  role           text not null default 'customer' check (role in ('customer','maker','admin')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------
-- 2. LESSONS — 1-min maker videos + a 2-question quiz
-- ------------------------------------------------------------
create table if not exists public.lessons (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text,
  video_url      text,
  craft_theme    text default 'Clay Crafts & Home Decor',  -- e.g. current pilot theme
  quiz_questions jsonb not null default '[]',
  -- shape: [{ "question": "...", "options": ["a","b","c"], "correct_index": 0 }, ...]
  points_reward  integer not null default 10,
  order_index    integer not null default 0,
  is_published   boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Tracks which users completed which lesson (prevents earning points twice)
create table if not exists public.lesson_completions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  lesson_id      uuid not null references public.lessons (id) on delete cascade,
  points_earned  integer not null,
  completed_at   timestamptz not null default now(),
  unique (user_id, lesson_id)
);

-- ------------------------------------------------------------
-- 3. PRODUCTS — local handmade goods, priced with a points discount
-- ------------------------------------------------------------
create table if not exists public.products (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  description       text,
  maker_name        text not null,          -- local artisan / maker
  maker_city        text default 'Gonda',
  price             numeric(10,2) not null check (price >= 0),
  image_url         text,                    -- expect ~280px preview
  category          text default 'Clay Crafts & Home Decor',
  max_discount_points integer not null default 0,  -- cap on points redeemable per order
  points_to_rupee_ratio numeric(6,2) not null default 1.0, -- 1 point = ₹1 off, adjustable
  stock             integer not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4. updated_at triggers
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at on public.lessons;
create trigger set_updated_at before update on public.lessons
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at on public.products;
create trigger set_updated_at before update on public.products
  for each row execute procedure public.set_updated_at();

-- ------------------------------------------------------------
-- 5. RPC: award points after a quiz pass (called from the app)
-- ------------------------------------------------------------
create or replace function public.complete_lesson(p_lesson_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points integer;
  v_user   uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select points_reward into v_points from public.lessons where id = p_lesson_id and is_published = true;
  if v_points is null then
    raise exception 'Lesson not found';
  end if;

  insert into public.lesson_completions (user_id, lesson_id, points_earned)
  values (v_user, p_lesson_id, v_points)
  on conflict (user_id, lesson_id) do nothing;

  if found then
    update public.profiles set sthamly_points = sthamly_points + v_points where id = v_user;
  end if;

  return v_points;
end;
$$;

-- ------------------------------------------------------------
-- 6. RPC: redeem points at checkout (deducts balance, returns discount ₹)
-- ------------------------------------------------------------
create or replace function public.redeem_points(p_product_id uuid, p_points_to_use integer)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_balance integer;
  v_max integer;
  v_ratio numeric;
  v_use integer;
  v_discount numeric;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select sthamly_points into v_balance from public.profiles where id = v_user;
  select max_discount_points, points_to_rupee_ratio into v_max, v_ratio
    from public.products where id = p_product_id and is_active = true;

  if v_max is null then raise exception 'Product not found'; end if;

  v_use := least(p_points_to_use, v_balance, v_max);
  v_discount := v_use * v_ratio;

  update public.profiles set sthamly_points = sthamly_points - v_use where id = v_user;

  return v_discount;
end;
$$;

-- ------------------------------------------------------------
-- 7. INDEXES
-- ------------------------------------------------------------
create index if not exists idx_lessons_published on public.lessons (is_published, order_index);
create index if not exists idx_products_active on public.products (is_active, category);
create index if not exists idx_completions_user on public.lesson_completions (user_id);

-- ------------------------------------------------------------
-- 8. ROW LEVEL SECURITY
-- ------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.lessons            enable row level security;
alter table public.lesson_completions enable row level security;
alter table public.products           enable row level security;

drop policy if exists "Profiles viewable by owner" on public.profiles;
create policy "Profiles viewable by owner" on public.profiles for select using (auth.uid() = id);
drop policy if exists "Profiles editable by owner" on public.profiles;
create policy "Profiles editable by owner" on public.profiles for update using (auth.uid() = id);

drop policy if exists "Published lessons are public" on public.lessons;
create policy "Published lessons are public" on public.lessons for select using (is_published = true);

drop policy if exists "Users see their own completions" on public.lesson_completions;
create policy "Users see their own completions" on public.lesson_completions for select using (auth.uid() = user_id);

drop policy if exists "Active products are public" on public.products;
create policy "Active products are public" on public.products for select using (is_active = true);

-- Note: points are only ever changed via the complete_lesson() and
-- redeem_points() functions above (security definer) — never directly
-- from the client, so a user cannot fake their own point balance.

-- ------------------------------------------------------------
-- 9. SEED DATA — pilot theme: Clay Crafts & Home Decor (Gonda)
--    Uses "insert ... where not exists" instead of "on conflict do
--    nothing", because these tables have no unique constraint for
--    ON CONFLICT to actually catch (id is a fresh random UUID every
--    time) — the old approach silently re-inserted duplicates on
--    every re-run of this script.
-- ------------------------------------------------------------
insert into public.lessons (title, description, video_url, craft_theme, quiz_questions, points_reward, order_index)
select
  'How Mrs. Sharma Makes Clay Diyas',
  'A 1-minute look at hand-shaping clay diyas the traditional way.',
  null,
  'Clay Crafts & Home Decor',
  '[
    {"question":"What is the diya mainly made from?","options":["Plastic","Clay","Metal"],"correct_index":1},
    {"question":"Where is Mrs. Sharma based?","options":["Gonda","Mumbai","Delhi"],"correct_index":0}
  ]'::jsonb,
  10, 1
where not exists (
  select 1 from public.lessons where title = 'How Mrs. Sharma Makes Clay Diyas'
);

insert into public.products (title, description, maker_name, maker_city, price, category, max_discount_points, points_to_rupee_ratio, stock)
select 'Hand-Painted Clay Diya (Set of 4)', 'Traditional clay diyas, hand-painted by local artisans.', 'Mrs. Sharma', 'Gonda', 149.00, 'Clay Crafts & Home Decor', 50, 1.0, 100
where not exists (
  select 1 from public.products where title = 'Hand-Painted Clay Diya (Set of 4)'
);

insert into public.products (title, description, maker_name, maker_city, price, category, max_discount_points, points_to_rupee_ratio, stock)
select 'Terracotta Wall Hanging', 'Hand-molded terracotta décor piece.', 'Ramesh Kumar', 'Gonda', 349.00, 'Clay Crafts & Home Decor', 80, 1.0, 40
where not exists (
  select 1 from public.products where title = 'Terracotta Wall Hanging'
);

-- ============================================================
-- DONE. .env.local needs:
--   NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
--   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-public-key>
-- ============================================================


-- ---- from sthamly-ecosystem-schema-v3.sql ----
-- ============================================================
-- STHAMLY — ECOSYSTEM SCHEMA (v3)
-- Adds: user-uploaded reels, seller/creator roles, product
-- tagging in reels, verified-seller badge, skill badges,
-- points-expiry column, and Storage buckets for uploads.
-- Run AFTER sthamly-learn-earn-schema.sql (v2) in the same project.
-- Supabase Dashboard → SQL Editor → New Query → paste → Run
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROFILES — add roles, verification, badges, points expiry
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists is_seller       boolean not null default false,
  add column if not exists is_creator      boolean not null default false,
  add column if not exists seller_verified boolean not null default false,
  add column if not exists skill_badges    jsonb   not null default '[]',
  add column if not exists points_expire_at timestamptz;

-- ------------------------------------------------------------
-- 2. LESSONS — allow user-generated reels + product tagging
--    (curated admin lessons and creator reels share one feed)
-- ------------------------------------------------------------
alter table public.lessons
  add column if not exists creator_id        uuid references public.profiles (id) on delete set null,
  add column if not exists is_user_generated boolean not null default false,
  add column if not exists tagged_product_id uuid references public.products (id) on delete set null;

-- ------------------------------------------------------------
-- 3. PRODUCTS — link to the actual maker's account
-- ------------------------------------------------------------
alter table public.products
  add column if not exists maker_id uuid references public.profiles (id) on delete set null;

-- ------------------------------------------------------------
-- 4. RPC: toggle seller / creator role for your own profile
-- ------------------------------------------------------------
create or replace function public.toggle_role(p_is_seller boolean, p_is_creator boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.profiles
    set is_seller = p_is_seller,
        is_creator = p_is_creator
    where id = auth.uid();
end;
$$;

-- ------------------------------------------------------------
-- 5. RPC: create a reel (creator-only, server checks the role)
-- ------------------------------------------------------------
create or replace function public.create_reel(
  p_title text,
  p_description text,
  p_video_url text,
  p_craft_theme text,
  p_quiz_questions jsonb,
  p_tagged_product_id uuid
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
     points_reward, is_published, is_user_generated, creator_id, tagged_product_id)
  values
    (p_title, p_description, p_video_url, p_craft_theme, p_quiz_questions,
     10, true, true, v_user, p_tagged_product_id)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- ------------------------------------------------------------
-- 6. RPC: list a product (seller-only, server checks the role)
-- ------------------------------------------------------------
create or replace function public.create_product(
  p_title text,
  p_description text,
  p_price numeric,
  p_image_url text,
  p_category text,
  p_max_discount_points integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_is_seller boolean;
  v_maker_name text;
  v_maker_city text;
  v_new_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select is_seller, full_name, city into v_is_seller, v_maker_name, v_maker_city
    from public.profiles where id = v_user;

  if not coalesce(v_is_seller, false) then
    raise exception 'Turn on Seller mode in your profile first';
  end if;

  insert into public.products
    (title, description, maker_id, maker_name, maker_city, price,
     image_url, category, max_discount_points, points_to_rupee_ratio, stock, is_active)
  values
    (p_title, p_description, v_user, coalesce(v_maker_name, 'Local Maker'), coalesce(v_maker_city, 'Gonda'),
     p_price, p_image_url, p_category, p_max_discount_points, 1.0, 100, true)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- ------------------------------------------------------------
-- 7. Skill badges — auto-award after 10 completions in a theme
-- ------------------------------------------------------------
create or replace function public.check_skill_badge()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_theme text;
  v_count integer;
  v_badges jsonb;
begin
  select l.craft_theme into v_theme from public.lessons l where l.id = new.lesson_id;

  select count(*) into v_count
    from public.lesson_completions lc
    join public.lessons l on l.id = lc.lesson_id
    where lc.user_id = new.user_id and l.craft_theme = v_theme;

  if v_count >= 10 then
    select skill_badges into v_badges from public.profiles where id = new.user_id;
    if not (v_badges @> to_jsonb(v_theme)) then
      update public.profiles
        set skill_badges = skill_badges || to_jsonb(v_theme)
        where id = new.user_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists award_skill_badge on public.lesson_completions;
create trigger award_skill_badge
  after insert on public.lesson_completions
  for each row execute procedure public.check_skill_badge();

-- ------------------------------------------------------------
-- 8. RLS — allow creators/sellers to READ their own uploads too
--    (writes only ever happen through the security-definer RPCs
--    above, so a non-creator/non-seller can never insert directly)
-- ------------------------------------------------------------
drop policy if exists "Creators can view their own unpublished reels" on public.lessons;
create policy "Creators can view their own unpublished reels"
  on public.lessons for select
  using (auth.uid() = creator_id);

drop policy if exists "Sellers can view their own inactive products" on public.products;
create policy "Sellers can view their own inactive products"
  on public.products for select
  using (auth.uid() = maker_id);

-- ------------------------------------------------------------
-- 9. STORAGE — buckets for reel videos & product images
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('reels', 'reels', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do nothing;

-- Anyone can view (public buckets), only the owner can upload into
-- their own folder (folder name = their user id) inside each bucket.
drop policy if exists "Public can view reel files" on storage.objects;
create policy "Public can view reel files"
  on storage.objects for select
  using (bucket_id = 'reels');

drop policy if exists "Users upload reels into their own folder" on storage.objects;
create policy "Users upload reels into their own folder"
  on storage.objects for insert
  with check (bucket_id = 'reels' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images"
  on storage.objects for select
  using (bucket_id = 'products');

drop policy if exists "Users upload product images into their own folder" on storage.objects;
create policy "Users upload product images into their own folder"
  on storage.objects for insert
  with check (bucket_id = 'products' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- DONE. New capabilities unlocked:
--  - profiles.is_seller / is_creator toggles (via toggle_role RPC)
--  - Creators can upload a reel + quiz + tag a product (create_reel RPC)
--  - Sellers can list a product (create_product RPC)
--  - Storage buckets "reels" and "products" ready for file uploads
--  - Skill badges auto-award after 10 completions in one craft_theme
-- ============================================================


-- ---- from sthamly-schema-v4.sql ----
-- ============================================================
-- STHAMLY — SCHEMA v4
-- Adds: (1) automatic 30-day points expiry via pg_cron
--       (2) Chat-to-Bargain messaging between buyer & seller
-- Run AFTER v2 and v3 schemas, in Supabase SQL Editor.
-- ============================================================

-- ------------------------------------------------------------
-- PART A — POINTS EXPIRY
-- ------------------------------------------------------------
-- profiles.points_expire_at already exists (from v3).
-- Every time a user earns points, we push their expiry 30 days out.
-- If they don't earn (or spend) anything for 30 days, their whole
-- balance resets to 0 — this nudges people to redeem points quickly
-- at local sellers instead of hoarding them.

create or replace function public.complete_lesson(p_lesson_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points integer;
  v_user   uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select points_reward into v_points from public.lessons where id = p_lesson_id and is_published = true;
  if v_points is null then
    raise exception 'Lesson not found';
  end if;

  insert into public.lesson_completions (user_id, lesson_id, points_earned)
  values (v_user, p_lesson_id, v_points)
  on conflict (user_id, lesson_id) do nothing;

  if found then
    update public.profiles
      set sthamly_points = sthamly_points + v_points,
          points_expire_at = now() + interval '30 days'
      where id = v_user;
  end if;

  return v_points;
end;
$$;

-- Runs daily: zero out the balance for anyone whose points expired
create or replace function public.expire_stale_points()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
    set sthamly_points = 0,
        points_expire_at = null
    where points_expire_at is not null
      and points_expire_at < now()
      and sthamly_points > 0;
end;
$$;

-- Schedule it with pg_cron (runs every day at midnight UTC).
-- If this extension isn't enabled yet: Supabase Dashboard →
-- Database → Extensions → search "pg_cron" → Enable, then re-run
-- just this block below.
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'expire-sthamly-points-daily',
  '0 0 * * *',
  $$select public.expire_stale_points();$$
) where not exists (
  select 1 from cron.job where jobname = 'expire-sthamly-points-daily'
);

-- ------------------------------------------------------------
-- PART B — CHAT-TO-BARGAIN
-- ------------------------------------------------------------
create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  buyer_id    uuid not null references public.profiles (id) on delete cascade,
  seller_id   uuid not null references public.profiles (id) on delete cascade,
  product_id  uuid references public.products (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (buyer_id, seller_id, product_id)
);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  body            text,
  offer_price     numeric(10,2),  -- set when the message is a price offer
  created_at      timestamptz not null default now()
);

create index if not exists idx_messages_conversation on public.messages (conversation_id, created_at);
create index if not exists idx_conversations_buyer on public.conversations (buyer_id);
create index if not exists idx_conversations_seller on public.conversations (seller_id);

-- bump conversations.updated_at whenever a new message arrives
create or replace function public.touch_conversation()
returns trigger
language plpgsql
as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists touch_conversation on public.messages;
create trigger touch_conversation
  after insert on public.messages
  for each row execute procedure public.touch_conversation();

-- RPC: start (or reuse) a conversation between the current buyer and a product's seller
create or replace function public.start_conversation(p_product_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer uuid := auth.uid();
  v_seller uuid;
  v_conv_id uuid;
begin
  if v_buyer is null then raise exception 'Not authenticated'; end if;

  select maker_id into v_seller from public.products where id = p_product_id;
  if v_seller is null then raise exception 'Product has no seller on record'; end if;
  if v_seller = v_buyer then raise exception 'You cannot bargain with yourself'; end if;

  select id into v_conv_id from public.conversations
    where buyer_id = v_buyer and seller_id = v_seller and product_id = p_product_id;

  if v_conv_id is null then
    insert into public.conversations (buyer_id, seller_id, product_id)
    values (v_buyer, v_seller, p_product_id)
    returning id into v_conv_id;
  end if;

  return v_conv_id;
end;
$$;

-- RPC: send a message (optionally with a price offer) in a conversation you belong to
create or replace function public.send_message(p_conversation_id uuid, p_body text, p_offer_price numeric default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_belongs boolean;
  v_new_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select exists(
    select 1 from public.conversations
    where id = p_conversation_id and (buyer_id = v_user or seller_id = v_user)
  ) into v_belongs;

  if not v_belongs then raise exception 'Not part of this conversation'; end if;

  insert into public.messages (conversation_id, sender_id, body, offer_price)
  values (p_conversation_id, v_user, p_body, p_offer_price)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- RLS
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

drop policy if exists "Participants can view their conversations" on public.conversations;
create policy "Participants can view their conversations"
  on public.conversations for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "Participants can view their messages" on public.messages;
create policy "Participants can view their messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

-- Note: inserting messages/conversations only ever happens through the
-- security-definer RPCs above (start_conversation, send_message), so no
-- direct INSERT policy is granted to the client role.

-- Enable Realtime so the chat UI can subscribe to new messages live
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null; -- already added, safe to ignore
end $$;

-- ============================================================
-- DONE.
--  - Points now expire 30 days after the last time you earned any
--  - conversations + messages power Chat-to-Bargain
--  - start_conversation(product_id) / send_message(conversation_id, body, offer_price)
-- ============================================================


-- ---- from sthamly-schema-v5.sql ----
-- ============================================================
-- STHAMLY — SCHEMA v5
-- Adds: image & voice-note support in Chat-to-Bargain messages,
-- plus a "chat-media" Storage bucket for both.
-- Run AFTER v2, v3, v4 in Supabase SQL Editor.
-- ============================================================

alter table public.messages
  add column if not exists image_url text,
  add column if not exists audio_url text;

-- Replace send_message so it can carry an image or a voice note too
create or replace function public.send_message(
  p_conversation_id uuid,
  p_body text,
  p_offer_price numeric default null,
  p_image_url text default null,
  p_audio_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_belongs boolean;
  v_new_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select exists(
    select 1 from public.conversations
    where id = p_conversation_id and (buyer_id = v_user or seller_id = v_user)
  ) into v_belongs;

  if not v_belongs then raise exception 'Not part of this conversation'; end if;

  insert into public.messages (conversation_id, sender_id, body, offer_price, image_url, audio_url)
  values (p_conversation_id, v_user, p_body, p_offer_price, p_image_url, p_audio_url)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- Storage bucket for chat photos & voice notes
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true)
on conflict (id) do nothing;

drop policy if exists "Public can view chat media" on storage.objects;
create policy "Public can view chat media"
  on storage.objects for select
  using (bucket_id = 'chat-media');

drop policy if exists "Users upload chat media into their own folder" on storage.objects;
create policy "Users upload chat media into their own folder"
  on storage.objects for insert
  with check (bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- DONE. messages.image_url / messages.audio_url now available.
-- send_message() accepts optional p_image_url and p_audio_url.
-- ============================================================


-- ---- from sthamly-schema-v6.sql ----
-- ============================================================
-- STHAMLY — SCHEMA v6
-- Adds: profiles.total_saved_rupees — a running total of how much
-- real money a user has saved via points redemption, plus a
-- redemptions log table for history/audit.
-- Run AFTER v2, v3, v4, v5 in Supabase SQL Editor.
-- ============================================================

alter table public.profiles
  add column if not exists total_saved_rupees numeric(10,2) not null default 0;

create table if not exists public.redemptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  product_id      uuid references public.products (id) on delete set null,
  points_used     integer not null,
  discount_amount numeric(10,2) not null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_redemptions_user on public.redemptions (user_id, created_at);

alter table public.redemptions enable row level security;

drop policy if exists "Users can view their own redemption history" on public.redemptions;
create policy "Users can view their own redemption history"
  on public.redemptions for select
  using (auth.uid() = user_id);

-- Redefine redeem_points so it also logs the redemption and
-- updates the user's lifetime "total saved" figure.
create or replace function public.redeem_points(p_product_id uuid, p_points_to_use integer)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_balance integer;
  v_max integer;
  v_ratio numeric;
  v_use integer;
  v_discount numeric;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select sthamly_points into v_balance from public.profiles where id = v_user;
  select max_discount_points, points_to_rupee_ratio into v_max, v_ratio
    from public.products where id = p_product_id and is_active = true;

  if v_max is null then raise exception 'Product not found'; end if;

  v_use := least(p_points_to_use, v_balance, v_max);
  v_discount := v_use * v_ratio;

  update public.profiles
    set sthamly_points = sthamly_points - v_use,
        total_saved_rupees = total_saved_rupees + v_discount
    where id = v_user;

  if v_use > 0 then
    insert into public.redemptions (user_id, product_id, points_used, discount_amount)
    values (v_user, p_product_id, v_use, v_discount);
  end if;

  return v_discount;
end;
$$;

-- ============================================================
-- DONE. profiles.total_saved_rupees now tracks lifetime savings.
-- redemptions table keeps a full history for future "My Savings" UI.
-- ============================================================


-- ---- from sthamly-schema-v7.sql ----
-- ============================================================
-- STHAMLY — SCHEMA v7
-- Fixes a real-world edge case: if the on-signup trigger ever
-- misses creating a profiles row (e.g. timing/race issues, or a
-- user who signed up before the trigger existed), the app would
-- misleadingly show "You're not signed in" even though the person
-- IS authenticated — it just had no profile row to read.
--
-- ensure_profile() lets the client safely self-heal: call it right
-- after login, and it creates the missing row if needed (or does
-- nothing if it already exists), then the app re-fetches normally.
-- Run AFTER v2, v3, v4, v5, v6 in Supabase SQL Editor.
-- ============================================================

create or replace function public.ensure_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_name text;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.profiles where id = v_user) then
    return; -- already has a profile row, nothing to do
  end if;

  select email, raw_user_meta_data->>'full_name' into v_email, v_name
    from auth.users where id = v_user;

  insert into public.profiles (id, full_name, city)
  values (v_user, coalesce(v_name, split_part(v_email, '@', 1)), 'Gonda')
  on conflict (id) do nothing;
end;
$$;

-- ============================================================
-- DONE. Call supabase.rpc('ensure_profile') right after a user
-- logs in (the app now does this automatically) before reading
-- their profile row.
-- ============================================================


-- ============================================================
-- v8 — SERVICES & BOOKINGS (first step toward the Creator
-- Business Profile vision: creators can now offer bookable
-- services — photography, mehndi, tutoring, events — not just
-- sell physical handmade products.)
-- ============================================================

alter table public.products
  add column if not exists is_service boolean not null default false,
  add column if not exists duration_minutes integer;

create table if not exists public.bookings (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references public.profiles (id) on delete cascade,
  provider_id       uuid not null references public.profiles (id) on delete cascade,
  service_id        uuid not null references public.products (id) on delete cascade,
  requested_time    timestamptz,
  status            text not null default 'requested'
                       check (status in ('requested','confirmed','completed','cancelled')),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_bookings_customer on public.bookings (customer_id);
create index if not exists idx_bookings_provider on public.bookings (provider_id);

create or replace function public.touch_booking()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists touch_booking on public.bookings;
create trigger touch_booking before update on public.bookings
  for each row execute procedure public.touch_booking();

-- RPC: request a booking for a service (creates the booking +
-- starts/reuses the Chat-to-Bargain thread so details get worked
-- out with the provider, same as an ordinary product enquiry).
create or replace function public.request_booking(
  p_service_id uuid,
  p_requested_time timestamptz,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid := auth.uid();
  v_provider uuid;
  v_is_service boolean;
  v_booking_id uuid;
begin
  if v_customer is null then raise exception 'Not authenticated'; end if;

  select maker_id, is_service into v_provider, v_is_service
    from public.products where id = p_service_id and is_active = true;

  if v_provider is null then raise exception 'Service not found'; end if;
  if not coalesce(v_is_service, false) then raise exception 'This listing is not a bookable service'; end if;
  if v_provider = v_customer then raise exception 'You cannot book your own service'; end if;

  insert into public.bookings (customer_id, provider_id, service_id, requested_time, notes)
  values (v_customer, v_provider, p_service_id, p_requested_time, p_notes)
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;

-- RPC: provider confirms/cancels/completes a booking they own
create or replace function public.update_booking_status(p_booking_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_status not in ('confirmed','completed','cancelled') then
    raise exception 'Invalid status';
  end if;

  update public.bookings
    set status = p_status
    where id = p_booking_id
      and (provider_id = v_user or (customer_id = v_user and p_status = 'cancelled'));
end;
$$;

alter table public.bookings enable row level security;

drop policy if exists "Bookings visible to customer or provider" on public.bookings;
create policy "Bookings visible to customer or provider"
  on public.bookings for select
  using (auth.uid() = customer_id or auth.uid() = provider_id);

-- ============================================================
-- DONE. New capability: list a service (products.is_service = true,
-- set via the existing create_product RPC with is_service param —
-- app UI updated to expose this), and book it via request_booking().
-- ============================================================

-- Redefine create_product so a seller can optionally mark a listing
-- as a bookable service instead of a physical product.
create or replace function public.create_product(
  p_title text,
  p_description text,
  p_price numeric,
  p_image_url text,
  p_category text,
  p_max_discount_points integer,
  p_is_service boolean default false,
  p_duration_minutes integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_is_seller boolean;
  v_maker_name text;
  v_maker_city text;
  v_new_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select is_seller, full_name, city into v_is_seller, v_maker_name, v_maker_city
    from public.profiles where id = v_user;

  if not coalesce(v_is_seller, false) then
    raise exception 'Turn on Seller mode in your profile first';
  end if;

  insert into public.products
    (title, description, maker_id, maker_name, maker_city, price,
     image_url, category, max_discount_points, points_to_rupee_ratio, stock, is_active,
     is_service, duration_minutes)
  values
    (p_title, p_description, v_user, coalesce(v_maker_name, 'Local Maker'), coalesce(v_maker_city, 'Gonda'),
     p_price, p_image_url, p_category, p_max_discount_points, 1.0, 100, true,
     p_is_service, p_duration_minutes)
  returning id into v_new_id;

  return v_new_id;
end;
$$;
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
-- STHAMLY — SCHEMA v11
-- Adds a Notifications Center: coins earned, redemptions,
-- booking updates, and new chat messages all show up in one
-- categorized feed, per the v2 architecture spec.
-- Run in Supabase SQL Editor AFTER the consolidated schema.
-- ============================================================

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  category    text not null check (category in ('reward','order','social','learning')),
  title       text not null,
  body        text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Users see their own notifications" on public.notifications;
create policy "Users see their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

-- RPC: mark one notification read (client can only touch its own)
create or replace function public.mark_notification_read(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications
    set is_read = true
    where id = p_id and user_id = auth.uid();
end;
$$;

-- ---- Auto-create notifications from existing app events ----

-- Coins earned (lesson_completions insert)
create or replace function public.notify_coins_earned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, category, title, body)
  values (new.user_id, 'reward', 'Coins Earned!', 'You earned ' || new.points_earned || ' Sthamly Coins.');
  return new;
end;
$$;

drop trigger if exists notify_coins_earned on public.lesson_completions;
create trigger notify_coins_earned
  after insert on public.lesson_completions
  for each row execute procedure public.notify_coins_earned();

-- Redemption confirmed
create or replace function public.notify_redemption()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, category, title, body)
  values (new.user_id, 'order', 'Discount Redeemed', '₹' || new.discount_amount || ' discount applied using ' || new.points_used || ' coins.');
  return new;
end;
$$;

drop trigger if exists notify_redemption on public.redemptions;
create trigger notify_redemption
  after insert on public.redemptions
  for each row execute procedure public.notify_redemption();

-- Booking status change notifies the customer
create or replace function public.notify_booking_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.notifications (user_id, category, title, body)
    values (new.customer_id, 'order', 'Booking ' || initcap(new.status), 'Your booking status changed to ' || new.status || '.');
  end if;
  return new;
end;
$$;

drop trigger if exists notify_booking_update on public.bookings;
create trigger notify_booking_update
  after update on public.bookings
  for each row execute procedure public.notify_booking_update();

-- New chat message notifies the other participant
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer uuid;
  v_seller uuid;
  v_recipient uuid;
begin
  select buyer_id, seller_id into v_buyer, v_seller
    from public.conversations where id = new.conversation_id;

  v_recipient := case when new.sender_id = v_buyer then v_seller else v_buyer end;

  insert into public.notifications (user_id, category, title, body)
  values (v_recipient, 'social', 'New Message', coalesce(new.body, 'Sent you a photo/voice note'));
  return new;
end;
$$;

drop trigger if exists notify_new_message on public.messages;
create trigger notify_new_message
  after insert on public.messages
  for each row execute procedure public.notify_new_message();

-- ============================================================
-- DONE. notifications table auto-populates from key app events.
-- mark_notification_read(id) lets the client clear a badge.
-- ============================================================
