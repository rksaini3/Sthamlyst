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
