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

create policy "Public can view chat media"
  on storage.objects for select
  using (bucket_id = 'chat-media');

create policy "Users upload chat media into their own folder"
  on storage.objects for insert
  with check (bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- DONE. messages.image_url / messages.audio_url now available.
-- send_message() accepts optional p_image_url and p_audio_url.
-- ============================================================
