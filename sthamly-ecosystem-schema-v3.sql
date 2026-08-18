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
create policy "Creators can view their own unpublished reels"
  on public.lessons for select
  using (auth.uid() = creator_id);

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
create policy "Public can view reel files"
  on storage.objects for select
  using (bucket_id = 'reels');

create policy "Users upload reels into their own folder"
  on storage.objects for insert
  with check (bucket_id = 'reels' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Public can view product images"
  on storage.objects for select
  using (bucket_id = 'products');

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
