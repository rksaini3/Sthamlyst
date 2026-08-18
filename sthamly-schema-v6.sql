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
