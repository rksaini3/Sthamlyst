-- ============================================================
-- STHAMLY — SCHEMA v16
-- Adds Edit + Delete for products, reels, announcements, comments
-- — every function checks the caller actually owns the item before
-- touching it, so no one can edit/delete someone else's content.
-- Products/reels use a soft delete (is_active/is_published = false)
-- to preserve order history and already-earned points; announcements
-- and comments are hard-deleted since nothing depends on them.
-- Run in Supabase SQL Editor AFTER the consolidated schema.
-- ============================================================

-- ---- Products: edit ----
create or replace function public.update_product(
  p_product_id uuid,
  p_title text,
  p_description text,
  p_price numeric,
  p_category text,
  p_max_discount_points integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  update public.products
    set title = coalesce(p_title, title),
        description = coalesce(p_description, description),
        price = coalesce(p_price, price),
        category = coalesce(p_category, category),
        max_discount_points = coalesce(p_max_discount_points, max_discount_points)
    where id = p_product_id and maker_id = auth.uid();

  if not found then
    raise exception 'Product not found or you do not own it';
  end if;
end;
$$;

-- ---- Products: delete (soft — keeps redemption/order history intact) ----
create or replace function public.delete_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  update public.products set is_active = false
    where id = p_product_id and maker_id = auth.uid();

  if not found then
    raise exception 'Product not found or you do not own it';
  end if;
end;
$$;

-- ---- Reels: edit metadata (title/description/theme — not the video file itself) ----
create or replace function public.update_lesson_meta(
  p_lesson_id uuid,
  p_title text,
  p_description text,
  p_craft_theme text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  update public.lessons
    set title = coalesce(p_title, title),
        description = coalesce(p_description, description),
        craft_theme = coalesce(p_craft_theme, craft_theme)
    where id = p_lesson_id and creator_id = auth.uid();

  if not found then
    raise exception 'Reel not found or you do not own it';
  end if;
end;
$$;

-- ---- Reels: delete (soft — viewers who already earned points keep them) ----
create or replace function public.delete_lesson(p_lesson_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  update public.lessons set is_published = false
    where id = p_lesson_id and creator_id = auth.uid();

  if not found then
    raise exception 'Reel not found or you do not own it';
  end if;
end;
$$;

-- ---- Announcements: delete ----
create or replace function public.delete_announcement(p_announcement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  delete from public.announcements
    where id = p_announcement_id and user_id = auth.uid();

  if not found then
    raise exception 'Announcement not found or you do not own it';
  end if;
end;
$$;

-- ---- Comments: delete ----
create or replace function public.delete_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  delete from public.comments
    where id = p_comment_id and user_id = auth.uid();

  if not found then
    raise exception 'Comment not found or you do not own it';
  end if;
end;
$$;

-- ============================================================
-- DONE. update_product / delete_product / update_lesson_meta /
-- delete_lesson / delete_announcement / delete_comment — all
-- owner-checked server-side.
-- ============================================================
