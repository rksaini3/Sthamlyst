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

create policy "Participants can view their conversations"
  on public.conversations for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

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
alter publication supabase_realtime add table public.messages;

-- ============================================================
-- DONE.
--  - Points now expire 30 days after the last time you earned any
--  - conversations + messages power Chat-to-Bargain
--  - start_conversation(product_id) / send_message(conversation_id, body, offer_price)
-- ============================================================
