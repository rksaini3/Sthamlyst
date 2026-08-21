-- ============================================================
-- STHAMLY — SCHEMA v13
-- (1) Cart — "झोले में डालें" + floating bill bar
-- (2) Muhnadi — X-style announcement board (photo/text, no video needed)
-- (3) ID verification flag for sellers (safety/anti-fraud)
-- (4) A helper RPC that packages relevant Sthamly data for the
--     Gemini-powered Sahayak (search grounding), so the AI never
--     has to be given raw table access.
-- Run in Supabase SQL Editor AFTER the consolidated schema.
-- ============================================================

-- ---- Part 1: Cart ----
create table if not exists public.cart_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  quantity    integer not null default 1 check (quantity > 0),
  created_at  timestamptz not null default now(),
  unique (user_id, product_id)
);

alter table public.cart_items enable row level security;
drop policy if exists "Users see their own cart" on public.cart_items;
create policy "Users see their own cart"
  on public.cart_items for select
  using (auth.uid() = user_id);

create or replace function public.add_to_cart(p_product_id uuid, p_quantity integer default 1)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  insert into public.cart_items (user_id, product_id, quantity)
  values (auth.uid(), p_product_id, p_quantity)
  on conflict (user_id, product_id)
  do update set quantity = public.cart_items.quantity + excluded.quantity;
end;
$$;

create or replace function public.remove_from_cart(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  delete from public.cart_items where user_id = auth.uid() and product_id = p_product_id;
end;
$$;

create or replace function public.set_cart_quantity(p_product_id uuid, p_quantity integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_quantity <= 0 then
    delete from public.cart_items where user_id = auth.uid() and product_id = p_product_id;
  else
    update public.cart_items set quantity = p_quantity
      where user_id = auth.uid() and product_id = p_product_id;
  end if;
end;
$$;

-- ---- Part 2: Muhnadi (Announcement Board) ----
create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 280),
  image_url   text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_announcements_created on public.announcements (created_at desc);

alter table public.announcements enable row level security;
drop policy if exists "Announcements are public" on public.announcements;
create policy "Announcements are public" on public.announcements for select using (true);

create or replace function public.post_announcement(p_body text, p_image_url text default null)
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
  if length(trim(p_body)) = 0 then raise exception 'Announcement cannot be empty'; end if;

  insert into public.announcements (user_id, body, image_url)
  values (v_user, trim(p_body), p_image_url)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- Storage bucket for announcement photos
insert into storage.buckets (id, name, public)
values ('announcements', 'announcements', true)
on conflict (id) do nothing;

drop policy if exists "Public can view announcement media" on storage.objects;
create policy "Public can view announcement media"
  on storage.objects for select
  using (bucket_id = 'announcements');

drop policy if exists "Users upload announcements into their own folder" on storage.objects;
create policy "Users upload announcements into their own folder"
  on storage.objects for insert
  with check (bucket_id = 'announcements' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---- Part 3: Seller ID verification flag ----
-- Actual document checking happens outside the DB (manual review or a
-- future KYC provider); this just records the outcome so the app can
-- require it before is_seller becomes fully active in the Bazaar.
alter table public.profiles
  add column if not exists id_verification_status text not null default 'unverified'
    check (id_verification_status in ('unverified','pending','verified','rejected'));

-- ---- Part 4: Sahayak search-grounding helper ----
-- Keeps the Gemini-powered assistant from ever needing direct table
-- access: it calls this one RPC, gets back a small, safe JSON summary
-- of matching products/services/reels/creators to ground its answer.
create or replace function public.sahayak_search(p_query text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_q text := '%' || p_query || '%';
  v_result jsonb;
begin
  select jsonb_build_object(
    'products', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'price', price, 'is_service', is_service, 'maker_name', maker_name))
      from (select * from public.products where is_active = true and title ilike v_q limit 5) p
    ), '[]'::jsonb),
    'reels', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'craft_theme', craft_theme))
      from (select * from public.lessons where is_published = true and title ilike v_q limit 5) l
    ), '[]'::jsonb),
    'creators', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'full_name', full_name, 'city', city))
      from (select * from public.profiles where full_name ilike v_q limit 5) c
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- ============================================================
-- DONE.
--  - add_to_cart / remove_from_cart / set_cart_quantity
--  - post_announcement(body, image_url) for Muhnadi
--  - profiles.id_verification_status for seller safety
--  - sahayak_search(query) — safe, grounded data for Gemini Sahayak
-- ============================================================
