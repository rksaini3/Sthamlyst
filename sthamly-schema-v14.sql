-- ============================================================
-- STHAMLY — SCHEMA v14
-- Adds deal-status tracking on conversations, so Chats can be
-- filtered into "Active Bargains" vs "Completed Deals" — X/Twitter-
-- style inbox organisation from the founder's action plan.
-- Run in Supabase SQL Editor AFTER the consolidated schema.
-- ============================================================

alter table public.conversations
  add column if not exists deal_status text not null default 'active'
    check (deal_status in ('active','completed'));

create or replace function public.mark_deal_completed(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  update public.conversations
    set deal_status = 'completed'
    where id = p_conversation_id
      and (buyer_id = auth.uid() or seller_id = auth.uid());
end;
$$;

-- ============================================================
-- DONE. conversations.deal_status + mark_deal_completed(id).
-- Notifications already have categories (reward/order/social/
-- learning) from v11 — the Notifications page filters by those.
-- ============================================================
