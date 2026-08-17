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

create policy "Profiles viewable by owner" on public.profiles for select using (auth.uid() = id);
create policy "Profiles editable by owner" on public.profiles for update using (auth.uid() = id);

create policy "Published lessons are public" on public.lessons for select using (is_published = true);

create policy "Users see their own completions" on public.lesson_completions for select using (auth.uid() = user_id);

create policy "Active products are public" on public.products for select using (is_active = true);

-- Note: points are only ever changed via the complete_lesson() and
-- redeem_points() functions above (security definer) — never directly
-- from the client, so a user cannot fake their own point balance.

-- ------------------------------------------------------------
-- 9. SEED DATA — pilot theme: Clay Crafts & Home Decor (Gonda)
-- ------------------------------------------------------------
insert into public.lessons (title, description, video_url, craft_theme, quiz_questions, points_reward, order_index)
values (
  'How Mrs. Sharma Makes Clay Diyas',
  'A 1-minute look at hand-shaping clay diyas the traditional way.',
  null,
  'Clay Crafts & Home Decor',
  '[
    {"question":"What is the diya mainly made from?","options":["Plastic","Clay","Metal"],"correct_index":1},
    {"question":"Where is Mrs. Sharma based?","options":["Gonda","Mumbai","Delhi"],"correct_index":0}
  ]'::jsonb,
  10, 1
) on conflict do nothing;

insert into public.products (title, description, maker_name, maker_city, price, category, max_discount_points, points_to_rupee_ratio, stock)
values
  ('Hand-Painted Clay Diya (Set of 4)', 'Traditional clay diyas, hand-painted by local artisans.', 'Mrs. Sharma', 'Gonda', 149.00, 'Clay Crafts & Home Decor', 50, 1.0, 100),
  ('Terracotta Wall Hanging', 'Hand-molded terracotta décor piece.', 'Ramesh Kumar', 'Gonda', 349.00, 'Clay Crafts & Home Decor', 80, 1.0, 40)
on conflict do nothing;

-- ============================================================
-- DONE. .env.local needs:
--   NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
--   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-public-key>
-- ============================================================
