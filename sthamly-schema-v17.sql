-- ============================================================
-- STHAMLY — SCHEMA v17
-- Major commerce + trust infrastructure:
--  (1) Orders + Commission Ledger (Razorpay-ready)
--  (2) Business Accounts + Location-based Discovery (5/10km radius)
--  (3) Business-Creator Campaign requests
--  (4) Category-based verification gates (Finance/Health/Home
--      Services require a disclaimer or verification doc)
--  (5) Dispute/report system — 3+ reports auto-pauses a listing
-- Run in Supabase SQL Editor AFTER the consolidated schema.
-- ============================================================

-- ------------------------------------------------------------
-- PART 1 — ORDERS & COMMISSION LEDGER
-- ------------------------------------------------------------
create table if not exists public.orders (
  id                  uuid primary key default gen_random_uuid(),
  buyer_id            uuid not null references public.profiles (id) on delete cascade,
  seller_id           uuid not null references public.profiles (id) on delete cascade,
  product_id          uuid references public.products (id) on delete set null,
  quantity            integer not null default 1,
  item_price          numeric(10,2) not null,
  discount_amount     numeric(10,2) not null default 0,
  total_amount        numeric(10,2) not null,          -- what the buyer actually pays
  commission_rate     numeric(4,2) not null default 8,  -- % — matches the ~8% platform fee in the business plan
  commission_amount   numeric(10,2) not null,
  seller_payout       numeric(10,2) not null,
  status              text not null default 'created'
                         check (status in ('created','paid','failed','refunded','completed','disputed')),
  razorpay_order_id   text,
  razorpay_payment_id text,
  razorpay_signature  text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_orders_buyer on public.orders (buyer_id, created_at desc);
create index if not exists idx_orders_seller on public.orders (seller_id, created_at desc);

create or replace function public.touch_order()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists touch_order on public.orders;
create trigger touch_order before update on public.orders
  for each row execute procedure public.touch_order();

-- Commission ledger — one row per order once payment is confirmed;
-- this is the authoritative record for Sthamly's platform revenue.
create table if not exists public.commission_ledger (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,
  seller_id         uuid not null references public.profiles (id) on delete cascade,
  commission_amount numeric(10,2) not null,
  seller_payout     numeric(10,2) not null,
  created_at        timestamptz not null default now()
);

create index if not exists idx_ledger_seller on public.commission_ledger (seller_id, created_at desc);

alter table public.orders enable row level security;
alter table public.commission_ledger enable row level security;

drop policy if exists "Buyer or seller can view their orders" on public.orders;
create policy "Buyer or seller can view their orders"
  on public.orders for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "Sellers can view their own ledger entries" on public.commission_ledger;
create policy "Sellers can view their own ledger entries"
  on public.commission_ledger for select
  using (auth.uid() = seller_id);

-- RPC: create a pending order (called right before opening Razorpay checkout)
create or replace function public.create_order(
  p_product_id uuid,
  p_quantity integer,
  p_discount_amount numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer uuid := auth.uid();
  v_seller uuid;
  v_price numeric;
  v_total numeric;
  v_commission numeric;
  v_order_id uuid;
begin
  if v_buyer is null then raise exception 'Not authenticated'; end if;

  select maker_id, price into v_seller, v_price
    from public.products where id = p_product_id and is_active = true;

  if v_seller is null then raise exception 'Product not found'; end if;
  if v_seller = v_buyer then raise exception 'You cannot buy your own product'; end if;

  v_total := greatest((v_price * p_quantity) - p_discount_amount, 0);
  v_commission := round(v_total * 0.08, 2);

  insert into public.orders
    (buyer_id, seller_id, product_id, quantity, item_price, discount_amount,
     total_amount, commission_amount, seller_payout)
  values
    (v_buyer, v_seller, p_product_id, p_quantity, v_price, p_discount_amount,
     v_total, v_commission, v_total - v_commission)
  returning id into v_order_id;

  return v_order_id;
end;
$$;

-- RPC: mark an order paid (called from the server-side payment-verify
-- route only — never directly from the client) and write the ledger entry.
create or replace function public.confirm_order_payment(
  p_order_id uuid,
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_razorpay_signature text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller uuid;
  v_commission numeric;
  v_payout numeric;
begin
  update public.orders
    set status = 'paid',
        razorpay_order_id = p_razorpay_order_id,
        razorpay_payment_id = p_razorpay_payment_id,
        razorpay_signature = p_razorpay_signature
    where id = p_order_id
    returning seller_id, commission_amount, seller_payout into v_seller, v_commission, v_payout;

  if not found then raise exception 'Order not found'; end if;

  insert into public.commission_ledger (order_id, seller_id, commission_amount, seller_payout)
  values (p_order_id, v_seller, v_commission, v_payout);
end;
$$;

-- ------------------------------------------------------------
-- PART 2 — BUSINESS ACCOUNTS + LOCATION DISCOVERY
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists is_business boolean not null default false,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists business_category text;

-- RPC: nearby creators/sellers within a radius (km), using the
-- haversine formula — no PostGIS extension required, good enough
-- for city-level hyperlocal discovery.
create or replace function public.discover_nearby(
  p_lat double precision,
  p_lng double precision,
  p_radius_km numeric default 5,
  p_category text default null
)
returns table (
  id uuid,
  full_name text,
  city text,
  business_category text,
  is_seller boolean,
  is_creator boolean,
  seller_verified boolean,
  distance_km numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.full_name, p.city, p.business_category, p.is_seller, p.is_creator, p.seller_verified,
    round(
      (6371 * acos(
        greatest(-1, least(1,
          cos(radians(p_lat)) * cos(radians(p.latitude)) *
          cos(radians(p.longitude) - radians(p_lng)) +
          sin(radians(p_lat)) * sin(radians(p.latitude))
        ))
      ))::numeric, 2
    ) as distance_km
  from public.profiles p
  where p.latitude is not null and p.longitude is not null
    and (p.is_seller = true or p.is_creator = true)
    and (p_category is null or p.business_category = p_category)
  having
    (6371 * acos(
      greatest(-1, least(1,
        cos(radians(p_lat)) * cos(radians(p.latitude)) *
        cos(radians(p.longitude) - radians(p_lng)) +
        sin(radians(p_lat)) * sin(radians(p.latitude))
      ))
    )) <= p_radius_km
  order by distance_km asc
  limit 50;
$$;

-- RPC: update my own location (city-level precision is fine — see
-- Privacy Policy: exact GPS is never required, just approximate area)
create or replace function public.update_my_location(p_lat double precision, p_lng double precision)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.profiles set latitude = p_lat, longitude = p_lng where id = auth.uid();
end;
$$;

-- ------------------------------------------------------------
-- PART 3 — BUSINESS-CREATOR CAMPAIGN REQUESTS
-- ------------------------------------------------------------
create table if not exists public.campaign_requests (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.profiles (id) on delete cascade,
  title         text not null,
  description   text,
  category      text,
  budget        numeric(10,2),
  status        text not null default 'open' check (status in ('open','closed')),
  created_at    timestamptz not null default now()
);

create table if not exists public.campaign_responses (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.campaign_requests (id) on delete cascade,
  creator_id    uuid not null references public.profiles (id) on delete cascade,
  message       text,
  created_at    timestamptz not null default now(),
  unique (campaign_id, creator_id)
);

alter table public.campaign_requests enable row level security;
alter table public.campaign_responses enable row level security;

drop policy if exists "Open campaigns are public" on public.campaign_requests;
create policy "Open campaigns are public" on public.campaign_requests for select using (true);

drop policy if exists "Campaign owner and responder can view responses" on public.campaign_responses;
create policy "Campaign owner and responder can view responses"
  on public.campaign_responses for select
  using (
    auth.uid() = creator_id or
    auth.uid() in (select business_id from public.campaign_requests where id = campaign_id)
  );

create or replace function public.post_campaign_request(
  p_title text, p_description text, p_category text, p_budget numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_is_business boolean;
  v_new_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  select is_business into v_is_business from public.profiles where id = v_user;
  if not coalesce(v_is_business, false) then
    raise exception 'Turn on Business mode in Settings first';
  end if;

  insert into public.campaign_requests (business_id, title, description, category, budget)
  values (v_user, p_title, p_description, p_category, p_budget)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

create or replace function public.respond_to_campaign(p_campaign_id uuid, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into public.campaign_responses (campaign_id, creator_id, message)
  values (p_campaign_id, auth.uid(), p_message)
  on conflict (campaign_id, creator_id) do update set message = excluded.message;
end;
$$;

-- ------------------------------------------------------------
-- PART 4 — CATEGORY-BASED VERIFICATION GATES
-- ------------------------------------------------------------
-- Sensitive categories (Finance, Health, Home Services) require
-- either a verification document or an explicit disclaimer
-- checkbox at listing time before the listing can go live.
alter table public.products
  add column if not exists requires_verification boolean not null default false,
  add column if not exists disclaimer_accepted boolean not null default false,
  add column if not exists verification_doc_url text;

create or replace function public.is_sensitive_category(p_category text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(p_category, '')) in ('finance', 'health', 'home services', 'home-services');
$$;

-- Redefine create_product to enforce the gate
create or replace function public.create_product(
  p_title text,
  p_description text,
  p_price numeric,
  p_image_url text,
  p_category text,
  p_max_discount_points integer,
  p_is_service boolean default false,
  p_duration_minutes integer default null,
  p_disclaimer_accepted boolean default false,
  p_verification_doc_url text default null
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
  v_needs_gate boolean;
  v_new_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select is_seller, full_name, city into v_is_seller, v_maker_name, v_maker_city
    from public.profiles where id = v_user;

  if not coalesce(v_is_seller, false) then
    raise exception 'Turn on Seller mode in your profile first';
  end if;

  v_needs_gate := public.is_sensitive_category(p_category);
  if v_needs_gate and not p_disclaimer_accepted and p_verification_doc_url is null then
    raise exception 'This category needs either the disclaimer checkbox or a verification document';
  end if;

  insert into public.products
    (title, description, maker_id, maker_name, maker_city, price,
     image_url, category, max_discount_points, points_to_rupee_ratio, stock, is_active,
     is_service, duration_minutes, requires_verification, disclaimer_accepted, verification_doc_url)
  values
    (p_title, p_description, v_user, coalesce(v_maker_name, 'Local Maker'), coalesce(v_maker_city, 'Gonda'),
     p_price, p_image_url, p_category, p_max_discount_points, 1.0, 100, true,
     p_is_service, p_duration_minutes, v_needs_gate, p_disclaimer_accepted, p_verification_doc_url)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- ------------------------------------------------------------
-- PART 5 — DISPUTES / TRUST SCORE (3+ reports auto-pauses a listing)
-- ------------------------------------------------------------
create table if not exists public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references public.profiles (id) on delete cascade,
  product_id   uuid references public.products (id) on delete cascade,
  lesson_id    uuid references public.lessons (id) on delete cascade,
  reason       text not null check (char_length(reason) between 1 and 500),
  created_at   timestamptz not null default now(),
  check (
    (product_id is not null and lesson_id is null) or
    (product_id is null and lesson_id is not null)
  )
);

alter table public.reports enable row level security;
drop policy if exists "Users see their own reports" on public.reports;
create policy "Users see their own reports"
  on public.reports for select
  using (auth.uid() = reporter_id);

create or replace function public.report_listing(
  p_product_id uuid default null,
  p_lesson_id uuid default null,
  p_reason text default 'Not specified'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_count integer;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_product_id is null and p_lesson_id is null then
    raise exception 'Must report either a product or a lesson';
  end if;

  insert into public.reports (reporter_id, product_id, lesson_id, reason)
  values (v_user, p_product_id, p_lesson_id, p_reason);

  if p_product_id is not null then
    select count(*) into v_count from public.reports where product_id = p_product_id;
    if v_count >= 3 then
      update public.products set is_active = false where id = p_product_id;
    end if;
  end if;

  if p_lesson_id is not null then
    select count(*) into v_count from public.reports where lesson_id = p_lesson_id;
    if v_count >= 3 then
      update public.lessons set is_published = false where id = p_lesson_id;
    end if;
  end if;
end;
$$;

-- ============================================================
-- DONE.
--  - create_order() / confirm_order_payment() — Razorpay-ready
--  - discover_nearby(lat, lng, radius_km, category)
--  - post_campaign_request() / respond_to_campaign()
--  - create_product() now enforces category verification gates
--  - report_listing() — auto-pauses a listing after 3+ reports
-- ============================================================

-- RPC: toggle business mode (separate from is_seller/is_creator)
create or replace function public.set_business_mode(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.profiles set is_business = p_enabled where id = auth.uid();
end;
$$;
