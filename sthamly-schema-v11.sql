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
